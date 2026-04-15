'use client';

import { useRef, useState, useEffect } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

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
      if (msg.type === 'opponent_handshake')   { setOpponentHandshake({ loadout: new Set(msg.loadout), build: msg.build }); }
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

  function sendHandshake(loadout, build) {
    send({ type: 'handshake', loadout: [...loadout], build });
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
