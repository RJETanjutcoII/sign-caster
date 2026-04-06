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
import { makeState, applyStartOfTurn, resolveTurn } from '@/lib/gameState';
import { useGestureEngine } from '@/lib/useGestureEngine';

const TURN_DURATION_S    = 5;   // gesture selection window
const RESOLVE_DURATION_S = 4;   // time to display the effect before next round

export default function TrainingCanvas({ loadout, build, onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // Turn state
  const [gamePhase,       setGamePhase]       = useState('warmup'); // 'warmup' | 'selecting' | 'resolving'
  const timeLeftRef = useRef(TURN_DURATION_S);
  const [turnKey,         setTurnKey]         = useState(0);
  const [confirmedGesture, setConfirmedGesture] = useState(null);
  const [lockedGesture,   setLockedGesture]   = useState(null);
  const [activeEffect,    setActiveEffect]    = useState(null);
  const [resolveMessage,  setResolveMessage]  = useState(null);

  const gamePhaseRef    = useRef('warmup');
  const forcedGestureRef = useRef(null);

  // Player game state
  const playerInit = makeState(build);
  const [playerState, setPlayerState] = useState(playerInit);
  const playerStateRef = useRef(playerInit);

  // Debug / dev helpers
  const [showLandmarks, setShowLandmarks] = useState(false);
  const showLandmarksRef = useRef(false);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { showLandmarksRef.current = showLandmarks; }, [showLandmarks]);

  // ── Gesture engine ────────────────────────────────────────────────────────
  const { status, currentGesture, confirmedGestureRef, lastGestureRef } = useGestureEngine({
    loadout,
    videoRef,
    canvasRef,
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

    // Restart the timer bar animation for this turn
    setTurnKey(k => k + 1);

    // Start-of-turn: tick DoT, stun, determine if a gesture is forced
    const { newState: sotState, forcedGesture } = applyStartOfTurn(playerStateRef.current);
    playerStateRef.current = sotState;
    setPlayerState(sotState);
    forcedGestureRef.current = forcedGesture;

    // Reset selection UI
    timeLeftRef.current = TURN_DURATION_S;
    setConfirmedGesture(null);
    setResolveMessage(null);
    lastGestureRef.current      = null;
    confirmedGestureRef.current = null;

    const interval = setInterval(() => {
      let didExpire = false;

      timeLeftRef.current -= 1;
      if (timeLeftRef.current <= 0) { didExpire = true; clearInterval(interval); }

      if (didExpire) {
        // Forced gesture (stun / spirit bomb) overrides player choice
        const locked = forcedGestureRef.current ?? lastGestureRef.current;
        forcedGestureRef.current = null;

        // Resolve mechanics — runs exactly once per turn
        const { newState: resolved, effectKey, message: resolveMsg } = resolveTurn(playerStateRef.current, locked);
        playerStateRef.current = resolved;
        setPlayerState(resolved);
        setResolveMessage(resolveMsg ?? null);

        // Visual — pick the Effect component to render
        const displayLocked = locked === 'stunned' ? null : locked;
        setLockedGesture(displayLocked);
        setGamePhase('resolving');

        let EffectComponent = null;
        if (effectKey === 'rest')                                  EffectComponent = RestEffect;
        else if (effectKey === 'fail')                             EffectComponent = FailEffect;
        else if (effectKey === 'multi_turn_start' && displayLocked) EffectComponent = ABILITIES[displayLocked]?.ChargeEffect ?? null;
        else if (effectKey === 'multi_turn_final' && displayLocked) EffectComponent = ABILITIES[displayLocked]?.Effect ?? null;
        else if (effectKey === 'domain_start' && displayLocked)    EffectComponent = ABILITIES[displayLocked]?.Effect ?? null;
        else if (locked === 'stunned')                             EffectComponent = StunEffect;
        else if (displayLocked)                                    EffectComponent = ABILITIES[displayLocked]?.Effect ?? null;
        setActiveEffect(() => EffectComponent);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase]);

  useEffect(() => {
    if (gamePhase !== 'resolving') return;

    const timeout = setTimeout(() => {
      setActiveEffect(null);
      setLockedGesture(null);
      setGamePhase('selecting');
    }, RESOLVE_DURATION_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase]);

  // ── Render ────────────────────────────────────────────────────────────────


  return (
    <div className="game-root">
      {status && <div className="status-overlay">{status}</div>}
      {gamePhase === 'warmup' && !status && (
        <div className="warmup-overlay">
          <span className="warmup-text">Show your hands to begin</span>
        </div>
      )}

      <video
        ref={videoRef}
        className={showLandmarks ? 'game-video' : 'game-video game-video--visible'}
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="game-canvas" style={showLandmarks ? {} : { display: 'none' }} />

      <DomainLayer activeDomain={playerState.activeDomain} />

      {activeEffect && (() => { const E = activeEffect; return <E />; })()}
      {gamePhase === 'selecting' && playerState.multiTurnActive && (() => {
        const L = ABILITIES[playerState.multiTurnActive.abilityKey]?.LoopEffect;
        return L ? <L /> : null;
      })()}
      {gamePhase === 'selecting' && playerState.activeDomain && (() => {
        const L = ABILITIES[playerState.activeDomain.abilityKey]?.LoopEffect;
        return L ? <L /> : null;
      })()}

      <button className="back-button" onClick={onBack}>← Loadout</button>

      {/* Debug panel — top right */}
      <div className="debug-panel">
        <span className="debug-label">DEBUG</span>
        <button className="debug-btn" onClick={() => {
          const s = { ...playerStateRef.current, mana: playerStateRef.current.maxMana };
          playerStateRef.current = s;
          setPlayerState(s);
        }}>Fill Mana</button>
        <button className="debug-btn" onClick={() => {
          const s = { ...playerStateRef.current, ultBar: playerStateRef.current.maxUlt };
          playerStateRef.current = s;
          setPlayerState(s);
        }}>Fill Ult</button>
      </div>

      {/* Landmark toggle — bottom left */}
      <button
        className="landmark-toggle-btn"
        onClick={() => setShowLandmarks(v => !v)}
      >
        {showLandmarks ? '📷 Camera' : '✋ Landmarks'}
      </button>

      {/* Turn timer bar */}
      <div className="turn-timer">
        <div className="turn-timer-label">
          {gamePhase === 'selecting'
            ? (playerState.multiTurnActive
                ? `Charging ${ABILITIES[playerState.multiTurnActive.abilityKey]?.name}`
                : confirmedGesture
                  ? `READY: ${ABILITIES[confirmedGesture]?.name}`
                  : 'SELECT YOUR MOVE')
            : (resolveMessage ?? ABILITIES[lockedGesture]?.name?.toUpperCase() ?? 'NO MOVE')}
        </div>
        <div className="turn-timer-track">
          {gamePhase === 'selecting' && (
            <div key={turnKey} className="turn-timer-fill" />
          )}
        </div>

        {/* Only show cancel once a move has been confirmed */}
        {gamePhase === 'selecting' && confirmedGesture && !playerState.multiTurnActive && (
          <button
            className="cancel-move-btn"
            onClick={() => {
              lastGestureRef.current      = null;
              confirmedGestureRef.current = null;
              setConfirmedGesture(null);
            }}
          >
            ✕ Cancel move
          </button>
        )}
      </div>

      <StatsHUD state={playerState} />
      <AbilityDisplay gesture={currentGesture} loadout={loadout} />
      <LoadoutHUD loadout={loadout} />
    </div>
  );
}
