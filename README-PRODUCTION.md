# SendToHer — Production Deployment

SendToHer uses two deployable parts:

- **Next.js frontend:** Vercel
- **WebSocket signaling server:** Render
- **File data:** WebRTC peer-to-peer between browsers; the signaling server does not store or relay file bytes.

## 1. Push this project to GitHub

Create a GitHub repository and push the contents of this folder.
Do not commit `.env.local` or real TURN credentials.

## 2. Deploy signaling to Render

The included `render.yaml` configures a Node Web Service.

On Render, create a new Blueprint from the GitHub repository, or create a Web Service manually with:

- Runtime: Node
- Build command: `npm ci && npm run build:signaling`
- Start command: `npm run start:signaling`
- Health check path: `/healthz`

Render provides `PORT` automatically. The server binds to `0.0.0.0` and supports WebSocket connections.

After deployment, copy the Render URL, for example:

`wss://sendtoher-signaling.onrender.com`

## 3. Deploy frontend to Vercel

Import the same GitHub repository into Vercel.

Add this environment variable in the Vercel project settings:

`NEXT_PUBLIC_SIGNALING_URL=wss://YOUR-RENDER-SERVICE.onrender.com`

Then deploy.

For local development, keep `.env.local` as:

`NEXT_PUBLIC_SIGNALING_URL=ws://localhost:3001`

Run the two processes separately:

```bash
npm run signaling
npm run dev
```

## 4. Optional TURN

STUN is included by default. Some restrictive NAT/firewall combinations need TURN.

Set the optional variables shown in `.env.production.example` in Vercel. TURN credentials are sent to the browser, so production systems should use temporary/ephemeral credentials rather than permanent secrets.

## 5. Production behavior

- 4-digit room codes
- One sender + one receiver per room
- 10-minute room expiration
- Basic per-IP create/join rate limiting
- WebRTC direct file transfer
- Reliable ordered data channel
- Backpressure handling to avoid `RTCDataChannel send queue is full`
- Up to 5 GB total selected files in the current UI
- No file storage on the signaling server
- Health endpoint at `/healthz`

## 6. Important limitation

The signaling server currently stores rooms only in memory and is designed for a single Render instance. Do not scale it horizontally unless room/session state is moved to shared storage or sticky routing is introduced.

A free Render service may sleep when idle depending on the current Render plan. For a consistently responsive public service, use an always-on service.
