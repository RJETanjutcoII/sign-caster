/**
 * Sign Caster — WebSocket relay server
 *
 * Responsibilities:
 *   - Room creation / joining (4-letter codes)
 *   - Relay messages between two players in a room
 *   - Buffer gestures per turn: wait for both players, then broadcast both
 *   - Handle disconnects gracefully
 *
 * Run: node server/index.js
 * Clients connect via: ws://localhost:3001
 */

const { WebSocketServer, WebSocket } = require('ws');

const PORT   = 3001;
const wss    = new WebSocketServer({ port: PORT });
const rooms  = new Map(); // code → { players: [ws, ws?] }

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcast(room, type, payload = {}) {
  for (const p of room.players) send(p, type, payload);
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.playerId = null; // 'p1' | 'p2'

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── Create room ────────────────────────────────────────────────────────
    if (msg.type === 'create') {
      let code;
      do { code = randomCode(); } while (rooms.has(code));
      rooms.set(code, { players: [ws], gestures: {}, gestureTimer: null, clashRound: null, clashFirstPlayer: null, clashFirstAt: 0, clashTimer: null });
      ws.roomCode = code;
      ws.playerId = 'p1';
      send(ws, 'created', { roomCode: code });
      return;
    }

    // ── Join room ──────────────────────────────────────────────────────────
    if (msg.type === 'join') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) { send(ws, 'error', { message: 'Room not found' }); return; }
      if (room.players.length >= 2) { send(ws, 'error', { message: 'Room is full' }); return; }
      room.players.push(ws);
      ws.roomCode = code;
      ws.playerId = 'p2';
      send(ws, 'joined', { roomCode: code });
      broadcast(room, 'opponent_joined');
      return;
    }

    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    if (!room) return;

    // ── Loadout + build handshake ──────────────────────────────────────────
    if (msg.type === 'handshake') {
      const other = room.players.find(p => p !== ws);
      if (other) send(other, 'opponent_handshake', { loadout: msg.loadout, build: msg.build });
      return;
    }

    // ── WebRTC signaling relay ─────────────────────────────────────────────
    if (msg.type === 'signal') {
      const other = room.players.find(p => p !== ws);
      if (other) send(other, 'signal', { signal: msg.signal });
      return;
    }

    // ── Domain clash gesture ──────────────────────────────────────────────
    if (msg.type === 'clash_gesture') {
      const round = msg.round;
      const now   = Date.now();
      const SIMULTANEOUS_MS = 100;

      if (!room.clashRound || room.clashRound !== round) {
        // First submission for this round — wait briefly for a simultaneous hit
        room.clashRound       = round;
        room.clashFirstPlayer = ws.playerId;
        room.clashFirstAt     = now;
        clearTimeout(room.clashTimer);
        room.clashTimer = setTimeout(() => {
          broadcast(room, 'clash_result', { winner: room.clashFirstPlayer, round });
          room.clashFirstPlayer = null;
          room.clashTimer       = null;
        }, SIMULTANEOUS_MS);
      } else if (room.clashFirstPlayer && now - room.clashFirstAt <= SIMULTANEOUS_MS) {
        // Second submission arrived within the simultaneous window — coin flip
        clearTimeout(room.clashTimer);
        room.clashTimer = null;
        const winner = Math.random() < 0.5 ? room.clashFirstPlayer : ws.playerId;
        broadcast(room, 'clash_result', { winner, round });
        room.clashFirstPlayer = null;
      }
      // else: already resolved, ignore duplicate
      return;
    }

    // ── Gesture submission ─────────────────────────────────────────────────
    if (msg.type === 'gesture') {
      room.gestures[ws.playerId] = { gesture: msg.gesture, speed: msg.speed };

      // Once both gestures are in, relay both and reset
      if (room.gestures.p1 && room.gestures.p2) {
        clearTimeout(room.gestureTimer);
        const payload = { p1: room.gestures.p1, p2: room.gestures.p2, resolveAt: Date.now() + 300 };
        broadcast(room, 'turn_resolved', payload);
        room.gestures = {};
        return;
      }

      // Safety timeout: if second player doesn't respond in 3s, send null for them
      clearTimeout(room.gestureTimer);
      room.gestureTimer = setTimeout(() => {
        const missing = room.gestures.p1 ? 'p2' : 'p1';
        room.gestures[missing] = { gesture: null, speed: 1 };
        const payload = { p1: room.gestures.p1, p2: room.gestures.p2, resolveAt: Date.now() + 300 };
        broadcast(room, 'turn_resolved', payload);
        room.gestures = {};
      }, 3000);
      return;
    }
  });

  ws.on('close', () => {
    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    if (!room) return;
    clearTimeout(room.clashTimer);
    room.clashTimer = null;
    room.players = room.players.filter(p => p !== ws);
    if (room.players.length === 0) {
      rooms.delete(ws.roomCode);
    } else {
      broadcast(room, 'opponent_disconnected');
    }
  });
});

console.log(`Sign Caster WS server running on ws://localhost:${PORT}`);
