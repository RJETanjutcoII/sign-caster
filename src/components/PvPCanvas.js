'use client';

import { useEffect, useRef, useState } from 'react';
import MultiUI from './MultiUI';
import { makeState, applyStartOfTurn, applyIncoming, resolveOrderedTurns } from '@/lib/gameState';
import { useGestureEngine } from '@/lib/useGestureEngine';
import { useWebRTC } from '@/lib/useWebRTC';
import { getEffectComponent, buildLabel } from '@/lib/effectHelper';
import { useVideoEffects } from '@/lib/useVideoEffects';

const TURN_DURATION_S = 5;
const RESOLVE_SUB_S   = 2;
const OPPONENT_TIMEOUT_MS = 3000;
const ZOOM = 1.25;

export default function PvPCanvas({ loadout, build, opponentLoadout, opponentBuild, playerId, mp, onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // ── Turn state ────────────────────────────────────────────────────────────
  const [gamePhase,        setGamePhase]        = useState('warmup');
  const timeLeftRef = useRef(TURN_DURATION_S);
  const [turnKey,          setTurnKey]          = useState(0);
  const [confirmedGesture, setConfirmedGesture] = useState(null);
  const [activeEffect,     setActiveEffect]     = useState(null);
  const [resolveMessage,   setResolveMessage]   = useState(null);
  const [gameOver,         setGameOver]         = useState(null);

  const gamePhaseRef    = useRef('warmup');
  const forcedGestureRef = useRef(null);

  // ── Player state ──────────────────────────────────────────────────────────
  const playerInit   = makeState(build);
  const opponentInit = makeState(opponentBuild);

  const [playerState,   setPlayerState]   = useState(playerInit);
  const [opponentState, setOpponentState] = useState(opponentInit);
  const playerStateRef   = useRef(playerInit);
  const opponentStateRef = useRef(opponentInit);

  // ── Pending resolution ────────────────────────────────────────────────────
  const pendingResolutionRef = useRef(null);

  // ── Dev helpers ───────────────────────────────────────────────────────────
  const [showLandmarks, setShowLandmarks] = useState(false);
  const showLandmarksRef = useRef(false);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { showLandmarksRef.current = showLandmarks; }, [showLandmarks]);

  // ── Gesture engine ────────────────────────────────────────────────────────
  const { status, currentGesture, confirmedGestureRef, lastGestureRef, compositeCanvasRef, setActiveBackground, fps } = useGestureEngine({
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

  const { playerVideoEffect, backgroundActive, applyVideoEffect, clearVideoEffect } =
    useVideoEffects({ setActiveBackground, activeDomain: playerState?.activeDomain });

  // Stable refs for applyVideoEffect/clearVideoEffect — prevents stale captures in doResolve closure
  const applyVideoEffectRef = useRef(applyVideoEffect);
  applyVideoEffectRef.current = applyVideoEffect;
  const clearVideoEffectRef = useRef(clearVideoEffect);
  clearVideoEffectRef.current = clearVideoEffect;

  // ── Opponent camera (WebRTC) ──────────────────────────────────────────────
  const opponentVideoRef = useRef(null);
  const { opponentStream } = useWebRTC({ mp, playerId, localVideoRef: videoRef, enabled: gamePhase !== 'warmup' });

  useEffect(() => {
    if (opponentVideoRef.current && opponentStream) {
      opponentVideoRef.current.srcObject = opponentStream;
    }
  }, [opponentStream]);

  // ── Disconnect handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (mp.disconnected) setGameOver('win'); // opponent left = you win
  }, [mp.disconnected]);

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'selecting') return;
    if (gameOver) return;

    setTurnKey(k => k + 1);

    // Start of turn — player
    const { newState: sotState, forcedGesture, domainOutgoing: playerDomainOut } = applyStartOfTurn(playerStateRef.current);
    playerStateRef.current = sotState;
    forcedGestureRef.current = forcedGesture;

    // Apply player's domain outgoing to opponent BEFORE opponent SOT
    if (playerDomainOut.damage > 0 || playerDomainOut.stunTurns > 0) {
      opponentStateRef.current = applyIncoming({ ...opponentStateRef.current, nullified: false }, playerDomainOut);
    }

    // Opponent SOT (computed locally — deterministic mirror of their client)
    const { newState: oppSot, domainOutgoing: oppDomainOut } = applyStartOfTurn(opponentStateRef.current);
    opponentStateRef.current = oppSot;

    if (oppDomainOut.damage > 0 || oppDomainOut.stunTurns > 0) {
      playerStateRef.current = applyIncoming(playerStateRef.current, oppDomainOut);
    }
    setPlayerState(playerStateRef.current);
    setOpponentState(opponentStateRef.current);

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
      const playerSpeed  = Math.max(0, (playerStateRef.current.spd || 1) + (playerStateRef.current.speedMod || 0));
      forcedGestureRef.current = null;

      // Emit our gesture to the server
      mp.emitGesture(playerLocked, playerSpeed);

      // Wait for opponent gesture (server sends turn_resolved with both)
      const resolveTimeout = setTimeout(() => {
        // Timeout fallback: treat opponent as rested
        if (!mp.turnResultRef.current) {
          mp.turnResultRef.current = playerId === 'p1'
            ? { p1: { gesture: playerLocked, speed: playerSpeed }, p2: { gesture: null, speed: 1 } }
            : { p1: { gesture: null, speed: 1 }, p2: { gesture: playerLocked, speed: playerSpeed } };
        }
        doResolve(playerLocked, playerSpeed);
      }, OPPONENT_TIMEOUT_MS);

      mp.setOnTurnResolved(() => {
        clearTimeout(resolveTimeout);
        doResolve(playerLocked, playerSpeed);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, gameOver]);

  function doResolve(playerLocked, playerSpeed) {
    const result = mp.turnResultRef.current;
    mp.turnResultRef.current = null;
    mp.setOnTurnResolved(null);

    if (!result) return;

    // Map p1/p2 to player/opponent based on our playerId
    const myResult  = result[playerId];
    const oppId     = playerId === 'p1' ? 'p2' : 'p1';
    const oppResult = result[oppId];

    const oppLocked = oppResult.gesture;
    const oppSpeed  = Math.max(0, (opponentStateRef.current.spd || 1) + (opponentStateRef.current.speedMod || 0));

    // Tiebreak: resolveAt parity is identical on both clients — no explicit coinFlip needed
    // Even resolveAt = p1 goes first (from p1's perspective); odd = p2 goes first
    const p1GoesFirst = (result.resolveAt ?? 0) % 2 === 0;
    const coinFlip = playerId === 'p1' ? p1GoesFirst : !p1GoesFirst;

    const resolved = resolveOrderedTurns(
      playerStateRef.current,   myResult.gesture ?? playerLocked,  playerSpeed,
      opponentStateRef.current, oppLocked,                          oppSpeed,
      coinFlip
    );
    pendingResolutionRef.current = resolved;

    // Update refs immediately — needed for correct logic on the next turn
    playerStateRef.current   = resolved.playerIntermediate;
    opponentStateRef.current = resolved.botIntermediate;

    if (resolved.playerIntermediate.hp <= 0 || resolved.botIntermediate.hp <= 0) {
      pendingResolutionRef.current.gameOverResult =
        resolved.playerIntermediate.hp <= 0 ? 'loss' : 'win';
    }

    const firstMessage = buildLabel(resolved.firstMoverIsPlayer ? 'YOU' : 'OPP', resolved.firstGesture, resolved.firstMessage);
    const firstEffect  = getEffectComponent(resolved.firstEffectKey, resolved.firstGesture);

    // Delay all UI state until resolveAt so both clients enter resolving_first simultaneously
    const delay = Math.max(0, (result.resolveAt ?? Date.now()) - Date.now());
    setTimeout(() => {
      setPlayerState(resolved.playerIntermediate);
      setOpponentState(resolved.botIntermediate);
      setResolveMessage(firstMessage);
      setActiveEffect(resolved.firstMoverIsPlayer && firstEffect ? () => firstEffect : null);
      applyVideoEffectRef.current(resolved.firstGesture, resolved.firstMoverIsPlayer);
      setGamePhase('resolving_first');
    }, delay);
  }

  // ── resolving_first → resolving_second ────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_first') return;

    const timeout = setTimeout(() => {
      const r = pendingResolutionRef.current;

      playerStateRef.current   = r.playerFinal;
      opponentStateRef.current = r.botFinal;
      setPlayerState(r.playerFinal);
      setOpponentState(r.botFinal);

      const go = r.gameOverResult ??
        (r.playerFinal.hp <= 0 ? 'loss' : r.botFinal.hp <= 0 ? 'win' : null);
      if (go) setGameOver(go);

      setResolveMessage(buildLabel(!r.firstMoverIsPlayer ? 'YOU' : 'OPP', r.secondGesture, r.secondMessage));
      const secondEffect = getEffectComponent(r.secondEffectKey, r.secondGesture);
      setActiveEffect(!r.firstMoverIsPlayer && secondEffect ? () => secondEffect : null);
      applyVideoEffect(r.secondGesture, !r.firstMoverIsPlayer);
      setGamePhase('resolving_second');
    }, RESOLVE_SUB_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase]);

  // ── resolving_second → selecting ──────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_second') return;

    const timeout = setTimeout(() => {
      setActiveEffect(null);
      clearVideoEffectRef.current();
      if (!gameOver) setGamePhase('selecting');
    }, RESOLVE_SUB_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase, gameOver]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MultiUI
      status={status}
      gamePhase={gamePhase}
      gameOver={gameOver}
      onBack={onBack}
      videoRef={videoRef}
      canvasRef={canvasRef}
      showLandmarks={showLandmarks}
      onToggleLandmarks={() => setShowLandmarks(v => !v)}
      playerState={playerState}
      loadout={loadout}
      currentGesture={currentGesture}
      activeEffect={activeEffect}
      playerVideoEffect={playerVideoEffect}
      compositeCanvasRef={compositeCanvasRef}
      backgroundActive={backgroundActive}
      fps={fps}
      opponentState={opponentState}
      opponentLoadout={opponentLoadout}
      opponentLabel="OPP"
      opponentIcon="👤"
      opponentVideoRef={opponentStream ? opponentVideoRef : null}
      turnKey={turnKey}
      confirmedGesture={confirmedGesture}
      resolveMessage={resolveMessage}
      onCancelMove={() => {
        lastGestureRef.current      = null;
        confirmedGestureRef.current = null;
        setConfirmedGesture(null);
      }}
    />
  );
}
