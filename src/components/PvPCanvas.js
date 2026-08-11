'use client';

import { useEffect, useRef, useState } from 'react';
import MultiUI from './MultiUI';
import { makeState } from '@/lib/gameState';
import { useGestureEngine } from '@/lib/useGestureEngine';
import { useWebRTC } from '@/lib/useWebRTC';
import { getEffectComponent, buildLabel } from '@/lib/effectHelper';
import { useVideoEffects } from '@/lib/useVideoEffects';
import { useDomainClash } from '@/lib/useDomainClash';
import { useResolutionPhases } from '@/lib/useResolutionPhases';
import { useLatestRef } from '@/lib/utils';

const TURN_DURATION_S     = 5;
const ZOOM                = 1.25;

export default function PvPCanvas({ loadout, build, opponentLoadout, opponentBuild, playerId, mp, onBack, onBattleEnd }) {
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
  const pendingResolutionRef  = useRef(null);
  const roundRef              = useRef(0);

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
    if (mp.disconnected) setGameOver(prev => prev ?? 'win');
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
  // The relay owns the round: it computes each turn's outcome and broadcasts
  // the result (see server/index.mjs's simulateRound) instead of raw gestures
  // — this effect's job is to render whatever it says, not recompute it. It
  // also owns the deadline: the countdown here is a display estimate synced
  // to the server's clock (mp.estimatedServerNow/roundDeadlineRef), not the
  // thing that actually decides when the turn ends — the relay's own timer
  // does that regardless of what this client does.
  useEffect(() => {
    if (gamePhase !== 'selecting') return;
    if (gameOver) return;

    let cancelled     = false;
    let tickInterval   = null;

    function beginRound(payload) {
      if (cancelled) return;
      setTurnKey(k => k + 1);

      roundRef.current = payload.round;
      const oppId  = playerId === 'p1' ? 'p2' : 'p1';
      const mine   = payload[playerId];
      const theirs = payload[oppId];

      playerStateRef.current   = mine.state;
      opponentStateRef.current = theirs.state;
      forcedGestureRef.current = mine.forcedGesture;

      setPlayerState(playerStateRef.current);
      setOpponentState(opponentStateRef.current);

      setConfirmedGesture(null);
      setResolveMessage(null);
      lastGestureRef.current      = null;
      confirmedGestureRef.current = null;

      let emitted = false;
      function emitOnce() {
        if (emitted) return;
        emitted = true;
        clearInterval(tickInterval);

        const thisRound    = roundRef.current;
        const playerLocked = forcedGestureRef.current ?? lastGestureRef.current;
        const playerSpeed  = Math.max(0, (playerStateRef.current.spd || 1) + (playerStateRef.current.speedMod || 0));
        forcedGestureRef.current = null;

        mp.emitGesture(playerLocked, playerSpeed, thisRound);

        mp.setOnTurnResolved((resolvedRound) => {
          if (resolvedRound !== thisRound) return; // stale result from a previous round
          mp.setOnClashStart(null);
          doResolve();
        });
        mp.setOnClashStart((resolvedRound) => {
          if (resolvedRound !== thisRound) return;
          mp.setOnTurnResolved(null);
          doClashStart();
        });
      }

      function tick() {
        const msLeft = (mp.roundDeadlineRef.current ?? 0) - mp.estimatedServerNow();
        timeLeftRef.current = Math.max(0, msLeft) / 1000;
        if (msLeft <= 0) emitOnce();
      }

      tick();
      tickInterval = setInterval(tick, 200);
    }

    const pending = mp.roundStartRef.current;
    if (pending) {
      mp.roundStartRef.current = null;
      beginRound(pending);
    } else {
      mp.setOnRoundStart(() => {
        const p = mp.roundStartRef.current;
        mp.roundStartRef.current = null;
        mp.setOnRoundStart(null);
        beginRound(p);
      });
    }

    return () => {
      cancelled = true;
      mp.setOnRoundStart(null);
      mp.setOnTurnResolved(null);
      mp.setOnClashStart(null);
      clearInterval(tickInterval);
    };
  }, [gamePhase, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reshapes the relay's already-computed p1/p2-keyed result into the
  // player/bot-relative shape useResolutionPhases.js expects — no game
  // logic here, the relay already decided everything.
  function doResolve() {
    const result = mp.turnResultRef.current;
    mp.turnResultRef.current = null;
    mp.setOnTurnResolved(null);
    mp.setOnClashStart(null);

    if (!result) return;
    if (result.round !== roundRef.current) return; // defensive: should be unreachable given the callback guard above

    const oppId = playerId === 'p1' ? 'p2' : 'p1';
    const firstMoverIsPlayer = result.firstMover === playerId;

    const resolved = {
      playerFinal:        result[`${playerId}Final`],
      botFinal:            result[`${oppId}Final`],
      playerIntermediate: result[`${playerId}Intermediate`],
      botIntermediate:     result[`${oppId}Intermediate`],
      firstMoverIsPlayer,
      firstEffectKey:  result.firstEffectKey,
      firstMessage:    result.firstMessage,
      firstGesture:    result.firstGesture,
      secondEffectKey: result.secondEffectKey,
      secondMessage:   result.secondMessage,
      secondGesture:   result.secondGesture,
    };
    if (result.gameOverWinner) {
      resolved.gameOverResult = result.gameOverWinner === playerId ? 'win' : 'loss';
    }
    pendingResolutionRef.current = resolved;

    playerStateRef.current   = resolved.playerIntermediate;
    opponentStateRef.current = resolved.botIntermediate;

    const firstMessage = buildLabel(firstMoverIsPlayer ? 'YOU' : 'OPP', resolved.firstGesture, resolved.firstMessage);
    const firstEffect  = getEffectComponent(resolved.firstEffectKey, resolved.firstGesture);

    const delay = Math.max(0, (result.resolveAt ?? Date.now()) - Date.now());
    setTimeout(() => {
      setPlayerState(resolved.playerIntermediate);
      setOpponentState(resolved.botIntermediate);
      setResolveMessage(firstMessage);
      setActiveEffect(firstMoverIsPlayer && firstEffect ? () => firstEffect : null);
      applyVideoEffectRef.current(resolved.firstGesture, firstMoverIsPlayer);
      setGamePhase('resolving_first');
    }, delay);
  }

  // Both sides cast a domain ability the same turn — the relay already
  // detected this (instead of a turn_resolved, it sent this) and will
  // resolve the clash itself once a winner is decided; just kick off the
  // existing duel UI at the scheduled reveal time.
  function doClashStart() {
    const payload = mp.clashStartRef.current;
    mp.clashStartRef.current = null;
    mp.setOnTurnResolved(null);
    mp.setOnClashStart(null);

    if (!payload) return;
    if (payload.round !== roundRef.current) return;

    const oppId     = playerId === 'p1' ? 'p2' : 'p1';
    const myDomain  = payload[`${playerId}Domain`];
    const oppDomain = payload[`${oppId}Domain`];
    const delay = Math.max(0, (payload.resolveAt ?? Date.now()) - Date.now());
    setTimeout(() => clash.initClash(myDomain, oppDomain, payload.resolveAt ?? Date.now()), delay);
  }

  // ── Battle end callback ───────────────────────────────────────────────────
  // The relay independently simulates the match and signs a result token —
  // its computation is immediate, while gameOver here is animation-paced, so
  // the token has almost always already arrived. Wait briefly for it anyway
  // rather than recording an unverified result.
  useEffect(() => {
    if (!gameOver || !onBattleEnd) return;

    if (mp.resultTokenRef.current) {
      onBattleEnd(gameOver, mp.resultTokenRef.current);
      return;
    }

    const timeout = setTimeout(() => {
      mp.setOnMatchResult(null);
      onBattleEnd(gameOver, mp.resultTokenRef.current);
    }, 1500);

    mp.setOnMatchResult((token) => {
      clearTimeout(timeout);
      mp.setOnMatchResult(null);
      onBattleEnd(gameOver, token);
    });

    return () => {
      clearTimeout(timeout);
      mp.setOnMatchResult(null);
    };
  }, [gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

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
