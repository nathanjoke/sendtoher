import type { ClientMessage, ServerMessage } from "@/types/signaling";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:3001";

export class SignalingClient {
  private socket: WebSocket | null = null;
  private messageCallback: ((message: ServerMessage) => void) | null = null;

  connect(onOpen?: () => void, onError?: (error: Event) => void) {
    this.socket = new WebSocket(SIGNALING_URL);

    this.socket.onopen = () => {
      console.log("Signaling connected");
      onOpen?.();
    };

    this.socket.onerror = (event) => {
      console.error("Signaling error:", event);
      onError?.(event);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        console.log("Signaling message:", message);
        this.messageCallback?.(message);
      } catch (error) {
        console.error("Invalid signaling message:", error);
      }
    };

    this.socket.onclose = () => console.log("Signaling disconnected");
  }

  onMessage(callback: (message: ServerMessage) => void) {
    this.messageCallback = callback;
  }

  send(message: ClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected.");
    }
    this.socket.send(JSON.stringify(message));
  }

  createRoom() {
    this.send({ type: "create-room" });
  }

  joinRoom(code: string) {
    this.send({ type: "join-room", code });
  }

  sendSignal(data: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    this.send({ type: "signal", data });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}
