import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  addChat,
  buildClientState,
  canPlayerTalkInVoice,
  canRelayVoiceSignal,
  createRoom,
  joinRoom,
  pruneDisallowedVoicePeers,
  type ServerRoom,
} from './server/gameEngine.ts';
import {
  handleCastVote,
  handleGmAction,
  handlePlayerNightAction,
} from './server/gmActions.ts';
import type { ClientToServerMessage } from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map<string, ServerRoom>();
const roomLastActivity = new Map<string, number>();
const IDLE_ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function touchRoom(roomCode: string): void {
  roomLastActivity.set(roomCode, Date.now());
}

interface AuthedSocket extends WebSocket {
  roomCode?: string;
  playerId?: string;
  isGM?: boolean;
  isAlivePing?: boolean;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const wss = new WebSocketServer({ noServer: true });

function broadcastRoomState(room: ServerRoom): void {
  touchRoom(room.roomCode);
  for (const client of wss.clients) {
    const ws = client as AuthedSocket;
    if (
      ws.readyState === WebSocket.OPEN &&
      ws.roomCode === room.roomCode &&
      ws.playerId
    ) {
      const playerExists = room.players.has(ws.playerId);
      if (!playerExists) continue;
      const projection = buildClientState(room, ws.playerId, Boolean(ws.isGM));
      ws.send(JSON.stringify({ type: 'STATE_SYNC', payload: projection }));
    }
  }
}

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message } }));
  }
}

function sendToast(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'TOAST', payload: { message } }));
  }
}

function relayRtcSignal(
  roomCode: string,
  fromPlayerId: string,
  toPlayerId: string,
  signal: unknown
): void {
  for (const client of wss.clients) {
    const ws = client as AuthedSocket;
    if (
      ws.readyState === WebSocket.OPEN &&
      ws.roomCode === roomCode &&
      ws.playerId === toPlayerId
    ) {
      ws.send(
        JSON.stringify({
          type: 'RTC_SIGNAL',
          payload: { fromPlayerId, signal },
        })
      );
    }
  }
}

