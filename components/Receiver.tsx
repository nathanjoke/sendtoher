"use client";

import { useEffect, useRef, useState } from "react";
import { Inbox, Loader2, Download, CheckCircle2, AlertTriangle, Clock, WifiOff, RotateCcw, X } from "lucide-react";
import FileList from "./FileList";
import TransferProgress from "./TransferProgress";
import { formatBytes, isValidRoomCode } from "@/lib/utils";
import { SignalingClient } from "@/lib/signaling-client";
import type { ReceiverStatus, TransferFile } from "@/types/transfer";
import type { ServerMessage } from "@/types/signaling";
import { addRemoteCandidate, createPeerConnection } from "@/lib/peer-connection";

interface CurrentFile { id: string; name: string; size: number; type: string; chunks: ArrayBuffer[]; received: number; }
type ControlMessage =
  | { type: "transfer-start"; totalBytes: number; fileCount: number }
  | { type: "file-start"; fileName: string; fileSize: number; fileType: string }
  | { type: "file-complete" }
  | { type: "transfer-complete" }
  | { type: "transfer-cancelled" };

let idCounter = 0;
const nextId = () => `receive-${++idCounter}`;

export default function Receiver() {
  const [status, setStatus] = useState<ReceiverStatus>("empty");
  const [digits, setDigits] = useState("");
  const [files, setFiles] = useState<TransferFile[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const currentFileRef = useRef<CurrentFile | null>(null);
  const downloadUrlsRef = useRef(new Map<string, string>());
  const totalBytesRef = useRef(0);
  const totalReceivedRef = useRef(0);
  const expectedFilesRef = useRef(0);
  const receivedFilesRef = useRef(0);
  const remoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    channelRef.current?.close();
    pcRef.current?.close();
    signalingRef.current?.disconnect();
    channelRef.current = null; pcRef.current = null; signalingRef.current = null;
    currentFileRef.current = null;
    remoteCandidatesRef.current = [];
  }

  function clearDownloadUrls() {
    for (const url of downloadUrlsRef.current.values()) URL.revokeObjectURL(url);
    downloadUrlsRef.current.clear();
  }

  function handleDigitsChange(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 4);
    setDigits(clean);
    setErrorMessage(null);
    if (clean.length) setStatus("typing"); else setStatus("empty");
  }

  function handleConnect() {
    if (!isValidRoomCode(digits)) return;
    cleanup(); clearDownloadUrls();
    setFiles([]); setOverallProgress(0); setErrorMessage(null); setStatus("connecting");

    const client = new SignalingClient();
    signalingRef.current = client;
    client.onMessage((message: ServerMessage) => void handleSignalingMessage(message));
    client.connect(
      () => client.joinRoom(digits),
      () => { setErrorMessage("Could not connect to the signaling server."); setStatus("connection-error"); },
    );
  }

  async function handleSignalingMessage(message: ServerMessage) {
    try {
      switch (message.type) {
        case "room-joined":
          setStatus("waiting-for-sender");
          break;
        case "signal":
          await handleSignal(message.data);
          break;
        case "room-not-found":
          setErrorMessage("That code doesn't match an active room."); setStatus("invalid-code"); break;
        case "room-expired":
          setErrorMessage("This room has expired. Ask the sender for a new code."); setStatus("room-expired"); break;
        case "room-full":
          setErrorMessage("This room already has a receiver."); setStatus("connection-error"); break;
        case "connection-error":
          setErrorMessage(message.message); setStatus("connection-error"); break;
        default: break;
      }
    } catch (error) {
      console.error("Receiver WebRTC error:", error);
      setErrorMessage("Could not establish the direct file connection."); setStatus("connection-error");
    }
  }

  async function handleSignal(data: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    if (!pcRef.current) {
      const signaling = signalingRef.current;
      if (!signaling) throw new Error("Signaling unavailable");
      const pc = createPeerConnection(
        (signal) => signaling.sendSignal(signal),
        (state) => {
          console.log("Receiver WebRTC state:", state);
          if (state === "failed" || state === "disconnected" || state === "closed") {
            setErrorMessage("Peer connection was interrupted."); setStatus("connection-error");
          }
        },
      );
      pcRef.current = pc;
      pc.ondatachannel = (event) => setupDataChannel(event.channel);
    }

    const pc = pcRef.current;
    if (!pc) return;

    if ((data as RTCSessionDescriptionInit).type === "offer") {
      await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
      for (const candidate of remoteCandidatesRef.current.splice(0)) {
        await addRemoteCandidate(pc, candidate);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (pc.localDescription) signalingRef.current?.sendSignal(pc.localDescription.toJSON());
    } else if ((data as RTCIceCandidateInit).candidate !== undefined) {
      if (pc.remoteDescription) {
        await addRemoteCandidate(pc, data as RTCIceCandidateInit);
      } else {
        remoteCandidatesRef.current.push(data as RTCIceCandidateInit);
      }
    }
  }

  function setupDataChannel(channel: RTCDataChannel) {
    channelRef.current = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => setStatus("waiting-for-sender");
    channel.onmessage = (event) => void handleData(event.data);
    channel.onerror = (event) => {
      console.error("Receiver data channel error:", event);
      setErrorMessage("The file connection failed."); setStatus("connection-error");
    };
  }

  async function handleData(data: unknown) {
    if (data instanceof ArrayBuffer) {
      receiveChunk(data); return;
    }
    if (data instanceof Blob) {
      receiveChunk(await data.arrayBuffer()); return;
    }
    if (typeof data !== "string") return;

    const message = JSON.parse(data) as ControlMessage;
    switch (message.type) {
      case "transfer-start":
        totalBytesRef.current = message.totalBytes;
        totalReceivedRef.current = 0;
        expectedFilesRef.current = message.fileCount;
        receivedFilesRef.current = 0;
        setFiles([]); setOverallProgress(0); setStatus("receiving");
        break;
      case "file-start":
        currentFileRef.current = {
          id: nextId(), name: message.fileName, size: message.fileSize,
          type: message.fileType, chunks: [], received: 0,
        };
        setStatus("receiving");
        break;
      case "file-complete":
        await finishCurrentFile();
        break;
      case "transfer-complete":
        if (receivedFilesRef.current !== expectedFilesRef.current || totalReceivedRef.current !== totalBytesRef.current) {
          setErrorMessage("Transfer verification failed: the received data is incomplete.");
          setStatus("connection-error");
          return;
        }
        setOverallProgress(100);
        setStatus("complete");
        channelRef.current?.send(JSON.stringify({ type: "transfer-ack" }));
        break;
      case "transfer-cancelled":
        currentFileRef.current = null;
        setErrorMessage("The sender cancelled the transfer.");
        setStatus("connection-error");
        break;
    }
  }

  function receiveChunk(data: ArrayBuffer) {
    const current = currentFileRef.current;
    if (!current) return;
    current.chunks.push(data);
    current.received += data.byteLength;
    totalReceivedRef.current += data.byteLength;
    const total = totalBytesRef.current;
    setOverallProgress(total ? Math.min(100, Math.round((totalReceivedRef.current / total) * 100)) : 0);
  }

  async function finishCurrentFile() {
    const current = currentFileRef.current;
    if (!current) throw new Error("Missing file metadata.");
    if (current.received !== current.size) throw new Error(`File size mismatch for ${current.name}.`);

    const blob = new Blob(current.chunks, { type: current.type || "application/octet-stream" });
    if (blob.size !== current.size) throw new Error(`Blob size mismatch for ${current.name}.`);
    const url = URL.createObjectURL(blob);
    downloadUrlsRef.current.set(current.id, url);
    setFiles((prev) => [...prev, { id: current.id, name: current.name, size: current.size, type: current.type, progress: 100 }]);
    receivedFilesRef.current += 1;
    currentFileRef.current = null;
  }

  function handleDownloadOne(id: string) {
    const file = files.find((f) => f.id === id);
    const url = downloadUrlsRef.current.get(id);
    if (!file || !url) return;
    const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  }

  function handleDownloadAll() {
    for (const file of files) handleDownloadOne(file.id);
  }

  function handleReset() {
    cleanup(); clearDownloadUrls();
    setStatus("empty"); setDigits(""); setFiles([]); setOverallProgress(0); setErrorMessage(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const canConnect = isValidRoomCode(digits);
  const showCodeEntry = ["empty", "typing", "connecting", "invalid-code", "room-expired", "connection-error"].includes(status);

  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover sm:p-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Receive</h2>
      <div className="mt-5 flex flex-1 flex-col gap-4">
        {showCodeEntry && <>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-white py-8">
            <Inbox size={26} strokeWidth={1.5} className="text-muted"/>
            <p className="text-[15px] font-medium text-ink">Enter the 4-digit code</p>
            <input ref={inputRef} inputMode="numeric" value={digits} onChange={(e) => handleDigitsChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && canConnect && handleConnect()} placeholder="0000" aria-label="4-digit room code" disabled={status === "connecting"} className="w-40 rounded-xl border border-line bg-white px-3 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-ink placeholder:text-[#dddddd] focus:border-rose-400 focus:ring-2 focus:ring-rose-100"/>
          </div>
          {status === "invalid-code" && <p className="flex items-center justify-center gap-1.5 text-sm text-rust-500"><AlertTriangle size={14}/>{errorMessage}</p>}
          {status === "room-expired" && <p className="flex items-center justify-center gap-1.5 text-sm text-rust-500"><Clock size={14}/>{errorMessage}</p>}
          {status === "connection-error" && <p className="flex items-center justify-center gap-1.5 text-sm text-rust-500"><WifiOff size={14}/>{errorMessage}</p>}
          <button onClick={handleConnect} disabled={!canConnect || status === "connecting"} className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white enabled:hover:bg-rose-600 disabled:bg-[#eeeeee] disabled:text-[#aaaaaa]">
            {status === "connecting" ? <><Loader2 size={15} className="animate-spin"/>Connecting…</> : "Receive"}
          </button>
        </>}
        {status === "waiting-for-sender" && <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center"><Loader2 size={22} className="animate-spin text-muted"/><p className="text-sm text-muted">Connected — waiting for files…</p></div>}
        {status === "receiving" && <><TransferProgress label="Receiving directly from sender" percent={overallProgress}/><FileList files={files} variant="receiver" onDownload={handleDownloadOne}/><p className="text-center text-xs text-muted">Receiving {formatBytes(totalBytesRef.current)}</p></>}
        {status === "complete" && <div className="flex flex-1 flex-col gap-4"><div className="flex flex-col items-center justify-center gap-3 py-5 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-moss-500/10"><CheckCircle2 size={24} className="text-moss-500"/></div><p className="text-[15px] font-medium">Transfer complete</p><p className="text-sm text-muted">{files.length} {files.length === 1 ? "file" : "files"} received</p></div><FileList files={files} onDownload={handleDownloadOne} variant="receiver"/><button onClick={handleDownloadAll} className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600"><Download size={15}/>Download All</button><button onClick={handleReset} className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-medium hover:bg-rose-50"><RotateCcw size={13}/>Receive more files</button></div>}
      </div>
    </div>
  );
}
