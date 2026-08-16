// Serveur de test local autonome (Node.js natif sans dépendance externe)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8787;
const sessions = new Map(); // socket -> metadata

const HEARTBEAT_INTERVAL_MS = 10000;
const SESSION_TIMEOUT_MS = 30000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ status: 'ok', activeSessions: sessions.size }));
  }

  const filePath = path.join(__dirname, 'client', 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end('Erreur lors du chargement de index.html');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

// Implémentation WebSocket native
server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
  );

  const roomParam = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('room') || 'general';

  const session = {
    socket,
    peerId: crypto.randomUUID(),
    name: 'Device',
    device: { type: 'desktop', os: 'Unknown', browser: 'Browser' },
    room: roomParam,
    joined: false,
    lastSeen: Date.now()
  };
  sessions.set(socket, session);

  socket.on('data', (buffer) => {
    session.lastSeen = Date.now();
    try {
      const message = decodeWebSocketFrame(buffer);
      if (!message) return;

      const data = JSON.parse(message);
      handleMessage(session, data);
    } catch (e) {}
  });

  socket.on('close', () => handleDisconnect(session));
  socket.on('error', () => handleDisconnect(session));
});

// Watchdog de purge des sockets inactifs (ex: mobile éteint sans TCP FIN)
setInterval(() => {
  const now = Date.now();
  for (const [socket, session] of sessions.entries()) {
    if (now - session.lastSeen > SESSION_TIMEOUT_MS) {
      console.log(`[Watchdog] Terminating stale session for ${session.name} (${session.peerId})`);
      sessions.delete(socket);
      try { socket.destroy(); } catch(e) {}
      if (session.joined) {
        broadcastInRoom(session.room, { type: 'peer-left', peerId: session.peerId }, session);
      }
    } else if (session.joined) {
      // Envoyer un ping de contrôle
      sendWs(socket, { type: 'ping', timestamp: now });
    }
  }
}, HEARTBEAT_INTERVAL_MS);

function getUniqueNameInRoom(room, baseName, excludeSession = null) {
  const existingNames = new Set();
  for (const [_, s] of sessions) {
    if (s !== excludeSession && s.joined && s.room === room) {
      existingNames.add(s.name.toLowerCase());
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

function handleMessage(session, data) {
  switch (data.type) {
    case 'join': {
      const requestedId = data.peerId || session.peerId;
      
      // Fermer toute ancienne socket fantôme ayant le même peerId
      for (const [sSocket, sData] of sessions) {
        if (sData !== session && sData.peerId === requestedId) {
          sessions.delete(sSocket);
          try { sSocket.destroy(); } catch(e) {}
        }
      }

      session.peerId = requestedId;
      const requestedName = (data.name || 'Device').trim();
      session.name = getUniqueNameInRoom(session.room, requestedName, session);
      session.device = data.device || session.device;
      session.joined = true;
      session.lastSeen = Date.now();

      const peersInRoom = [];
      for (const [_, s] of sessions) {
        if (s !== session && s.joined && s.room === session.room) {
          peersInRoom.push({
            peerId: s.peerId,
            name: s.name,
            device: s.device
          });
        }
      }

      sendWs(session.socket, {
        type: 'joined',
        peerId: session.peerId,
        assignedName: session.name,
        peers: peersInRoom
      });

      broadcastInRoom(
        session.room,
        {
          type: 'peer-joined',
          peer: {
            peerId: session.peerId,
            name: session.name,
            device: session.device
          }
        },
        session
      );
      break;
    }

    case 'sync': {
      // Re-synchronisation demandée par un mobile au réveil
      session.lastSeen = Date.now();
      const peersInRoom = [];
      for (const [_, s] of sessions) {
        if (s !== session && s.joined && s.room === session.room) {
          peersInRoom.push({
            peerId: s.peerId,
            name: s.name,
            device: s.device
          });
        }
      }

      sendWs(session.socket, {
        type: 'sync-result',
        peerId: session.peerId,
        assignedName: session.name,
        peers: peersInRoom
      });
      break;
    }

    case 'signal': {
      session.lastSeen = Date.now();
      const { target, signal } = data;
      if (!target || !signal) break;

      for (const [_, s] of sessions) {
        if (s.peerId === target && s.room === session.room) {
          sendWs(s.socket, {
            type: 'signal',
            sender: session.peerId,
            signal: signal
          });
          break;
        }
      }
      break;
    }

    case 'ping': {
      session.lastSeen = Date.now();
      sendWs(session.socket, { type: 'pong', timestamp: Date.now() });
      break;
    }

    case 'pong': {
      session.lastSeen = Date.now();
      break;
    }
  }
}

function handleDisconnect(session) {
  if (sessions.has(session.socket)) {
    sessions.delete(session.socket);
    if (session.joined) {
      broadcastInRoom(
        session.room,
        {
          type: 'peer-left',
          peerId: session.peerId
        },
        session
      );
    }
  }
}

function broadcastInRoom(room, data, excludeSession = null) {
  for (const [_, s] of sessions) {
    if (s !== excludeSession && s.joined && s.room === room) {
      sendWs(s.socket, data);
    }
  }
}

function sendWs(socket, data) {
  try {
    const payload = Buffer.from(JSON.stringify(data));
    const length = payload.length;
    let header;

    if (length <= 125) {
      header = Buffer.from([0x81, length]);
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    socket.write(Buffer.concat([header, payload]));
  } catch (e) {}
}

function decodeWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;
  const isMasked = (buffer[1] & 0x80) === 0x80;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  let maskKey = null;
  if (isMasked) {
    maskKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.slice(offset, offset + length);
  if (isMasked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return payload.toString('utf-8');
}

server.listen(PORT, () => {
  console.log(`\n🚀 P2P Signaling Server running on http://localhost:${PORT}`);
});