wss.on('connection', (socket) => {
  const ws = socket as AuthedSocket;
  ws.isAlivePing = true;

  ws.on('pong', () => {
    ws.isAlivePing = true;
  });

  ws.on('message', (raw) => {
    let msg: ClientToServerMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientToServerMessage;
    } catch {
      sendError(ws, 'Malformed message.');
      return;
    }

    if (!msg || typeof msg.type !== 'string' || !msg.payload) {
      return;
    }

    if (msg.type === 'AUTH') {
      const roomCode = String(msg.payload.roomCode || '').trim().toUpperCase();
      const sessionToken = String(msg.payload.sessionToken || '');
      const gmSecretToken = msg.payload.gmSecretToken
        ? String(msg.payload.gmSecretToken)
        : '';

      const room = rooms.get(roomCode);
      if (!room) {
        sendError(ws, 'Room not found or has expired.');
        return;
      }

      const player = Array.from(room.players.values()).find((p) =>
        safeEqual(p.sessionToken, sessionToken)
      );
      if (!player) {
        sendError(ws, 'Invalid session token.');
        return;
      }

      const isGM =
        player.isGM &&
        Boolean(gmSecretToken) &&
        safeEqual(room.gmSecretToken, gmSecretToken);

      ws.roomCode = room.roomCode;
      ws.playerId = player.id;
      ws.isGM = isGM;
      player.isOnline = true;

      broadcastRoomState(room);
      return;
    }

    if (!ws.roomCode || !ws.playerId) {
      sendError(ws, 'Authenticate before sending actions.');
      return;
    }

    const room = rooms.get(ws.roomCode);
    if (!room) {
      sendError(ws, 'Room no longer exists.');
      return;
    }

    const player = room.players.get(ws.playerId);
    if (!player) {
      sendError(ws, 'Player not in room.');
      return;
    }

    if (msg.type === 'READY_TOGGLE') {
      if (room.phase !== 'LOBBY' || player.isGM) return;
      player.isReady = !player.isReady;
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'CHAT_SEND') {
      const channel = msg.payload.channel;
      const text = String(msg.payload.text || '').trim();
      const kind =
        msg.payload.kind === 'accuse' ||
        msg.payload.kind === 'defend' ||
        msg.payload.kind === 'quick' ||
        msg.payload.kind === 'reaction'
          ? msg.payload.kind
          : 'chat';
      const targetPlayerName = msg.payload.targetPlayerName
        ? String(msg.payload.targetPlayerName).slice(0, 24)
        : undefined;

      if (!text) return;

      if (channel === 'public') {
        if (!player.isGM && !player.isAlive && room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
          sendError(ws, 'Eliminated players cannot post in living parlor chat.');
          return;
        }
        if (player.isMuted) {
          sendError(ws, 'You have been muted by the Game Master.');
          return;
        }
        if (!player.canSpeak && !player.isGM) {
          sendError(ws, 'The Game Master has paused your speaking permission.');
          return;
        }
        addChat(room, 'public', player.id, player.name, text, kind, targetPlayerName);
        broadcastRoomState(room);
        return;
      }

      if (channel === 'mafia') {
        if (!room.settings.mafiaTeamCommunication) {
          sendError(ws, 'Mafia night communication is disabled.');
          return;
        }
        const allowed =
          ws.isGM ||
          (player.isAlive && player.role === 'Mafia' && room.phase === 'NIGHT_MAFIA');
        if (!allowed) {
          sendError(ws, 'You are not authorized for Mafia channel.');
          return;
        }
        addChat(room, 'mafia', player.id, player.name, text, 'chat');
        broadcastRoomState(room);
        return;
      }

      if (channel === 'dead') {
        if (!room.settings.deadChatEnabled) {
          sendError(ws, 'Dead chat is disabled.');
          return;
        }
        const allowed = ws.isGM || (!player.isGM && !player.isAlive);
        if (!allowed) {
          sendError(ws, 'Only eliminated spectators and the Game Master can use Dead Chat.');
          return;
        }
        addChat(room, 'dead', player.id, player.name, text, 'chat');
        broadcastRoomState(room);
        return;
      }
      return;
    }

    if (msg.type === 'NIGHT_ACTION') {
      const res = handlePlayerNightAction(room, player, msg.payload);
      if (res.error) {
        sendError(ws, res.error);
        return;
      }
      if (res.toast) sendToast(ws, res.toast);
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'CAST_VOTE') {
      const res = handleCastVote(room, player, msg.payload);
      if (res.error) {
        sendError(ws, res.error);
        return;
      }
      if (res.toast) sendToast(ws, res.toast);
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'VOICE_STATE') {
      const active = Boolean(msg.payload.active);
      if (active) {
        const perm = canPlayerTalkInVoice(room, player);
        if (!perm.allowed) {
          room.voicePeers.delete(player.id);
          sendError(ws, perm.reason || 'Voice chat is unavailable right now.');
          broadcastRoomState(room);
          return;
        }
        room.voicePeers.add(player.id);
      } else {
        room.voicePeers.delete(player.id);
      }
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'RTC_SIGNAL') {
      if (!room.settings.voiceChatEnabled) return;
      const toPlayerId = String(msg.payload.toPlayerId || '');
      const toPlayer = room.players.get(toPlayerId);
      if (!toPlayer) return;
      if (!canRelayVoiceSignal(room, player, toPlayer)) return;
      relayRtcSignal(room.roomCode, player.id, toPlayerId, msg.payload.signal);
      return;
    }

    if (msg.type === 'GM_ACTION') {
      if (!ws.isGM) {
        sendError(ws, 'Unauthorized: Game Master credentials required.');
        return;
      }
      const action = String(msg.payload.action || '');
      const res = handleGmAction(room, action, msg.payload);
      if (res.error) {
        sendError(ws, res.error);
        return;
      }
      pruneDisallowedVoicePeers(room);
      if (res.toast) sendToast(ws, res.toast);
      broadcastRoomState(room);
      return;
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && ws.playerId) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        // Check if another active socket exists for the same playerId
        let stillConnected = false;
        for (const client of wss.clients) {
          const other = client as AuthedSocket;
          if (
            other !== ws &&
            other.readyState === WebSocket.OPEN &&
            other.roomCode === ws.roomCode &&
            other.playerId === ws.playerId
          ) {
            stillConnected = true;
            break;
          }
        }
        if (!stillConnected) {
          const player = room.players.get(ws.playerId);
          if (player) {
            player.isOnline = false;
            room.voicePeers.delete(player.id);
            broadcastRoomState(room);
          }
        }
      }
    }
  });
});

