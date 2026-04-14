'use client';

import { useEffect, useRef, useState } from 'react';
import MultiUI from './MultiUI';
import { makeState, applyStartOfTurn, applyIncoming, resolveOrderedTurns } from '@/lib/gameState';
import { BOT_LOADOUT, BOT_BUILD, chooseBotGesture } from '@/lib/bot';
import { useGestureEngine } from '@/lib/useGestureEngine';
import { getEffectComponent, buildLabel } from '@/lib/effectHelper';
import { useVideoEffects } from '@/lib/useVideoEffects';

const TURN_DURATION_S = 5;
const RESOLVE_SUB_S   = 2;
const ZOOM            = 1.25;

export default function BotCanvas({ loadout, build, onBack }) {
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
  const playerInit = makeState(build);
  const [playerState, setPlayerState] = useState(playerInit);
  const playerStateRef  = useRef(playerInit);

  // ── Bot state ─────────────────────────────────────────────────────────────
  const botInit = makeState(BOT_BUILD);
  const [botState, setBotState] = useState(botInit);
  const botStateRef        = useRef(botInit);
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

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'selecting') return;
    if (gameOver) return;

    setTurnKey(k => k + 1);

    // Start of turn — player
    const { newState: sotState, forcedGesture, domainOutgoing: playerDomainOut } = applyStartOfTurn(playerStateRef.current);
    playerStateRef.current = sotState;
    forcedGestureRef.current = forcedGesture;

    // Apply player's domain outgoing to bot BEFORE bot SOT
    if (playerDomainOut.damage > 0 || playerDomainOut.stunTurns > 0) {
      botStateRef.current = applyIncoming({ ...botStateRef.current, nullified: false }, playerDomainOut);
    }

    // Start of turn — bot
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

      const playerSpeed = Math.max(0, (playerStateRef.current.spd || 1) + (playerStateRef.current.speedMod || 0));
      const botSpeed    = Math.max(0, (botStateRef.current.spd    || 1) + (botStateRef.current.speedMod    || 0));
      const result = resolveOrderedTurns(
        playerStateRef.current, playerLocked, playerSpeed,
        botStateRef.current,    botLocked,    botSpeed
      );
      pendingResolutionRef.current = result;

      playerStateRef.current = result.playerIntermediate;
      botStateRef.current    = result.botIntermediate;
      setPlayerState(result.playerIntermediate);
      setBotState(result.botIntermediate);

      if (result.playerIntermediate.hp <= 0 || result.botIntermediate.hp <= 0) {
        pendingResolutionRef.current.gameOverResult =
          result.playerIntermediate.hp <= 0 ? 'loss' : 'win';
      }

      setResolveMessage(buildLabel(result.firstMoverIsPlayer ? 'YOU' : 'BOT', result.firstGesture, result.firstMessage));
      const firstEffect = getEffectComponent(result.firstEffectKey, result.firstGesture);
      setActiveEffect(result.firstMoverIsPlayer && firstEffect ? () => firstEffect : null);
      applyVideoEffect(result.firstGesture, result.firstMoverIsPlayer);
      setGamePhase('resolving_first');
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, gameOver]);

  // ── resolving_first → resolving_second ────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_first') return;

    const timeout = setTimeout(() => {
      const r = pendingResolutionRef.current;

      playerStateRef.current = r.playerFinal;
      botStateRef.current    = r.botFinal;
      setPlayerState(r.playerFinal);
      setBotState(r.botFinal);

      const go = r.gameOverResult ??
        (r.playerFinal.hp <= 0 ? 'loss' : r.botFinal.hp <= 0 ? 'win' : null);
      if (go) setGameOver(go);

      setResolveMessage(buildLabel(!r.firstMoverIsPlayer ? 'YOU' : 'BOT', r.secondGesture, r.secondMessage));
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
      clearVideoEffect();
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
      opponentState={botState}
      opponentLoadout={BOT_LOADOUT}
      opponentLabel="BOT"
      opponentIcon="🤖"
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
