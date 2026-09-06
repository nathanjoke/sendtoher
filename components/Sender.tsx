"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle, RotateCcw, X } from "lucide-react";
import FileDropzone from "./FileDropzone";
import FileList from "./FileList";
import CodeDisplay from "./CodeDisplay";
import TransferProgress from "./TransferProgress";
import type { SenderStatus, TransferFile } from "@/types/transfer";
import type { ServerMessage } from "@/types/signaling";
import { SignalingClient } from "@/lib/signaling-client";
import { addRemoteCandidate, createPeerConnection } from "@/lib/peer-connection";

const CHUNK_SIZE = 128 * 1024;
const BUFFER_HIGH_WATERMARK = 1 * 1024 * 1024;
const BUFFER_LOW_WATERMARK = 256 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
let idCounter = 0;
const nextId = () => `send-${++idCounter}`;

type ControlMessage =
  | { type: "transfer-start"; totalBytes: number; fileCount: number }
  | { type: "file-start"; fileName: string; fileSize: number; fileType: string }
  | { type: "file-complete" }
  | { type: "transfer-complete" }
  | { type: "transfer-cancelled" };

export default function Sender() {
  const [status, setStatus] = useState<SenderStatus>("empty");
  const [files, setFiles] = useState<TransferFile[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signalingRef = useRef<SignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const transferStartedRef = useRef(false);
  const remoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    channelRef.current?.close();
    pcRef.current?.close();
    signalingRef.current?.disconnect();
    channelRef.current = null;
    pcRef.current = null;
    signalingRef.current = null;
    transferStartedRef.current = false;
    remoteCandidatesRef.current = [];
  }

  function handleFilesSelected(newFiles: File[]) {
    const next = newFiles.map((file) => ({
      id: nextId(), name: file.name, size: file.size, type: file.type, file,
    }));
    const total = [...files, ...next].reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setErrorMessage("Total file size cannot exceed 5 GB.");
      return;
    }
    setFiles((prev) => [...prev, ...next]);
    setErrorMessage(null);
    setStatus("selected");
  }

  function handleRemoveFile(id: string) {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (!next.length) setStatus("empty");
      return next;
    });
  }

  function sendControl(message: ControlMessage) {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") throw new Error("Peer connection is not ready.");
    channel.send(JSON.stringify(message));
  }

  function setupPeer() {
    const signaling = signalingRef.current;
    if (!signaling) throw new Error("Signaling connection is not available.");

    pcRef.current?.close();
    const pc = createPeerConnection(
      (data) => signaling.sendSignal(data),
      (state) => {
        console.log("Sender WebRTC state:", state);
        if (state === "failed" || state === "disconnected" || state === "closed") {
          if (status === "sending") {
            setErrorMessage("Peer connection was interrupted.");
            setStatus("error");
          }
        }
      },
    );
    pcRef.current = pc;

    const channel = pc.createDataChannel("files", { ordered: true });
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = BUFFER_LOW_WATERMARK;
    channelRef.current = channel;

    channel.onopen = () => {
      console.log("WebRTC data channel open");
      if (!transferStartedRef.current) {
        transferStartedRef.current = true;
        void handleStartTransfer();
      }
    };
    channel.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as { type: string };
        if (message.type === "transfer-ack") {
          setOverallProgress(100);
          setStatus("complete");
        } else if (message.type === "transfer-cancelled") {
          setErrorMessage("The receiver cancelled the transfer.");
          setStatus("error");
        }
      } catch {
        // Ignore unknown control messages.
      }
    };
    channel.onerror = (event) => {
      console.error("Data channel error:", event);
      setErrorMessage("File connection failed.");
      setStatus("error");
    };

    return pc;
  }

  async function createOffer() {
    const pc = setupPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (pc.localDescription) signalingRef.current?.sendSignal(pc.localDescription.toJSON());
  }

  function handleSend() {
    if (!files.length) return;
    setStatus("creating-room");
    setErrorMessage(null);
    setCode(null);
    setOverallProgress(0);
    cleanup();

    const client = new SignalingClient();
    signalingRef.current = client;
    client.onMessage((message: ServerMessage) => void handleSignalingMessage(message));
    client.connect(
      () => client.createRoom(),
      () => {
        setErrorMessage("Could not connect to the signaling server.");
        setStatus("error");
      },
    );
  }

  async function handleSignalingMessage(message: ServerMessage) {
    const pc = pcRef.current;
    try {
      switch (message.type) {
        case "room-created":
          setCode(message.code);
          setStatus("waiting-for-receiver");
          break;
        case "receiver-connected":
          setStatus("receiver-connected");
          await createOffer();
          break;
        case "signal": {
          if (!pcRef.current) return;
          const data = message.data as RTCSessionDescriptionInit & RTCIceCandidateInit;
          if (data.type === "answer") {
            await pcRef.current.setRemoteDescription(data);
            for (const candidate of remoteCandidatesRef.current.splice(0)) {
              await addRemoteCandidate(pcRef.current, candidate);
            }
          } else if (data.candidate !== undefined) {
            if (pcRef.current.remoteDescription) {
              await addRemoteCandidate(pcRef.current, data);
            } else {
              remoteCandidatesRef.current.push(data);
            }
          }
          break;
        }
        case "room-expired":
          setErrorMessage("This room has expired. Please create a new room.");
          setStatus("error");
          break;
        case "connection-error":
          setErrorMessage(message.message);
          setStatus("error");
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("WebRTC signaling error:", error);
      setErrorMessage("Could not establish the direct file connection.");
      setStatus("error");
    }
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  async function waitForBuffer(channel: RTCDataChannel) {
    while (channel.readyState === "open" && channel.bufferedAmount >= BUFFER_HIGH_WATERMARK) {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          channel.removeEventListener("bufferedamountlow", onLow);
          channel.removeEventListener("close", onClose);
          channel.removeEventListener("error", onError);
        };
        const finish = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error("WebRTC data channel closed during transfer."));
        };
        const onLow = () => {
          if (channel.bufferedAmount <= BUFFER_LOW_WATERMARK) finish();
        };
        const onClose = () => fail();
        const onError = () => fail();
        channel.addEventListener("bufferedamountlow", onLow);
        channel.addEventListener("close", onClose);
        channel.addEventListener("error", onError);
        if (channel.bufferedAmount <= BUFFER_LOW_WATERMARK) finish();
        void sleep(50).then(() => {
          if (!settled && channel.bufferedAmount < BUFFER_HIGH_WATERMARK) finish();
        });
      });
    }
  }

  async function sendBinaryChunk(channel: RTCDataChannel, buffer: ArrayBuffer) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await waitForBuffer(channel);
      if (channel.readyState !== "open") throw new Error("WebRTC data channel is not open.");
      try {
        channel.send(buffer);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "OperationError") {
          await sleep(Math.min(50, 5 + attempt * 2));
          continue;
        }
        throw error;
      }
    }
    throw new Error("WebRTC send queue remained full.");
  }

  async function handleStartTransfer() {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open" || !files.length) return;

    try {
      setStatus("sending");
      setOverallProgress(0);
      const validFiles = files.filter((f) => !!f.file);
      const totalBytes = validFiles.reduce((sum, f) => sum + f.size, 0);
      sendControl({ type: "transfer-start", totalBytes, fileCount: validFiles.length });

      let totalSent = 0;
      for (const transferFile of validFiles) {
        const file = transferFile.file!;
        sendControl({ type: "file-start", fileName: file.name, fileSize: file.size, fileType: file.type });

        let offset = 0;
        while (offset < file.size) {
          const chunk = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await chunk.arrayBuffer();
          await waitForBuffer(channel);
          await sendBinaryChunk(channel, buffer);
          offset += buffer.byteLength;
          totalSent += buffer.byteLength;
          setOverallProgress(totalBytes ? Math.round((totalSent / totalBytes) * 100) : 100);
        }
        sendControl({ type: "file-complete" });
      }
      sendControl({ type: "transfer-complete" });
    } catch (error) {
      console.error("File transfer error:", error);
      setErrorMessage("The file transfer failed. Please try again.");
      setStatus("error");
    }
  }

  function handleCancel() {
    try {
      if (channelRef.current?.readyState === "open") sendControl({ type: "transfer-cancelled" });
    } catch {}
    cleanup();
    setStatus(files.length ? "selected" : "empty");
    setOverallProgress(0);
    setErrorMessage(null);
  }

  function handleReset() {
    cleanup();
    setStatus("empty"); setFiles([]); setCode(null); setOverallProgress(0); setErrorMessage(null);
  }

  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover sm:p-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Send</h2>
      <div className="mt-5 flex flex-1 flex-col gap-4">
        {status === "empty" && <FileDropzone onFilesSelected={handleFilesSelected} />}
        {status === "selected" && <>
          <FileDropzone onFilesSelected={handleFilesSelected} />
          <FileList files={files} onRemove={handleRemoveFile} variant="sender" />
          {errorMessage && <p className="text-center text-sm text-rust-500">{errorMessage}</p>}
          <button onClick={handleSend} className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600">
            <Send size={15} /> Send Files
          </button>
        </>}
        {status === "creating-room" && <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10"><Loader2 className="animate-spin text-muted" size={22}/><p className="text-sm text-muted">Creating a secure room…</p></div>}
        {status === "waiting-for-receiver" && code && <><CodeDisplay code={code}/><div className="flex flex-1 items-center justify-center gap-2 py-6 text-sm text-muted"><Loader2 size={18} className="animate-spin"/>Waiting for receiver…</div><button onClick={handleCancel} className="rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-paper"><X size={14} className="mr-1 inline"/>Cancel</button></>}
        {status === "receiver-connected" && <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center"><Loader2 size={22} className="animate-spin text-muted"/><p className="text-sm text-muted">Receiver connected — establishing direct connection…</p></div>}
        {status === "sending" && <><TransferProgress label="Sending directly to receiver" percent={overallProgress}/><FileList files={files.map(f => ({...f, progress: overallProgress}))} variant="sender"/><button onClick={handleCancel} className="flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-paper"><X size={15}/>Cancel transfer</button></>}
        {status === "complete" && <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center"><CheckCircle2 size={42} className="text-moss-500"/><p className="text-[15px] font-medium">Transfer complete</p><p className="text-sm text-muted">The receiver verified all files.</p><button onClick={handleReset} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-paper"><RotateCcw size={14}/>Send more files</button></div>}
        {status === "error" && <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center"><AlertCircle size={34} className="text-rust-500"/><p className="text-sm text-rust-500">{errorMessage ?? "Something went wrong."}</p><button onClick={handleReset} className="rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-paper">Try again</button></div>}
      </div>
    </div>
  );
}
