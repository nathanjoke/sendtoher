export type SignalData =
  | RTCSessionDescriptionInit
  | RTCIceCandidateInit;

export type ClientMessage =
  | { type: "create-room" }
  | { type: "join-room"; code: string }
  | { type: "signal"; data: SignalData };

export type ServerMessage =
  | { type: "room-created"; code: string; expiresAt: number }
  | { type: "room-joined"; code: string }
  | { type: "receiver-connected" }
  | { type: "signal"; data: SignalData }
  | { type: "room-not-found" }
  | { type: "room-expired" }
  | { type: "room-full" }
  | { type: "connection-error"; message: string };