// Keepalive ping & assisted timer tick
setInterval(() => {
  for (const client of wss.clients) {
    const ws = client as AuthedSocket;
    if (ws.isAlivePing === false) {
      ws.terminate();
      continue;
    }
    ws.isAlivePing = false;
    ws.ping();
  }
}, 25000);

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (
      room.settings.progressionMode === 'assisted_timers' &&
      !room.isPaused &&
      room.phaseEndsAt &&
      now >= room.phaseEndsAt
    ) {
      if (room.phase === 'NIGHT_MAFIA') {
        handleGmAction(room, 'MAFIA_SLEEP', {});
        broadcastRoomState(room);
      } else if (room.phase === 'NIGHT_BODYGUARD') {
        handleGmAction(room, 'BODYGUARD_SLEEP', {});
        broadcastRoomState(room);
      } else if (room.phase === 'NIGHT_DETECTIVE') {
        handleGmAction(room, 'DETECTIVE_SLEEP', {});
        broadcastRoomState(room);
      } else if (room.phase === 'DAY_DISCUSSION') {
        handleGmAction(room, 'END_DISCUSSION', {});
        broadcastRoomState(room);
      } else if (room.phase === 'DAY_VOTING') {
        handleGmAction(room, 'END_VOTING', {});
        broadcastRoomState(room);
      }
    }
  }
}, 1000);

// Prune abandoned empty rooms periodically to keep server memory lean online
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const lastActive = roomLastActivity.get(code) ?? room.roundStartedAt ?? now;
    const anyOnline = Array.from(room.players.values()).some((p) => p.isOnline);
    if (!anyOnline && now - lastActive > IDLE_ROOM_TTL_MS) {
      rooms.delete(code);
      roomLastActivity.delete(code);
    }
  }
}, 15 * 60 * 1000);

async function bootstrap(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.floor(process.uptime()), activeRooms: rooms.size });
  });

  app.post('/api/rooms', (req, res) => {
    const gmName = String(req.body?.gmName || 'Game Master');
    const roomName = String(req.body?.roomName || 'Nocturne Parlor');
    const avatar = req.body?.avatar;
    const { room, gmPlayer } = createRoom(rooms, gmName, roomName, avatar);
    touchRoom(room.roomCode);
    res.status(201).json({
      roomCode: room.roomCode,
      roomName: room.roomName,
      playerId: gmPlayer.id,
      sessionToken: gmPlayer.sessionToken,
      gmSecretToken: room.gmSecretToken,
      rejoinPin: gmPlayer.rejoinPin,
    });
  });

  app.get('/api/rooms/:code/summary', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    const playerCount = Array.from(room.players.values()).filter((p) => !p.isGM).length;
    res.json({
      roomCode: room.roomCode,
      roomName: room.roomName,
      phase: room.phase,
      playerCount,
      playerLimit: room.settings.playerLimit,
    });
  });

  app.post('/api/rooms/:code/join', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found. Check your Room Code.' });
      return;
    }
    const name = String(req.body?.name || '');
    const avatar = req.body?.avatar;
    const rejoinPin = req.body?.rejoinPin ? String(req.body.rejoinPin) : undefined;
    const accountUid = typeof req.body?.accountUid === 'string' ? req.body.accountUid : undefined;

    const result = joinRoom(room, name, avatar, rejoinPin, accountUid);
    if (result.error || !result.player) {
      res.status(result.status || 400).json({ error: result.error || 'Unable to join room.' });
      return;
    }

    broadcastRoomState(room);
    res.json({
      roomCode: room.roomCode,
      roomName: room.roomName,
      playerId: result.player.id,
      sessionToken: result.player.sessionToken,
      ...(result.player.isGM ? { gmSecretToken: room.gmSecretToken } : {}),
      rejoinPin: result.player.rejoinPin,
    });
  });

  const distDir = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const shouldServeProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' && fs.existsSync(distIndex));

  if (shouldServeProd && fs.existsSync(distIndex)) {
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `http://${host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const shutdown = () => {
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Nocturne Parlor server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
