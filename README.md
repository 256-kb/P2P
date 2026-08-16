# 🚀 Snapdrop P2P — WebRTC File Sharing via Cloudflare Workers & Durable Objects

A complete, private, serverless peer-to-peer file sharing web application built with **WebRTC `RTCDataChannel`** and **Cloudflare Workers Durable Objects** for WebSocket signaling.

---

## 📦 Project Structure

```
snapdrop-p2p/
├── worker/
│   └── worker.js         # Cloudflare Worker + Durable Objects WebSocket Signaling Server
├── client/
│   └── index.html        # Single self-contained HTML/CSS/JS client
├── wrangler.toml         # Cloudflare Workers configuration with DO bindings & Assets
├── package.json          # Project scripts
└── README.md             # Documentation & deployment guide
```

---

## ⚡ Key Features

1. **Direct P2P Data Transfer**: Files stream directly browser-to-browser via WebRTC Data Channels (chunked 64KB slices with backpressure control) without touching any middle server.
2. **Durable Objects Room Isolation**: Cloudflare Durable Objects coordinate real-time WebSocket signaling (peer discovery, SDP offer/answers, ICE candidates) grouped by room.
3. **Snapdrop / AirDrop Radar UI**: Real-time peer radar with animated orbit nodes, device type badges (desktop/mobile/tablet), and friendly names.
4. **Drag & Drop / Multi-File**: Drag files anywhere onto the radar or click on a specific peer node.
5. **Flow Control & Progress HUD**: Live transfer progress, KB/MB speed calculation, and estimated completion time.
6. **Quick Text / Link Sharing**: Right-click on any peer node to instantly send clipboard text or links.

---

## 🛠️ Step-by-Step Deployment Guide

### Prerequisites
- Node.js (v18 or newer)
- A free [Cloudflare Account](https://dash.cloudflare.com/)

### 1. Install Wrangler CLI & Authenticate
```bash
npx wrangler login
```

### 2. Run Locally
Test both the signaling server and the client locally:
```bash
npx wrangler dev
```
Open two separate browser tabs at `http://localhost:8787` to see them discover each other on the radar and transfer files!

### 3. Deploy to Cloudflare Workers
Deploy the worker and client in a single command:
```bash
npx wrangler deploy
```

Wrangler will output your live URL (e.g. `https://snapdrop-p2p.<your-subdomain>.workers.dev`).

---

## 🌐 Custom Client Hosting (Optional)
Because [`client/index.html`](file:///C:/Users/ninoc/.gemini/antigravity/scratch/snapdrop-p2p/client/index.html) is completely standalone, you can also host it anywhere (Cloudflare Pages, GitHub Pages, Vercel, or open directly in your browser):
1. Open the **Settings** gear icon in the client.
2. Paste your deployed Worker signaling URL: `wss://snapdrop-p2p.<your-subdomain>.workers.dev/ws`.
3. Click **Save & Reconnect**.
