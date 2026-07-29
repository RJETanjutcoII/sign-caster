'use client';

import { useRef, useState, useEffect } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

const KNOWN_ABILITIES = new Set([
  'fist','finger_gun','death_ball','kamehameha','spirit_bomb','unlimited_void',
  'malevolent_shrine','mahoraga','instant_transmission','thumbs_up','web_shot',
  'double_v','iron_wall','power_up','expose','sharingan','sacred_ground',
]);
const STAT_BOUNDS = { hp: [120, 620], atk: [0, 80], def: [0, 60], spd: [1, 21], mp: [20, 80] };

function validateHandshake(msg) {
  const username = typeof msg.username === 'string'
    ? msg.username.replace(/[<>"'&]/g, '').slice(0, 32)
    : null;

  const rawLoadout = Array.isArray(msg.loadout) ? msg.loadout : [];
  const loadout = new Set(rawLoadout.filter(k => typeof k === 'string' && KNOWN_ABILITIES.has(k)).slice(0, 20));

  const rawBuild = msg.build && typeof msg.build === 'object' ? msg.build : {};
  const build = Object.fromEntries(
    Object.entries(STAT_BOUNDS).map(([k, [min, max]]) => {
      const v = Number(rawBuild[k]);
      return [k, Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min];
    })
  );

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

  // Cleanup only on full unmount (page.js level)
  useEffect(() => {
    return () => { wsRef.current?.close(); };
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
      if (msg.type === 'turn_resolved') {
        turnResultRef.current = { p1: msg.p1, p2: msg.p2, resolveAt: msg.resolveAt ?? Date.now() };
        onTurnResolvedRef.current?.();
      }
      if (msg.type === 'opponent_disconnected') { setDisconnected(true); }
      if (msg.type === 'signal')       { onSignalRef.current?.(msg.signal); }
      if (msg.type === 'clash_result') { onClashResultRef.current?.(msg); }
      if (msg.type === 'error')        { setError(msg.message); }
    };

    ws.onerror = () => setError('Connection error');
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

  function emitGesture(gesture, speed) {
    send({ type: 'gesture', gesture, speed });
  }

  function emitClashGesture(round) {
    send({ type: 'clash_gesture', round });
  }

  function sendSignal(signal) {
    send({ type: 'signal', signal });
  }

  function setOnTurnResolved(cb) { onTurnResolvedRef.current = cb; }
  function setOnSignal(cb)       { onSignalRef.current = cb; }
  function setOnClashResult(cb)  { onClashResultRef.current = cb; }

  // Allow resetting for rematch / back-to-lobby
  function reset() {
    wsRef.current?.close();
    wsRef.current = null;
    setRoomCode(null);
    setPlayerId(null);
    setConnected(false);
    setOpponentHandshake(null);
    setDisconnected(false);
    setError(null);
    turnResultRef.current     = null;
    onTurnResolvedRef.current = null;
    onSignalRef.current       = null;
    onClashResultRef.current  = null;
  }

  return {
    roomCode, playerId, connected, opponentHandshake, disconnected, error,
    turnResultRef,
    createRoom, joinRoom, sendHandshake, emitGesture, emitClashGesture,
    sendSignal, setOnSignal,
    setOnTurnResolved, setOnClashResult,
    reset,
  };
}
