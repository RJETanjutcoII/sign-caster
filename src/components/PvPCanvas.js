'use client';

import { useEffect, useRef, useState } from 'react';
import MultiUI from './MultiUI';
import { makeState, applyStartOfTurn, applyIncoming, resolveOrderedTurns } from '@/lib/gameState';
import { useGestureEngine } from '@/lib/useGestureEngine';
import { useWebRTC } from '@/lib/useWebRTC';
import { getEffectComponent, buildLabel } from '@/lib/effectHelper';
import { useVideoEffects } from '@/lib/useVideoEffects';
import { ABILITIES } from '@/lib/abilities';
import { useDomainClash } from '@/lib/useDomainClash';
import { useResolutionPhases } from '@/lib/useResolutionPhases';
import { useLatestRef } from '@/lib/utils';

const TURN_DURATION_S     = 5;
const OPPONENT_TIMEOUT_MS = 3000;
const ZOOM                = 1.25;

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

  const gamePhaseRef     = useRef('warmup');
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

  // ── Clash bridge refs (created here so both hooks can share them) ─────────
  const duelTargetGestureRef = useRef(null);
  const handleDuelResultRef  = useRef(null);

  // ── Dev helpers ───────────────────────────────────────────────────────────
  const [showLandmarks, setShowLandmarks] = useState(false);
  const showLandmarksRef = useRef(false);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { showLandmarksRef.current = showLandmarks; }, [showLandmarks]);

  // ── Gesture engine ────────────────────────────────────────────────────────
  const { status, currentGesture, confirmedGestureRef, lastGestureRef,
          compositeCanvasRef, setActiveBackground, fps } = useGestureEngine({
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
    duelTargetGestureRef,
    onDuelConfirm: () => handleDuelResultRef.current?.(),
  });

  const { playerVideoEffect, backgroundActive, applyVideoEffect, clearVideoEffect } =
    useVideoEffects({ setActiveBackground, activeDomain: playerState?.activeDomain });

  const applyVideoEffectRef = useLatestRef(applyVideoEffect);
  const clearVideoEffectRef = useLatestRef(clearVideoEffect);

  // ── Domain clash ──────────────────────────────────────────────────────────
  const clash = useDomainClash({
    gamePhase, setGamePhase,
    playerStateRef, opponentStateRef, setPlayerState, setOpponentState,
    setActiveEffect, applyVideoEffectRef, clearVideoEffectRef,
    duelTargetGestureRef, handleDuelResultRef,
    mode: 'pvp', mp, playerId,
  });

  // ── Opponent camera (WebRTC) ──────────────────────────────────────────────
  const opponentVideoRef = useRef(null);
  const { opponentStream } = useWebRTC({ mp, playerId, localVideoRef: videoRef, compositeCanvasRef, backgroundActive, enabled: true });

  useEffect(() => {
    if (opponentVideoRef.current && opponentStream) {
      opponentVideoRef.current.srcObject = opponentStream;
    }
  }, [opponentStream]);

  // ── Disconnect handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (mp.disconnected) setGameOver('win');
  }, [mp.disconnected]);

  // ── Shared resolution phase transitions ──────────────────────────────────
  useResolutionPhases({
    gamePhase, gameOver,
    pendingResolutionRef,
    playerStateRef, opponentStateRef,
    setPlayerState, setOpponentState,
    setGameOver, setGamePhase,
    setResolveMessage, setActiveEffect,
    applyVideoEffectRef, clearVideoEffectRef,
    opponentLabel: 'OPP',
  });

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'selecting') return;
    if (gameOver) return;

    setTurnKey(k => k + 1);

    const { newState: sotState, forcedGesture, domainOutgoing: playerDomainOut } = applyStartOfTurn(playerStateRef.current);
    playerStateRef.current = sotState;
    forcedGestureRef.current = forcedGesture;

    if (playerDomainOut.damage > 0 || playerDomainOut.stunTurns > 0) {
      opponentStateRef.current = applyIncoming({ ...opponentStateRef.current, nullified: false }, playerDomainOut);
    }

    const { newState: oppSot, domainOutgoing: oppDomainOut } = applyStartOfTurn(opponentStateRef.current);
    opponentStateRef.current = oppSot;

    if (oppDomainOut.damage > 0 || oppDomainOut.stunTurns > 0) {
      playerStateRef.current = applyIncoming(playerStateRef.current, oppDomainOut);
      // Domain tick stuns run after player SOT, so forcedGestureRef is already set.
      // If a stun just landed and the player has no forced gesture yet, apply it now.
      if (oppDomainOut.stunTurns > 0 && playerStateRef.current.stunTurnsRemaining > 0 && forcedGestureRef.current === null) {
        playerStateRef.current = { ...playerStateRef.current, stunTurnsRemaining: playerStateRef.current.stunTurnsRemaining - 1 };
        forcedGestureRef.current = 'stunned';
      }
    }
    setPlayerState(playerStateRef.current);
    setOpponentState(opponentStateRef.current);

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

      mp.emitGesture(playerLocked, playerSpeed);

      const resolveTimeout = setTimeout(() => {
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
  }, [gamePhase, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  function doResolve(playerLocked, playerSpeed) {
    const result = mp.turnResultRef.current;
    mp.turnResultRef.current = null;
    mp.setOnTurnResolved(null);

    if (!result) return;

    const myResult  = result[playerId];
    const oppId     = playerId === 'p1' ? 'p2' : 'p1';
    const oppResult = result[oppId];
    const oppLocked = oppResult.gesture;
    const oppSpeed  = Math.max(0, (opponentStateRef.current.spd || 1) + (opponentStateRef.current.speedMod || 0));

    // ── Domain clash detection ─────────────────────────────────────────────
    const playerIsDomain = ABILITIES[myResult.gesture]?.turnType === 'domain';
    const oppIsDomain    = ABILITIES[oppLocked]?.turnType === 'domain';
    const noDomainActive = !playerStateRef.current.activeDomain && !opponentStateRef.current.activeDomain;

    if (playerIsDomain && oppIsDomain && noDomainActive) {
      const delay = Math.max(0, (result.resolveAt ?? Date.now()) - Date.now());
      setTimeout(() => clash.initClash(myResult.gesture, oppLocked, result.resolveAt ?? Date.now()), delay);
      return;
    }

    const p1GoesFirst = (result.resolveAt ?? 0) % 2 === 0;
    const coinFlip    = playerId === 'p1' ? p1GoesFirst : !p1GoesFirst;

    const resolved = resolveOrderedTurns(
      playerStateRef.current,   myResult.gesture ?? playerLocked, playerSpeed,
      opponentStateRef.current, oppLocked,                         oppSpeed,
      coinFlip
    );
    pendingResolutionRef.current = resolved;

    playerStateRef.current   = resolved.playerIntermediate;
    opponentStateRef.current = resolved.botIntermediate;

    if (resolved.playerIntermediate.hp <= 0 || resolved.botIntermediate.hp <= 0) {
      pendingResolutionRef.current.gameOverResult =
        resolved.playerIntermediate.hp <= 0 ? 'loss' : 'win';
    }

    const firstMessage = buildLabel(resolved.firstMoverIsPlayer ? 'YOU' : 'OPP', resolved.firstGesture, resolved.firstMessage);
    const firstEffect  = getEffectComponent(resolved.firstEffectKey, resolved.firstGesture);

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
      clashScores={clash.clashScores}
      clashRound={clash.clashRound}
      clashPromptGesture={clash.clashPromptGesture}
      clashWinner={clash.clashWinner}
      clashPlayerDomain={clash.clashPlayerDomainRef.current}
      clashOppDomain={clash.clashOppDomainRef.current}
    />
  );
}
