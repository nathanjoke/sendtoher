import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || process.env.SIGNALING_PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const ROOM_TTL = 10 * 60 * 1000;
const RATE_WINDOW = 60_000;
const MAX_ACTIONS_PER_IP = 30;

interface Room {
  code: string;
  sender: WebSocket;
  receiver?: WebSocket;
  createdAt: number;
  expiresAt: number;
}

const rooms = new Map<string, Room>();
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function send(ws: WebSocket | undefined, message: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function allowAction(ip: string) {
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || now >= current.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (current.count >= MAX_ACTIONS_PER_IP) return false;
  current.count += 1;
  return true;
}

function generateCode() {
  let code = "";
  do {
    code = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  } while (rooms.has(code));
  return code;
}

function findRoomBySocket(ws: WebSocket) {
  for (const room of rooms.values()) {
    if (room.sender === ws || room.receiver === ws) return room;
  }
  return undefined;
}

function isValidSignal(data: unknown) {
  if (!data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  return value.type === "offer" || value.type === "answer" || value.candidate !== undefined;
}

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server: httpServer, maxPayload: 256 * 1024 });

httpServer.on("error", (error) => console.error("HTTP server error:", error));
wss.on("error", (error) => console.error("WebSocket server error:", error));

wss.on("connection", (ws, req) => {
  const ip = getClientIp(req);
  console.log(`Client connected (${ip})`);

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;

      if (message.type === "create-room" || message.type === "join-room") {
        if (!allowAction(ip)) {
          send(ws, { type: "connection-error", message: "Too many requests. Please try again later." });
          return;
        }
      }

      if (message.type === "create-room") {
        const code = generateCode();
        const now = Date.now();
        const room: Room = { code, sender: ws, createdAt: now, expiresAt: now + ROOM_TTL };
        rooms.set(code, room);
        send(ws, { type: "room-created", code, expiresAt: room.expiresAt });
        console.log(`Room ${code} created`);
        return;
      }

      if (message.type === "join-room") {
        const code = String(message.code ?? "");
        if (!/^\d{4}$/.test(code)) {
          send(ws, { type: "room-not-found" });
          return;
        }
        const room = rooms.get(code);
        if (!room) {
          send(ws, { type: "room-not-found" });
          return;
        }
        if (Date.now() > room.expiresAt) {
          rooms.delete(code);
          send(ws, { type: "room-expired" });
          return;
        }
        if (room.sender === ws || room.receiver) {
          send(ws, { type: "room-full" });
          return;
        }
        room.receiver = ws;
        send(ws, { type: "room-joined", code });
        send(room.sender, { type: "receiver-connected" });
        console.log(`Receiver joined room ${code}`);
        return;
      }

      if (message.type === "signal") {
        if (!isValidSignal(message.data)) {
          send(ws, { type: "connection-error", message: "Invalid WebRTC signal." });
          return;
        }
        const room = findRoomBySocket(ws);
        if (!room || !room.receiver) {
          send(ws, { type: "connection-error", message: "Room connection is not ready." });
          return;
        }
        const target = room.sender === ws ? room.receiver : room.sender;
        send(target, { type: "signal", data: message.data });
        return;
      }

      send(ws, { type: "connection-error", message: "Unknown message type." });
    } catch (error) {
      console.error("Invalid message:", error);
      send(ws, { type: "connection-error", message: "Invalid message." });
    }
  });

  ws.on("close", () => {
    const room = findRoomBySocket(ws);
    console.log("Client disconnected");
    if (!room) return;
    if (room.sender === ws) {
      send(room.receiver, { type: "connection-error", message: "Sender disconnected." });
      rooms.delete(room.code);
      console.log(`Room ${room.code} deleted`);
      return;
    }
    if (room.receiver === ws) {
      room.receiver = undefined;
      send(room.sender, { type: "connection-error", message: "Receiver disconnected." });
    }
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`SendToHer signaling server listening on ${HOST}:${PORT}`);
});

const shutdown = () => {
  console.log("Shutting down signaling server...");
  for (const client of wss.clients) client.close(1001, "Server shutting down");
  wss.close(() => httpServer.close(() => process.exit(0)));
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now > room.expiresAt) {
      send(room.sender, { type: "room-expired" });
      send(room.receiver, { type: "room-expired" });
      rooms.delete(code);
      console.log(`Room ${code} expired`);
    }
  }
  for (const [ip, entry] of rateLimits.entries()) {
    if (now >= entry.resetAt) rateLimits.delete(ip);
  }
}, 30_000).unref();
