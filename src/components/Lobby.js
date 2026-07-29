'use client';

import { useState, useEffect } from 'react';

export default function Lobby({ mp, loadout, build, onReady, onBack, username }) {

  const [codeInput,  setCodeInput]  = useState('');
  const [phase,      setPhase]      = useState('menu'); // 'menu'|'waiting'|'countdown'
  const [countdown,  setCountdown]  = useState(3);

  // Once opponent joins, send handshake and start countdown
  useEffect(() => {
    if (!mp.connected) return;
    mp.sendHandshake(loadout, build, username);
  }, [mp.connected]);

  // Once we have opponent's handshake too, begin countdown
  useEffect(() => {
    if (!mp.connected || !mp.opponentHandshake) return;
    setPhase('countdown');
    setCountdown(3);
  }, [mp.connected, mp.opponentHandshake]);

  // Countdown tick
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      onReady({
        opponentLoadout:  mp.opponentHandshake.loadout,
        opponentBuild:    mp.opponentHandshake.build,
        opponentUsername: mp.opponentHandshake.username ?? null,
        playerId:         mp.playerId ?? 'p1',
      });
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  function handleCreate() {
    mp.createRoom();
    setPhase('waiting');
  }

  function handleJoin() {
    const code = codeInput.trim();
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    mp.joinRoom(code);
    setPhase('waiting');
  }

  return (
    <div className="lobby-screen">
      <h1 className="lobby-title">PvP LOBBY</h1>

      {mp.error && <p className="lobby-error">{mp.error}</p>}

      {phase === 'menu' && (
        <div className="lobby-menu">
          <button className="lobby-btn lobby-btn--create" onClick={handleCreate}>
            Create Room
          </button>
          <div className="lobby-divider">— or —</div>
          <div className="lobby-join-row">
            <input
              className="lobby-input"
              placeholder="Enter code"
              maxLength={6}
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button className="lobby-btn" onClick={handleJoin}>Join</button>
          </div>
        </div>
      )}

      {phase === 'waiting' && (
        <div className="lobby-waiting">
          {mp.roomCode && (
            <div className="lobby-code-block">
              <span className="lobby-code-label">Room Code</span>
              <span className="lobby-code">{mp.roomCode}</span>
              <span className="lobby-code-hint">Share this with your opponent</span>
            </div>
          )}
          <p className="lobby-waiting-text">Waiting for opponent…</p>
          <div className="lobby-spinner" />
        </div>
      )}

      {phase === 'countdown' && (
        <div className="lobby-waiting">
          <p className="lobby-connected-text">Opponent connected!</p>
          <span className="lobby-countdown">{countdown}</span>
        </div>
      )}

      <button className="statbuilder-back-btn" onClick={onBack}>← Back</button>
    </div>
  );
}
