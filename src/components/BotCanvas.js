'use client';

import { useEffect, useRef, useState } from 'react';
import { ABILITIES } from '@/lib/abilities';
import { Effect as RestEffect } from '@/lib/effects/rest';
import { Effect as FailEffect } from '@/lib/effects/fail';
import { Effect as StunEffect } from '@/lib/effects/stun';
import AbilityDisplay from './AbilityDisplay';
import LoadoutHUD from './LoadoutHUD';
import StatsHUD from './StatsHUD';
import dynamic from 'next/dynamic';
const DomainLayer = dynamic(() => import('./DomainLayer'), { ssr: false });
import { INITIAL_STATE, applyStartOfTurn, applyIncoming, resolveOrderedTurns } from '@/lib/gameState';
import { BOT_LOADOUT, chooseBotGesture } from '@/lib/bot';
import { useGestureEngine } from '@/lib/useGestureEngine';

const TURN_DURATION_S = 5;
const RESOLVE_SUB_S   = 2;   // duration of each resolve sub-phase
const PLAYER_SPEED    = 1;
const BOT_SPEED       = 2;
const ZOOM            = 1.25;

export default function BotCanvas({ loadout, onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // ── Turn state ────────────────────────────────────────────────────────────
  const [gamePhase,        setGamePhase]        = useState('warmup'); // 'warmup'|'selecting'|'resolving_first'|'resolving_second'
  const timeLeftRef = useRef(TURN_DURATION_S);
  const [turnKey,          setTurnKey]          = useState(0);
  const [confirmedGesture, setConfirmedGesture] = useState(null);
  const [activeEffect,     setActiveEffect]     = useState(null);
  const [resolveMessage,   setResolveMessage]   = useState(null);
  const [gameOver,         setGameOver]         = useState(null); // null | 'win' | 'loss'

  const gamePhaseRef   = useRef('warmup');
  const forcedGestureRef = useRef(null);

  // ── Player state ──────────────────────────────────────────────────────────
  const [playerState, setPlayerState] = useState(INITIAL_STATE);
  const playerStateRef  = useRef(INITIAL_STATE);

  // ── Bot state ─────────────────────────────────────────────────────────────
  const [botState, setBotState] = useState(INITIAL_STATE);
  const botStateRef        = useRef(INITIAL_STATE);
  const botForcedGestureRef = useRef(null);
  const botLockedGestureRef = useRef(null);

  // ── Staged resolution data ────────────────────────────────────────────────
  const pendingResolutionRef = useRef(null);

  // ── Dev helpers ───────────────────────────────────────────────────────────
  const [showLandmarks, setShowLandmarks] = useState(false);
  const showLandmarksRef = useRef(false);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { showLandmarksRef.current = showLandmarks; }, [showLandmarks]);

  // ── Gesture engine ────────────────────────────────────────────────────────
  const { status, currentGesture, confirmedGestureRef, lastGestureRef } = useGestureEngine({
    loadout,
    videoRef,
    canvasRef,
    zoom: ZOOM,
    gamePhaseRef,
    showLandmarksRef,
    playerStateRef,
    onWarmupComplete: () => setGamePhase('selecting'),
    onConfirm:        (g) => setConfirmedGesture(g),
    onCancel:         ()  => setConfirmedGesture(null),
  });

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'selecting') return;
    if (gameOver) return;

    setTurnKey(k => k + 1);

    // Start of turn — player
    const { newState: sotState, forcedGesture, domainOutgoing: playerDomainOut } = applyStartOfTurn(playerStateRef.current);
    playerStateRef.current = sotState;
    forcedGestureRef.current = forcedGesture;

    // Apply player's domain outgoing to bot BEFORE bot SOT, so stun is seen immediately
    if (playerDomainOut.damage > 0 || playerDomainOut.stunTurns > 0) {
      botStateRef.current = applyIncoming({ ...botStateRef.current, nullified: false }, playerDomainOut);
    }

    // Start of turn — bot (now sees any stun from player's domain)
    const { newState: botSot, forcedGesture: botForced, domainOutgoing: botDomainOut } = applyStartOfTurn(botStateRef.current);
    botStateRef.current = botSot;
    const botChoice = botForced ?? chooseBotGesture(botSot, BOT_LOADOUT);
    botLockedGestureRef.current = botChoice;
    botForcedGestureRef.current = botForced;

    // Apply bot's domain outgoing to player
    if (botDomainOut.damage > 0 || botDomainOut.stunTurns > 0) {
      playerStateRef.current = applyIncoming(playerStateRef.current, botDomainOut);
    }
    setPlayerState(playerStateRef.current);
    setBotState(botStateRef.current);

    // Reset selection UI
    timeLeftRef.current = TURN_DURATION_S;
    setConfirmedGesture(null);
    setResolveMessage(null);
    lastGestureRef.current      = null;
    confirmedGestureRef.current = null;

    const interval = setInterval(() => {
      timeLeftRef.current -= 1;
      if (timeLeftRef.current > 0) return;

      clearInterval(interval);

      const playerLocked = forcedGestureRef.current ?? lastGestureRef.current;
      const botLocked    = botLockedGestureRef.current;
      forcedGestureRef.current = null;

      // Resolve with speed/priority ordering (speed reduced by accumulated penalties)
      const playerSpeed = Math.max(0, PLAYER_SPEED + (playerStateRef.current.speedMod || 0));
      const botSpeed    = Math.max(0, BOT_SPEED    + (botStateRef.current.speedMod    || 0));
      const result = resolveOrderedTurns(
        playerStateRef.current, playerLocked, playerSpeed,
        botStateRef.current,    botLocked,    botSpeed
      );
      pendingResolutionRef.current = result;

      // Stage 1: apply intermediate states (first mover's hit lands on second)
      playerStateRef.current = result.playerIntermediate;
      botStateRef.current    = result.botIntermediate;
      setPlayerState(result.playerIntermediate);
      setBotState(result.botIntermediate);

      // Win/loss check #1 — store in pending, don't show overlay yet
      if (result.playerIntermediate.hp <= 0 || result.botIntermediate.hp <= 0) {
        pendingResolutionRef.current.gameOverResult =
          result.playerIntermediate.hp <= 0 ? 'loss' : 'win';
      }

      // Stage 1 display: first mover's move
      setResolveMessage(buildLabel(result.firstMoverIsPlayer ? 'YOU' : 'BOT', result.firstGesture, result.firstMessage));
      const firstEffect = getEffectComponent(result.firstEffectKey, result.firstGesture);
      setActiveEffect(result.firstMoverIsPlayer && firstEffect ? () => firstEffect : null);
      setGamePhase('resolving_first');
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, gameOver]);

  // ── Helpers for staged resolution display ─────────────────────────────────
  function getEffectComponent(effectKey, gesture) {
    const g = gesture === 'stunned' ? null : gesture;
    if (effectKey === 'rest')             return RestEffect;
    if (effectKey === 'fail')             return FailEffect;
    if (effectKey === 'multi_turn_start') return g ? ABILITIES[g]?.ChargeEffect ?? null : null;
    if (effectKey === 'multi_turn_final') return g ? ABILITIES[g]?.Effect ?? null : null;
    if (effectKey === 'domain_start')     return g ? ABILITIES[g]?.Effect ?? null : null;
    if (gesture === 'stunned')            return StunEffect;
    return g ? ABILITIES[g]?.Effect ?? null : null;
  }

  function buildLabel(who, gesture, message) {
    if (gesture === 'stunned') return `${who}: Stunned! Cannot move!`;
    if (message) return `${who}: ${message}`;
    const name = ABILITIES[gesture]?.name?.toUpperCase();
    return name ? `${who}: ${name}` : null;
  }

  // ── resolving_first → resolving_second ────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_first') return;

    const timeout = setTimeout(() => {
      const r = pendingResolutionRef.current;

      // Stage 2: apply final states (second mover's hit lands on first mover)
      playerStateRef.current = r.playerFinal;
      botStateRef.current    = r.botFinal;
      setPlayerState(r.playerFinal);
      setBotState(r.botFinal);

      // Win/loss check #2: covers kills by second mover + propagates check #1
      const go = r.gameOverResult ??
        (r.playerFinal.hp <= 0 ? 'loss' : r.botFinal.hp <= 0 ? 'win' : null);
      if (go) setGameOver(go);

      // Stage 2 display: second mover's move
      setResolveMessage(buildLabel(!r.firstMoverIsPlayer ? 'YOU' : 'BOT', r.secondGesture, r.secondMessage));
      const secondEffect = getEffectComponent(r.secondEffectKey, r.secondGesture);
      setActiveEffect(!r.firstMoverIsPlayer && secondEffect ? () => secondEffect : null);
      setGamePhase('resolving_second');
    }, RESOLVE_SUB_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase]);

  // ── resolving_second → selecting ──────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_second') return;

    const timeout = setTimeout(() => {
      setActiveEffect(null);
      if (!gameOver) setGamePhase('selecting');
    }, RESOLVE_SUB_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase, gameOver]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="battle-root">
      {status && <div className="status-overlay">{status}</div>}
      {gamePhase === 'warmup' && !status && (
        <div className="warmup-overlay">
          <span className="warmup-text">Show your hands to begin</span>
        </div>
      )}

      {/* ── Left pane — player ── */}
      <div className="battle-pane battle-pane--player">
        <video
          ref={videoRef}
          className={showLandmarks ? 'game-video' : 'game-video game-video--visible'}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="game-canvas" style={showLandmarks ? {} : { display: 'none' }} />

        <DomainLayer activeDomain={playerState.activeDomain} />
        {activeEffect && (() => { const E = activeEffect; return <E />; })()}
        {playerState.multiTurnActive && (() => {
          const L = ABILITIES[playerState.multiTurnActive.abilityKey]?.LoopEffect;
          return L ? <L /> : null;
        })()}
        {playerState.activeDomain && (() => {
          const L = ABILITIES[playerState.activeDomain.abilityKey]?.LoopEffect;
          return L ? <L /> : null;
        })()}

        <StatsHUD state={playerState} baseSpeed={PLAYER_SPEED} />
        <AbilityDisplay gesture={currentGesture} loadout={loadout} />
        <LoadoutHUD loadout={loadout} />

        {/* Landmark toggle */}
        <button className="landmark-toggle-btn" onClick={() => setShowLandmarks(v => !v)}>
          {showLandmarks ? '📷 Camera' : '✋ Landmarks'}
        </button>

      </div>

      {/* ── Right pane — bot ── */}
      <div className="battle-pane battle-pane--opponent">
        <div className="opponent-avatar">
          <span className="opponent-avatar-icon">🤖</span>
          <span className="opponent-avatar-label">BOT</span>
        </div>
        <StatsHUD state={botState} baseSpeed={BOT_SPEED} />
        <LoadoutHUD loadout={BOT_LOADOUT} />
      </div>

      {/* ── Shared turn timer — centered over both panes ── */}
      <div className="battle-timer">
        <div className="turn-timer-label">
          {gamePhase === 'selecting'
            ? (playerState.multiTurnActive
                ? `Charging ${ABILITIES[playerState.multiTurnActive.abilityKey]?.name}`
                : confirmedGesture
                  ? `READY: ${ABILITIES[confirmedGesture]?.name}`
                  : 'SELECT YOUR MOVE')
            : (resolveMessage ?? 'NO MOVE')}
        </div>
        <div className="turn-timer-track">
          {gamePhase === 'selecting' && <div key={turnKey} className="turn-timer-fill" />}
        </div>
        {gamePhase === 'selecting' && confirmedGesture && !playerState.multiTurnActive && (
          <button className="cancel-move-btn" onClick={() => {
            lastGestureRef.current      = null;
            confirmedGestureRef.current = null;
            setConfirmedGesture(null);
          }}>✕ Cancel move</button>
        )}
      </div>

      {/* ── Back button ── */}
      <button className="back-button" onClick={onBack}>← Loadout</button>

      {/* ── Game over overlay ── */}
      {gameOver && (
        <div className="gameover-overlay">
          <span className={`gameover-text ${gameOver === 'win' ? 'gameover-text--win' : 'gameover-text--loss'}`}>{gameOver === 'win' ? 'VICTORY' : 'DEFEAT'}</span>
          <button className="gameover-btn" onClick={onBack}>← Back to Menu</button>
        </div>
      )}
    </div>
  );
}
