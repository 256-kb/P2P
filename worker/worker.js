/**
 * Cloudflare Worker + Durable Objects WebSocket Signaling Server for P2P
 */

export class SignalingRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket Upgrade header", {
        status: 426,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
          "Surrogate-Control": "no-store"
        }
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (this.ctx.acceptWebSocket) {
      this.ctx.acceptWebSocket(server);
    } else {
      server.accept();
    }

    const tempId = crypto.randomUUID();
    this.sessions.set(server, {
      peerId: tempId,
      name: "Device",
      device: { type: "desktop", os: "Unknown", browser: "Browser" },
      joined: false,
      lastSeen: Date.now()
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  getUniqueName(baseName, excludeWs) {
    const existingNames = new Set();
    for (const [ws, session] of this.sessions.entries()) {
      if (ws !== excludeWs && session.joined) {
        existingNames.add(session.name.toLowerCase());
      }
    }

    if (!existingNames.has(baseName.toLowerCase())) {
      return baseName;
    }

    let counter = 2;
    while (existingNames.has(`${baseName} (${counter})`.toLowerCase())) {
      counter++;
    }
    return `${baseName} (${counter})`;
  }

  async webSocketMessage(ws, message) {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
      const session = this.sessions.get(ws);
      if (!session) return;

      session.lastSeen = Date.now();

      switch (data.type) {
        case "join": {
          const requestedId = data.peerId || session.peerId || crypto.randomUUID();
          
          // Nettoyer toute ancienne session avec le même peerId
          for (const [sWs, sData] of this.sessions.entries()) {
            if (sWs !== ws && sData.peerId === requestedId) {
              this.sessions.delete(sWs);
              try { sWs.close(1000, "Reconnected elsewhere"); } catch (e) {}
            }
          }

          session.peerId = requestedId;
          const requestedName = (data.name || "Device").trim();
          session.name = this.getUniqueName(requestedName, ws);
          session.device = data.device || { type: "desktop", os: "Unknown", browser: "Browser" };
          session.joined = true;
          session.lastSeen = Date.now();

          const existingPeers = [];
          for (const [peerWs, peerSession] of this.sessions.entries()) {
            if (peerWs !== ws && peerSession.joined) {
              existingPeers.push({
                peerId: peerSession.peerId,
                name: peerSession.name,
                device: peerSession.device,
              });
            }
          }

          this.safeSend(ws, {
            type: "joined",
            peerId: session.peerId,
            assignedName: session.name,
            peers: existingPeers,
          });

          this.broadcast(
            {
              type: "peer-joined",
              peer: {
                peerId: session.peerId,
                name: session.name,
                device: session.device,
              },
            },
            ws
          );
          break;
        }

        case "sync": {
          session.lastSeen = Date.now();
          const existingPeers = [];
          for (const [peerWs, peerSession] of this.sessions.entries()) {
            if (peerWs !== ws && peerSession.joined) {
              existingPeers.push({
                peerId: peerSession.peerId,
                name: peerSession.name,
                device: peerSession.device,
              });
            }
          }

          this.safeSend(ws, {
            type: "sync-result",
            peerId: session.peerId,
            assignedName: session.name,
            peers: existingPeers,
          });
          break;
        }

        case "signal": {
          const { target, signal } = data;
          if (!target || !signal) return;

          const targetWs = this.findSocketByPeerId(target);
          if (targetWs) {
            this.safeSend(targetWs, {
              type: "signal",
              sender: session.peerId,
              signal: signal,
            });
          }
          break;
        }

        case "ping": {
          session.lastSeen = Date.now();
          this.safeSend(ws, { type: "pong", timestamp: Date.now() });
          break;
        }

        case "pong": {
          session.lastSeen = Date.now();
          break;
        }
      }
    } catch (err) {
      console.error("Error WebSocket message:", err);
    }
  }

  async webSocketClose(ws) {
    this.handleDisconnect(ws);
  }

  async webSocketError(ws, error) {
    this.handleDisconnect(ws);
  }

  handleDisconnect(ws) {
    const session = this.sessions.get(ws);
    if (!session) return;

    this.sessions.delete(ws);
    if (session.joined) {
      this.broadcast({
        type: "peer-left",
        peerId: session.peerId,
      });
    }
  }

  findSocketByPeerId(peerId) {
    for (const [ws, session] of this.sessions.entries()) {
      if (session.peerId === peerId) return ws;
    }
    return null;
  }

  safeSend(ws, data) {
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
        ws.send(JSON.stringify(data));
      }
    } catch (e) {}
  }

  broadcast(data, excludeWs = null) {
    const payload = JSON.stringify(data);
    for (const [ws, session] of this.sessions.entries()) {
      if (ws !== excludeWs && session.joined) {
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
            ws.send(payload);
          }
        } catch (e) {}
      }
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // En-têtes stricts anti-cache pour iOS Safari et navigateurs mobiles
    const noCacheHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Surrogate-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...noCacheHeaders,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (url.pathname === "/ws" || url.pathname.startsWith("/ws/")) {
      let roomId = url.searchParams.get("room") || "general";

      if (!env.ROOM_DO) {
        return new Response("Binding ROOM_DO missing", { status: 500, headers: noCacheHeaders });
      }

      const roomObjectId = env.ROOM_DO.idFromName(roomId);
      const roomObject = env.ROOM_DO.get(roomObjectId);
      return roomObject.fetch(request);
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          ...noCacheHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Si des assets statiques sont configurés via env.ASSETS
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetResponse.headers);
      for (const [key, value] of Object.entries(noCacheHeaders)) {
        newHeaders.set(key, value);
      }
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: newHeaders,
      });
    }

    return new Response("P2P Signaling Server running.", { status: 200, headers: noCacheHeaders });
  },
};
