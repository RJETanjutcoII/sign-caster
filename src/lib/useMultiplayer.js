'use client';

import { useRef, useState, useEffect } from 'react';
import { sanitizeLoadout, sanitizeBuild } from './abilityWhitelist';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const PING_INTERVAL_MS = 5000;

function validateHandshake(msg) {
  const username = typeof msg.username === 'string'
    ? msg.username.replace(/[<>"'&]/g, '').slice(0, 32)
    : null;

  const loadout = new Set(sanitizeLoadout(msg.loadout));
  const build   = sanitizeBuild(msg.build);

  return { username, loadout, build };
}

export function useMultiplayer() {
  const wsRef = useRef(null);

  const [roomCode,          setRoomCode]          = useState(null);
  const [playerId,          setPlayerId]          = useState(null);
  const [connected,         setConnected]         = useState(false);
  const [opponentHandshake, setOpponentHandshake] = useState(null);
  const [disconnected,      setDisconnected]      = useState(false);
  const [error,             setError]             = useState(null);

  const turnResultRef      = useRef(null);
  const onTurnResolvedRef  = useRef(null);
  const onSignalRef        = useRef(null);        // WebRTC signaling callback
  const onClashResultRef   = useRef(null);
  const resultTokenRef     = useRef(null);        // relay-signed { userId, result, mode, matchId, exp } token
  const onMatchResultRef   = useRef(null);

  // Server-authoritative turn resolution: the relay computes each round and
  // broadcasts the result — these mirror turnResultRef's "store
  // unconditionally, drain-or-subscribe" pattern for the same reason (a
  // message can arrive before the consuming component's effect has
  // registered a listener).
  const roundStartRef      = useRef(null);
  const onRoundStartRef    = useRef(null);
  const clashStartRef      = useRef(null);
  const onClashStartRef    = useRef(null);
  const clashResolvedRef   = useRef(null);
  const onClashResolvedRef = useRef(null);

  // Round-trip time / clock sync — lets the turn-timer display an accurate
  // countdown against the SERVER's clock instead of a purely local one.
  // Compensation itself is decided server-side (see server/index.mjs); this
  // is display-only on the client.
  const clockOffsetRef   = useRef(0);     // estimated (server clock − local clock), ms
  const rttEstimateRef   = useRef(null);  // cosmetic connection-quality indicator
  const pingSamplesRef   = useRef([]);
  const pingSeqRef       = useRef(0);
  const pingIntervalRef  = useRef(null);
  const roundDeadlineRef = useRef(null);  // server's uncompensated deadline for the current round

  function estimatedServerNow() {
    return Date.now() + clockOffsetRef.current;
  }

  // Cleanup only on full unmount (page.js level)
  useEffect(() => {
    return () => {
      clearInterval(pingIntervalRef.current);
      wsRef.current?.close();
    };
  }, []);

  function openSocket() {
    if (wsRef.current && wsRef.current.readyState < 2) return wsRef.current;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === 'created') { setRoomCode(msg.roomCode); setPlayerId('p1'); }
      if (msg.type === 'joined')  { setRoomCode(msg.roomCode); setPlayerId('p2'); }
      if (msg.type === 'opponent_joined')      { setConnected(true); }
      if (msg.type === 'opponent_handshake')   { setOpponentHandshake(validateHandshake(msg)); }
      if (msg.type === 'round_start') {
        roundStartRef.current   = { round: msg.round, p1: msg.p1, p2: msg.p2 };
        roundDeadlineRef.current = msg.deadline ?? null;
        onRoundStartRef.current?.(msg.round);
      }
      if (msg.type === 'turn_resolved') {
        turnResultRef.current = {
          round: msg.round, resolveAt: msg.resolveAt ?? Date.now(),
          firstMover: msg.firstMover,
          firstEffectKey: msg.firstEffectKey, firstMessage: msg.firstMessage, firstGesture: msg.firstGesture,
          secondEffectKey: msg.secondEffectKey, secondMessage: msg.secondMessage, secondGesture: msg.secondGesture,
          p1Intermediate: msg.p1Intermediate, p2Intermediate: msg.p2Intermediate,
          p1Final: msg.p1Final, p2Final: msg.p2Final,
          gameOverWinner: msg.gameOverWinner ?? null,
        };
        onTurnResolvedRef.current?.(msg.round);
      }
      if (msg.type === 'clash_start') {
        clashStartRef.current = {
          round: msg.round, resolveAt: msg.resolveAt ?? Date.now(),
          p1Domain: msg.p1Domain, p2Domain: msg.p2Domain,
        };
        onClashStartRef.current?.(msg.round);
      }
      if (msg.type === 'clash_resolved') {
        clashResolvedRef.current = { p1: msg.p1, p2: msg.p2 };
        onClashResolvedRef.current?.();
      }
      if (msg.type === 'opponent_disconnected') { setDisconnected(true); }
      if (msg.type === 'signal')       { onSignalRef.current?.(msg.signal); }
      if (msg.type === 'clash_result') { onClashResultRef.current?.(msg); }
      if (msg.type === 'match_result') {
        resultTokenRef.current = msg.token;
        onMatchResultRef.current?.(msg.token);
      }
      if (msg.type === 'ping') { send({ type: 'pong', id: msg.id, t0: msg.t0, t1: Date.now() }); }
      if (msg.type === 'pong') {
        const now  = Date.now();
        const rtt  = Math.max(0, now - msg.t0);
        const offset = msg.t1 + rtt / 2 - now;
        const samples = pingSamplesRef.current;
        samples.push({ rtt, offset });
        if (samples.length > 5) samples.shift();
        const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
        clockOffsetRef.current = best.offset;
        rttEstimateRef.current = best.rtt;
      }
      if (msg.type === 'error')        { setError(msg.message); }
    };

    ws.onerror = () => setError('Connection error');

    ws.addEventListener('open', () => {
      const pingOnce = () => send({ type: 'ping', id: ++pingSeqRef.current, t0: Date.now() });
      pingOnce();
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(pingOnce, PING_INTERVAL_MS);
    });

    return ws;
  }

  function send(payload) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  function createRoom() {
    setError(null);
    openSocket();
    const ws = wsRef.current;
    const doSend = () => send({ type: 'create' });
    if (ws.readyState === WebSocket.OPEN) doSend();
    else ws.addEventListener('open', doSend, { once: true });
  }

  function joinRoom(code) {
    setError(null);
    openSocket();
    const ws = wsRef.current;
    const doSend = () => send({ type: 'join', code });
    if (ws.readyState === WebSocket.OPEN) doSend();
    else ws.addEventListener('open', doSend, { once: true });
  }

  function sendHandshake(loadout, build, username) {
    send({ type: 'handshake', loadout: [...loadout], build, username: username ?? null });
  }

  function sendIdentity(accessToken) {
    send({ type: 'identify', accessToken });
  }

  function emitGesture(gesture, speed, round) {
    send({ type: 'gesture', gesture, speed, round });
  }

  function emitClashGesture(round) {
    send({ type: 'clash_gesture', round });
  }

  function sendSignal(signal) {
    send({ type: 'signal', signal });
  }

  function setOnTurnResolved(cb)  { onTurnResolvedRef.current = cb; }
  function setOnSignal(cb)        { onSignalRef.current = cb; }
  function setOnClashResult(cb)   { onClashResultRef.current = cb; }
  function setOnMatchResult(cb)   { onMatchResultRef.current = cb; }
  function setOnRoundStart(cb)    { onRoundStartRef.current = cb; }
  function setOnClashStart(cb)    { onClashStartRef.current = cb; }
  function setOnClashResolved(cb) { onClashResolvedRef.current = cb; }

  // Allow resetting for rematch / back-to-lobby
  function reset() {
    clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setRoomCode(null);
    setPlayerId(null);
    setConnected(false);
    setOpponentHandshake(null);
    setDisconnected(false);
    setError(null);
    turnResultRef.current      = null;
    onTurnResolvedRef.current  = null;
    onSignalRef.current        = null;
    onClashResultRef.current   = null;
    resultTokenRef.current     = null;
    onMatchResultRef.current   = null;
    roundStartRef.current      = null;
    onRoundStartRef.current    = null;
    clashStartRef.current      = null;
    onClashStartRef.current    = null;
    clashResolvedRef.current   = null;
    onClashResolvedRef.current = null;
    clockOffsetRef.current     = 0;
    rttEstimateRef.current     = null;
    pingSamplesRef.current     = [];
    pingSeqRef.current         = 0;
    roundDeadlineRef.current   = null;
  }

  return {
    roomCode, playerId, connected, opponentHandshake, disconnected, error,
    turnResultRef, resultTokenRef,
    roundStartRef, clashStartRef, clashResolvedRef,
    roundDeadlineRef, rttEstimateRef, estimatedServerNow,
    createRoom, joinRoom, sendHandshake, sendIdentity, emitGesture, emitClashGesture,
    sendSignal, setOnSignal,
    setOnTurnResolved, setOnClashResult, setOnMatchResult,
    setOnRoundStart, setOnClashStart, setOnClashResolved,
    reset,
  };
}
