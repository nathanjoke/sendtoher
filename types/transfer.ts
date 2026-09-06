/**
 * Shared types for Stage 1 (UI + mock states).
 * These are intentionally transport-agnostic so Stage 2+ can swap the
 * mock logic in lib/file-transfer.ts for real room/WebRTC logic without
 * touching the components.
 */

export interface TransferFile {
  id: string;
  name: string;
  size: number; // bytes
  type: string;
  file?: File; // present on the sender side only
  progress?: number; // 0-100, used during sending/receiving
}

export type SenderStatus =
  | "empty"
  | "dragging"
  | "selected"
  | "creating-room"
  | "waiting-for-receiver"
  | "receiver-connected"
  | "sending"
  | "complete"
  | "error";

export type ReceiverStatus =
  | "empty"
  | "typing"
  | "connecting"
  | "waiting-for-sender"
  | "files-available"
  | "receiving"
  | "complete"
  | "invalid-code"
  | "room-expired"
  | "connection-error";

export interface TransferRoom {
  code: string; // exactly 4 digits, "0000"-"9999"
  files: TransferFile[];
  createdAt: number;
  expiresAt: number; // createdAt + 10 minutes
}
