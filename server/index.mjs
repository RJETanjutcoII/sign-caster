/**
 * Sign Caster — WebSocket relay server
 *
 * Responsibilities:
 *   - Room creation / joining (6-char codes)
 *   - Relay messages between two players in a room (handshake, WebRTC signal,
 *     domain-clash race)
 *   - Independently simulate the match (shadow copy of gameState.js) — the
 *     relay, not either browser, decides what happens each turn, and
 *     broadcasts the COMPUTED result. Clients render it; they don't
 *     recompute it.
 *   - Own the round clock: an authoritative deadline is armed the moment a
 *     round starts, independent of whether either client ever responds, so
 *     a frozen/hostile client can't stall a match by staying silent.
 *   - Measure each connection's round-trip time (ping/pong) and use it to
 *     extend a laggy player's effective deadline by their own one-way
 *     network delay — fair lag compensation, entirely server-measured so a
 *     client can't just claim an inflated RTT for extra time.
 *   - Sign a result token for each player once a match ends (win or loss),
 *     so `/api/record-battle` never has to trust a client's own claim.
 *   - Handle disconnects gracefully (including crediting the remaining
 *     player a verified win, not just a client-side self-declaration).
 *
 * Run (after building): node dist/server.cjs — see npm run server / npm run
 * build:server. Source is ESM/uses the `@/` alias, which plain Node can't
 * resolve; scripts/build-server.mjs bundles this into a standalone file.
 *
 * Clients connect via: ws://localhost:3001 locally, or wss://<host> in
 * production (PORT and ALLOWED_ORIGINS are read from the environment).
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { makeState, applyRoundStart, resolveOrderedTurns, resolveDomainClashOutcome } from '@/lib/gameState';
import { KNOWN_ABILITIES, sanitizeBuild, sanitizeLoadout } from '@/lib/abilityWhitelist';
import { ABILITIES } from '@/lib/abilities/logic-index';

const PORT   = process.env.PORT || 3001;
const rooms  = new Map(); // code → room state (see `create` handler for shape)

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());

const TURN_DURATION_MS          = 5000; // must match TURN_DURATION_S in PvPCanvas.js
const MAX_RTT_COMPENSATION_MS   = 1000; // hard cap on how much lag can extend a deadline
const RESOLVE_ANNOUNCE_DELAY_MS = 300;  // client-side reveal delay, unchanged from before
const PING_INTERVAL_MS          = 5000;

// Only used to verify a client's own access token via auth.getUser() — the
// anon key is sufficient for that, no service-role key lives on this host.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Per-IP rate limiting: max 10 connections per minute
const ipConnections = new Map(); // ip → { count, resetAt }
function checkRateLimit(ip) {
  const now = Date.now();
  const rec = ipConnections.get(ip);
  if (!rec || now > rec.resetAt) {
    ipConnections.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (rec.count >= 10) return false;
  rec.count += 1;
  return true;
}

// Sweep stale entries periodically — otherwise every distinct IP that
// ever connects leaves a permanent entry for the life of the process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of ipConnections) {
    if (now > rec.resetAt) ipConnections.delete(ip);
  }
}, 60_000);

const wss = new WebSocketServer({
  port: PORT,
  verifyClient: ({ req }, cb) => {
    const origin = req.headers.origin || '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      cb(false, 403, 'Forbidden');
      return;
    }
    const ip = req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      cb(false, 429, 'Too Many Requests');
      return;
    }
    cb(true);
  },
});

// A single bad message shouldn't take down every active match.
wss.on('error', (err) => console.error('WS server error:', err));

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcast(room, type, payload = {}) {
  for (const p of room.players) send(p, type, payload);
}

// ── Round-trip time / lag compensation ──────────────────────────────────────
// Entirely server-measured: a client never reports its own latency, it only
// ever replies to a timestamp the server itself stamped, so there's no field
// a modified client could inflate to buy itself extra time beyond the hard
// MAX_RTT_COMPENSATION_MS cap below.

function recordRttSample(room, playerId, rtt) {
  const samples = room.rttSamples[playerId];
  samples.push(Math.max(0, rtt));
  if (samples.length > 5) samples.shift();
  room.rtt[playerId] = Math.min(...samples); // floor of recent samples — resists transient jitter
}

function startPingLoop(room) {
  if (room.pingInterval) return;
  const pingOnce = () => {
    for (const p of room.players) {
      if (!p.playerId) continue;
      const id = ++room.pingSeq;
      room.pendingPing[p.playerId] = { id, sentAt: Date.now() };
      send(p, 'ping', { id, t0: Date.now() });
    }
  };
  pingOnce();
  room.pingInterval = setInterval(pingOnce, PING_INTERVAL_MS);
}

function compFor(room, playerId) {
  const rtt = room.rtt[playerId] ?? 0;
  return Math.min(Math.max(0, rtt) / 2, MAX_RTT_COMPENSATION_MS);
}

// ── Shadow match simulation ─────────────────────────────────────────────────
// Mirrors PvPCanvas.js/useDomainClash.js exactly (same gameState.js functions,
// same order of operations) so this independent computation lands on the
// same outcome the client renders — the relay computes it once and broadcasts
// the result; clients don't recompute it themselves.

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', process.env.BATTLE_RESULT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function mintAndSend(room, playerId, result) {
  const userId = room.userIds[playerId];
  if (!userId) return; // this player never proved identity — no token for them
  const ws = room.players.find(p => p.playerId === playerId);
  if (!ws) return;
  const token = signToken({ userId, result, mode: 'pvp', matchId: room.matchId, exp: Date.now() + 5 * 60_000 });
  send(ws, 'match_result', { token });
}

function endMatch(room, winnerId) {
  if (room.matchOver) return;
  room.matchOver = true;
  const loserId = winnerId === 'p1' ? 'p2' : 'p1';
  mintAndSend(room, winnerId, 'win');
  mintAndSend(room, loserId, 'loss');
}

// Returns true if the match just ended (caller should not start a new round).
function checkGameOverAndMint(room) {
  if (room.matchOver) return false;
  const { p1, p2 } = room.playerStates;
  if (p1.hp > 0 && p2.hp > 0) return false;
  endMatch(room, p1.hp <= 0 ? 'p2' : 'p1');
  return true;
}

// Arms the authoritative round-end timer. Runs unconditionally the moment a
// round starts, independent of whether either client ever responds — this is
// what makes stalling-by-freezing impossible: the deadline fires regardless.
// Each side's deadline is individually extended by up to MAX_RTT_COMPENSATION_MS
// (their own measured one-way delay), and the relay waits for the LATER of
// the two compensated deadlines so a laggy player's compensation isn't
// stripped by the faster player's timer.
function armRoundClock(room) {
  clearTimeout(room.turnTimer);
  room.roundStartAt    = Date.now();
  room.roundDeadlineAt = room.roundStartAt + TURN_DURATION_MS;

  const forceAt = Math.max(
    room.roundDeadlineAt + compFor(room, 'p1'),
    room.roundDeadlineAt + compFor(room, 'p2'),
  );
  const forRound = room.gestureRound;

  room.turnTimer = setTimeout(() => {
    room.turnTimer = null;
    if (room.matchOver || room.gestureRound !== forRound) return; // already resolved via the fast path
    if (!room.gestures.p1) room.gestures.p1 = { gesture: null, speed: 1 };
    if (!room.gestures.p2) room.gestures.p2 = { gesture: null, speed: 1 };
    finishRound(room);
  }, Math.max(0, forceAt - Date.now()));
}

// Runs the start-of-turn tick for the upcoming round, mirroring PvPCanvas.js's
// turn-timer effect (which runs once per 'selecting' phase entry, before the
// player picks a gesture), advances round numbering (the relay is the sole
// authority on round numbers — clients adopt whatever this broadcasts rather
// than counting their own), arms the round clock, and announces it all.
function startRound(room) {
  const started = applyRoundStart(room.playerStates.p1, room.playerStates.p2);
  room.playerStates  = { p1: started.playerState, p2: started.opponentState };
  room.forcedGesture = { p1: started.playerForcedGesture, p2: started.opponentForcedGesture };

  room.gestureRound += 1;
  room.gestures = {};

  armRoundClock(room);

  broadcast(room, 'round_start', {
    round: room.gestureRound,
    p1: { state: room.playerStates.p1, forcedGesture: room.forcedGesture.p1 },
    p2: { state: room.playerStates.p2, forcedGesture: room.forcedGesture.p2 },
    serverNow:  room.roundStartAt,
    deadline:   room.roundDeadlineAt,
    durationMs: TURN_DURATION_MS,
  });
}

function maybeStartMatch(room) {
  if (room.playerStates.p1 || !room.builds.p1 || !room.builds.p2) return;
  room.playerStates = { p1: makeState(room.builds.p1), p2: makeState(room.builds.p2) };
  startRound(room);
}

function validateGesture(room, playerId, gesture) {
  if (gesture === null || gesture === undefined) return null;
  if (typeof gesture !== 'string' || !KNOWN_ABILITIES.has(gesture)) return null;
  if (!room.loadouts[playerId]?.has(gesture)) return null;
  return gesture;
}

// Called once both players' gestures for a round are known (either both
// submitted, or the round clock forced null in for whoever didn't). Computes
// the actual resolution ONCE and broadcasts it — this is the only place a
// turn's outcome is decided; clients just render whatever this sends.
function simulateRound(room, resolveAt, rawGesture1, rawGesture2) {
  if (room.matchOver || !room.playerStates.p1) return;

  const g1 = validateGesture(room, 'p1', rawGesture1?.gesture);
  const g2 = validateGesture(room, 'p2', rawGesture2?.gesture);
  const locked1 = room.forcedGesture.p1 ?? g1;
  const locked2 = room.forcedGesture.p2 ?? g2;

  const { p1, p2 } = room.playerStates;
  const p1IsDomain     = ABILITIES[locked1]?.turnType === 'domain';
  const p2IsDomain     = ABILITIES[locked2]?.turnType === 'domain';
  const noDomainActive = !p1.activeDomain && !p2.activeDomain;

  if (p1IsDomain && p2IsDomain && noDomainActive) {
    // Mirrors PvPCanvas.js's simultaneous-domain-clash branch — defer to the
    // duel; onClashWinnerDetermined() below finishes this once a winner
    // reaches 3, using the relay's own already-authoritative clash_gesture
    // race arbitration (no gesture-recognition dependency either way).
    room.pendingClash = { p1Key: locked1, p2Key: locked2 };
    room.clashWins    = { p1: 0, p2: 0 };
    broadcast(room, 'clash_start', { round: room.gestureRound, resolveAt, p1Domain: locked1, p2Domain: locked2 });
    return;
  }

  const clampSpeed = (s) => Math.min(50, Math.max(0, s.spd || 1) + (s.speedMod || 0));
  const speed1 = clampSpeed(p1);
  const speed2 = clampSpeed(p2);
  const coinFlip = resolveAt % 2 === 0; // matches client: (resolveAt % 2 === 0) => p1 goes first

  const resolved = resolveOrderedTurns(p1, locked1, speed1, p2, locked2, speed2, coinFlip);

  // Two-stage check mirroring the client's animation pipeline exactly: if the
  // second mover was killed/stunned by the first mover's hit, their own
  // action never applied — the intermediate state is the real end-state.
  const suppressed = resolved.playerIntermediate.hp <= 0 || resolved.botIntermediate.hp <= 0;
  room.playerStates = suppressed
    ? { p1: resolved.playerIntermediate, p2: resolved.botIntermediate }
    : { p1: resolved.playerFinal,        p2: resolved.botFinal };

  const gameOverWinner = room.playerStates.p1.hp <= 0 ? 'p2' : room.playerStates.p2.hp <= 0 ? 'p1' : null;

  broadcast(room, 'turn_resolved', {
    round: room.gestureRound,
    resolveAt,
    firstMover:      resolved.firstMoverIsPlayer ? 'p1' : 'p2',
    firstEffectKey:  resolved.firstEffectKey,
    firstMessage:    resolved.firstMessage,
    firstGesture:    resolved.firstGesture,
    secondEffectKey: resolved.secondEffectKey,
    secondMessage:   resolved.secondMessage,
    secondGesture:   resolved.secondGesture,
    p1Intermediate:  resolved.playerIntermediate,
    p2Intermediate:  resolved.botIntermediate,
    p1Final:         resolved.playerFinal,
    p2Final:         resolved.botFinal,
    gameOverWinner,
  });

  if (!checkGameOverAndMint(room)) startRound(room);
}

// Shared by the "both gestures already in" fast path and the round clock's
// force-timeout — collapses what used to be two near-duplicate blocks.
function finishRound(room) {
  clearTimeout(room.turnTimer);
  room.turnTimer = null;
  const resolveAt = Date.now() + RESOLVE_ANNOUNCE_DELAY_MS;
  const g1 = room.gestures.p1;
  const g2 = room.gestures.p2;
  room.gestures = {};
  simulateRound(room, resolveAt, g1, g2);
}

function onClashWinnerDetermined(room, winner) {
  if (!room.pendingClash) return;
  room.clashWins[winner] = (room.clashWins[winner] || 0) + 1;
  if (room.clashWins.p1 < 3 && room.clashWins.p2 < 3) return;

  const clashWinnerId = room.clashWins.p1 >= 3 ? 'p1' : 'p2';
  const clashLoserId  = clashWinnerId === 'p1' ? 'p2' : 'p1';
  const winnerKey = room.pendingClash[`${clashWinnerId}Key`];
  const loserKey  = room.pendingClash[`${clashLoserId}Key`];

  const { newWinnerState, newLoserState } = resolveDomainClashOutcome(
    room.playerStates[clashWinnerId], winnerKey,
    room.playerStates[clashLoserId],  loserKey,
  );
  room.playerStates[clashWinnerId] = newWinnerState;
  room.playerStates[clashLoserId]  = newLoserState;
  room.pendingClash = null;

  broadcast(room, 'clash_resolved', { p1: room.playerStates.p1, p2: room.playerStates.p2 });

  if (!checkGameOverAndMint(room)) startRound(room);
}

// ── Connection handling ──────────────────────────────────────────────────────

// Heartbeat: a socket that dies without a clean TCP close (mobile/NAT drops)
// never fires 'close', so its room would never get cleaned up. Ping every
// connection periodically and terminate anything that didn't pong back —
// terminate() triggers the normal 'close' handler below. This is a distinct,
// lower-level mechanism from the application-level ping/pong (RTT
// measurement) above: this one operates on raw WS control frames and never
// reaches handleMessage.
function heartbeat() { this.isAlive = true; }

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

wss.on('close', () => clearInterval(heartbeatInterval));

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.playerId = null; // 'p1' | 'p2'
  ws.isAlive  = true;
  ws.on('pong', heartbeat);

  ws.on('message', (raw) => {
    try {
      handleMessage(ws, raw);
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    if (!room) return;
    clearTimeout(room.clashTimer);
    room.clashTimer = null;
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    clearInterval(room.pingInterval);
    room.pingInterval = null;

    // A disconnect mid-match is currently the easiest "win" in the whole
    // system if left client-declared — make the relay the one crediting it.
    if (room.playerStates?.p1 && !room.matchOver) {
      endMatch(room, ws.playerId === 'p1' ? 'p2' : 'p1');
    }

    room.players = room.players.filter(p => p !== ws);
    if (room.players.length === 0) {
      rooms.delete(ws.roomCode);
    } else {
      broadcast(room, 'opponent_disconnected');
    }
  });
});

function handleMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── Create room ────────────────────────────────────────────────────────
    if (msg.type === 'create') {
      let code;
      do { code = randomCode(); } while (rooms.has(code));
      rooms.set(code, {
        players: [ws], gestures: {}, gestureRound: 0,
        turnTimer: null, roundStartAt: null, roundDeadlineAt: null,
        clashRound: null, clashFirstPlayer: null, clashFirstAt: 0, clashTimer: null,
        matchId: crypto.randomUUID(),
        userIds: {}, builds: {}, loadouts: {},
        playerStates: {}, forcedGesture: {},
        pendingClash: null, clashWins: { p1: 0, p2: 0 },
        matchOver: false,
        rtt: { p1: 0, p2: 0 }, rttSamples: { p1: [], p2: [] },
        pendingPing: { p1: null, p2: null }, pingSeq: 0, pingInterval: null,
      });
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
      startPingLoop(room);
      return;
    }

    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    if (!room) return;

    // ── RTT ping/pong — symmetric; each side only trusts timestamps it
    // stamped itself. Server-initiated pings drive room.rtt (used for lag
    // compensation); client-initiated pings drive the client's own clock
    // offset estimate for its countdown display. ─────────────────────────
    if (msg.type === 'ping') {
      if (typeof msg.id !== 'number' || typeof msg.t0 !== 'number') return;
      send(ws, 'pong', { id: msg.id, t0: msg.t0, t1: Date.now() });
      return;
    }
    if (msg.type === 'pong') {
      const pending = room.pendingPing[ws.playerId];
      if (!pending || pending.id !== msg.id) return; // stale/duplicate — ignore
      room.pendingPing[ws.playerId] = null;
      recordRttSample(room, ws.playerId, Date.now() - pending.sentAt);
      return;
    }

    // ── Identity — proves this connection's real Supabase user id ──────────
    if (msg.type === 'identify') {
      const token = msg.accessToken;
      if (typeof token !== 'string' || !token) return;
      supabase.auth.getUser(token).then(({ data, error }) => {
        if (error || !data?.user) return; // fails closed for this player only
        room.userIds[ws.playerId] = data.user.id;
      }).catch(() => {});
      return;
    }

    // ── Loadout + build handshake ──────────────────────────────────────────
    if (msg.type === 'handshake') {
      const other = room.players.find(p => p !== ws);
      if (other) send(other, 'opponent_handshake', { loadout: msg.loadout, build: msg.build, username: msg.username ?? null });

      room.builds[ws.playerId]   = sanitizeBuild(msg.build);
      room.loadouts[ws.playerId] = new Set(sanitizeLoadout(msg.loadout));
      maybeStartMatch(room);
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
          onClashWinnerDetermined(room, room.clashFirstPlayer);
          room.clashFirstPlayer = null;
          room.clashTimer       = null;
        }, SIMULTANEOUS_MS);
      } else if (room.clashFirstPlayer && now - room.clashFirstAt <= SIMULTANEOUS_MS) {
        // Second submission arrived within the simultaneous window — coin flip
        clearTimeout(room.clashTimer);
        room.clashTimer = null;
        const winner = Math.random() < 0.5 ? room.clashFirstPlayer : ws.playerId;
        broadcast(room, 'clash_result', { winner, round });
        onClashWinnerDetermined(room, winner);
        room.clashFirstPlayer = null;
      }
      // else: already resolved, ignore duplicate
      return;
    }

    // ── Gesture submission ─────────────────────────────────────────────────
    if (msg.type === 'gesture') {
      const round = msg.round;
      if (typeof round !== 'number' || !Number.isFinite(round)) return;

      // A gesture for any round other than the one currently being
      // collected is stale (or premature) — drop it. The round clock (see
      // armRoundClock) will still force-resolve the current round on
      // schedule regardless, so nothing gets permanently stuck.
      if (round !== room.gestureRound) return;

      room.gestures[ws.playerId] = { gesture: msg.gesture, speed: msg.speed };
      if (room.gestures.p1 && room.gestures.p2) finishRound(room);
      return;
    }
}

console.log(`Sign Caster WS server running on port ${PORT}`);
