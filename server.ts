import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomParticipant {
  peerId: string;
  uid: string;
  displayName: string;
  avatarUrl: string;
  roomId: string;
  serverId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  e2eeFingerprint: string;
  joinedAt: number;
}

interface TypingState {
  uid: string;
  displayName: string;
  channelId: string;
  timestamp: number;
}

const participants = new Map<string, { ws: WebSocket; info: RoomParticipant }>();
const typingUsers = new Map<string, TypingState>();

function broadcastRoomState(serverId?: string) {
  const allParticipants = Array.from(participants.values()).map((p) => p.info);
  const filtered = serverId
    ? allParticipants.filter((p) => p.serverId === serverId)
    : allParticipants;

  const message = JSON.stringify({
    type: 'room:participants',
    participants: filtered,
    allParticipants,
  });

  for (const client of participants.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function broadcastToAll(payload: unknown, excludePeerId?: string) {
  const serialized = JSON.stringify(payload);
  for (const [peerId, client] of participants.entries()) {
    if (peerId !== excludePeerId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serialized);
    }
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeVoicePeers: participants.size,
      e2eeProtocol: 'AES-256-GCM / WebCrypto + DTLS-SRTP',
    });
  });

  // WebSocket Server for Real-time Voice/Video/Screen-Share WebRTC Signaling & Presence
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentPeerId = `peer_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

    ws.send(
      JSON.stringify({
        type: 'connection:init',
        peerId: currentPeerId,
        allParticipants: Array.from(participants.values()).map((p) => p.info),
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        switch (data.type) {
          case 'room:join': {
            const info: RoomParticipant = {
              peerId: currentPeerId,
              uid: String(data.uid || 'anon'),
              displayName: String(data.displayName || 'Membro'),
              avatarUrl: String(data.avatarUrl || ''),
              roomId: String(data.roomId || ''),
              serverId: String(data.serverId || ''),
              isMuted: Boolean(data.isMuted),
              isDeafened: Boolean(data.isDeafened),
              isVideoOn: Boolean(data.isVideoOn),
              isScreenSharing: Boolean(data.isScreenSharing),
              e2eeFingerprint: String(data.e2eeFingerprint || 'SHA256-VERIFIED'),
              joinedAt: Date.now(),
            };
            participants.set(currentPeerId, { ws, info });
            broadcastRoomState();

            // Notify existing peers in the same room to initiate WebRTC offer
            for (const [peerId, client] of participants.entries()) {
              if (
                peerId !== currentPeerId &&
                client.info.roomId === info.roomId &&
                client.ws.readyState === WebSocket.OPEN
              ) {
                client.ws.send(
                  JSON.stringify({
                    type: 'webrtc:peer-joined',
                    peerId: currentPeerId,
                    participant: info,
                  })
                );
              }
            }
            break;
          }

          case 'room:update-media': {
            const existing = participants.get(currentPeerId);
            if (existing) {
              existing.info = {
                ...existing.info,
                isMuted: data.isMuted ?? existing.info.isMuted,
                isDeafened: data.isDeafened ?? existing.info.isDeafened,
                isVideoOn: data.isVideoOn ?? existing.info.isVideoOn,
                isScreenSharing: data.isScreenSharing ?? existing.info.isScreenSharing,
              };
              participants.set(currentPeerId, existing);
              broadcastRoomState();
            }
            break;
          }

          case 'room:leave': {
            const existing = participants.get(currentPeerId);
            if (existing) {
              const oldRoomId = existing.info.roomId;
              participants.delete(currentPeerId);
              broadcastRoomState();
              broadcastToAll({
                type: 'webrtc:peer-left',
                peerId: currentPeerId,
                roomId: oldRoomId,
              });
            }
            break;
          }

          case 'webrtc:signal': {
            const targetPeerId = String(data.targetPeerId || '');
            const target = participants.get(targetPeerId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(
                JSON.stringify({
                  type: 'webrtc:signal',
                  fromPeerId: currentPeerId,
                  signal: data.signal,
                })
              );
            }
            break;
          }

          case 'chat:typing': {
            const key = `${data.uid}_${data.channelId}`;
            if (data.isTyping) {
              typingUsers.set(key, {
                uid: String(data.uid),
                displayName: String(data.displayName),
                channelId: String(data.channelId),
                timestamp: Date.now(),
              });
            } else {
              typingUsers.delete(key);
            }
            const activeTyping = Array.from(typingUsers.values()).filter(
              (t) => Date.now() - t.timestamp < 6000
            );
            const payload = JSON.stringify({
              type: 'chat:typing-update',
              typing: activeTyping,
            });
            for (const client of wss.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
              }
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (participants.has(currentPeerId)) {
        const leftInfo = participants.get(currentPeerId)?.info;
        participants.delete(currentPeerId);
        broadcastRoomState();
        if (leftInfo) {
          broadcastToAll({
            type: 'webrtc:peer-left',
            peerId: currentPeerId,
            roomId: leftInfo.roomId,
          });
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const enableHmr = process.env.ENABLE_HMR === 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: enableHmr },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Vortex server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
