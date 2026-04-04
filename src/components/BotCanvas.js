'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { detectThumbsDown } from '@/lib/gestures';
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

const HOLD_THRESHOLD_MS  = 300;
const TURN_DURATION_S    = 5;
const RESOLVE_DURATION_S = 4;
const PLAYER_SPEED       = 2;
const BOT_SPEED          = 1;

const ZOOM        = 1.25;
const ZOOM_OFFSET = (1 - 1 / ZOOM) / 2;
const ZOOM_SCALE  = 1 / ZOOM;

export default function BotCanvas({ loadout, onBack }) {
  const videoRef          = useRef(null);
  const canvasRef         = useRef(null);
  const landmarkerRef     = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const rafRef            = useRef(null);
  const zoomCanvasRef     = useRef(null);

  const frameCountRef          = useRef(0);
  const lastFaceTsRef          = useRef(0);
  const cachedFaceLandmarksRef = useRef(null);
  const gestureHoldRef         = useRef({ gesture: null, since: 0 });

  // ── Turn state ────────────────────────────────────────────────────────────
  const [gamePhase,        setGamePhase]        = useState('warmup'); // 'warmup' | 'selecting' | 'resolving'
  const timeLeftRef = useRef(TURN_DURATION_S);
  const [turnKey,          setTurnKey]          = useState(0);
  const [confirmedGesture, setConfirmedGesture] = useState(null);
  const [lockedGesture,    setLockedGesture]    = useState(null);
  const [activeEffect,     setActiveEffect]     = useState(null);
  const [resolveMessage,   setResolveMessage]   = useState(null);
  const [currentGesture,   setCurrentGesture]   = useState(null);
  const [status,           setStatus]           = useState('Initializing...');
  const [gameOver,         setGameOver]         = useState(null); // null | 'win' | 'loss'

  const gamePhaseRef        = useRef('warmup');
  const warmupCountRef      = useRef(0);
  const lastGestureRef      = useRef(null);
  const confirmedGestureRef = useRef(null);

  // ── Player state ──────────────────────────────────────────────────────────
  const [playerState, setPlayerState] = useState(INITIAL_STATE);
  const playerStateRef  = useRef(INITIAL_STATE);
  const forcedGestureRef = useRef(null);

  // ── Bot state ─────────────────────────────────────────────────────────────
  const [botState, setBotState] = useState(INITIAL_STATE);
  const botStateRef        = useRef(INITIAL_STATE);
  const botForcedGestureRef = useRef(null);
  const botLockedGestureRef = useRef(null);

  // ── Dev helpers ───────────────────────────────────────────────────────────
  const [showLandmarks, setShowLandmarks] = useState(false);
  const showLandmarksRef  = useRef(false);
  const currentGestureRef = useRef(null);
  const lastInferenceRef  = useRef(0);

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { showLandmarksRef.current = showLandmarks; }, [showLandmarks]);

  const hasFaceGesture = useMemo(
    () => [...loadout].some(key => ABILITIES[key]?.gestureType === 'face' || ABILITIES[key]?.needsFace),
    [loadout]
  );
  const hasFaceGestureRef = useRef(hasFaceGesture);
  useEffect(() => { hasFaceGestureRef.current = hasFaceGesture; }, [hasFaceGesture]);

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'selecting') return;
    if (gameOver) return;

    setTurnKey(k => k + 1);

    // Start of turn — player
    const { newState: sotState, forcedGesture, domainOutgoing: playerDomainOut } = applyStartOfTurn(playerStateRef.current);
    playerStateRef.current = sotState;
    forcedGestureRef.current = forcedGesture;

    // Start of turn — bot
    const { newState: botSot, forcedGesture: botForced, domainOutgoing: botDomainOut } = applyStartOfTurn(botStateRef.current);
    botStateRef.current = botSot;
    const botChoice = botForced ?? chooseBotGesture(botSot, BOT_LOADOUT);
    botLockedGestureRef.current = botChoice;
    botForcedGestureRef.current = botForced;

    // Cross-apply domain outgoing (e.g. Unlimited Void stun, Malevolent Shrine damage)
    if (playerDomainOut.damage > 0 || playerDomainOut.stunTurns > 0) {
      botStateRef.current = applyIncoming(botStateRef.current, playerDomainOut);
    }
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

      // Resolve with speed/priority ordering
      const { playerFinal, botFinal, effectKey, message: resolveMsg } =
        resolveOrderedTurns(
          playerStateRef.current, playerLocked, PLAYER_SPEED,
          botStateRef.current,    botLocked,    BOT_SPEED
        );

      playerStateRef.current = playerFinal;
      botStateRef.current    = botFinal;
      setPlayerState(playerFinal);
      setBotState(botFinal);
      setResolveMessage(resolveMsg ?? null);

      // Win / loss check
      if (playerFinal.hp <= 0 || botFinal.hp <= 0) {
        setGameOver(playerFinal.hp <= 0 ? 'loss' : 'win');
      }

      // Pick effect component
      const displayLocked = playerLocked === 'stunned' ? null : playerLocked;
      setLockedGesture(displayLocked);
      setGamePhase('resolving');

      let EffectComponent = null;
      if (effectKey === 'rest')                                    EffectComponent = RestEffect;
      else if (effectKey === 'fail')                               EffectComponent = FailEffect;
      else if (effectKey === 'multi_turn_start' && displayLocked)  EffectComponent = ABILITIES[displayLocked]?.ChargeEffect ?? null;
      else if (effectKey === 'multi_turn_final' && displayLocked)  EffectComponent = ABILITIES[displayLocked]?.Effect ?? null;
      else if (effectKey === 'domain_start' && displayLocked)      EffectComponent = ABILITIES[displayLocked]?.Effect ?? null;
      else if (playerLocked === 'stunned')                         EffectComponent = StunEffect;
      else if (displayLocked)                                      EffectComponent = ABILITIES[displayLocked]?.Effect ?? null;
      setActiveEffect(() => EffectComponent);
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase, gameOver]);

  useEffect(() => {
    if (gamePhase !== 'resolving') return;

    const timeout = setTimeout(() => {
      setActiveEffect(null);
      setLockedGesture(null);
      if (!gameOver) setGamePhase('selecting');
    }, RESOLVE_DURATION_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase, gameOver]);

  // ── Drawing ───────────────────────────────────────────────────────────────
  function drawFaceLandmarks(ctx, landmarks, width, height) {
    const HIGHLIGHTED = new Set([10, 33, 133, 159, 145, 160, 144, 362, 263, 386, 374, 387, 373]);
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const x = (1 - (ZOOM_OFFSET + lm.x * ZOOM_SCALE)) * width;
      const y = (ZOOM_OFFSET + lm.y * ZOOM_SCALE) * height;
      ctx.beginPath();
      if (HIGHLIGHTED.has(i)) {
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 210, 60, 0.9)';
      } else {
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 130, 255, 0.55)';
      }
      ctx.fill();
    }
  }

  function drawLandmarks(ctx, landmarks, width, height) {
    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],
      [5,9],[9,13],[13,17],
    ];
    ctx.strokeStyle = 'rgba(0, 255, 180, 0.8)';
    ctx.lineWidth = 2;
    for (const [a, b] of CONNECTIONS) {
      const ax = (1 - (ZOOM_OFFSET + landmarks[a].x * ZOOM_SCALE)) * width;
      const ay = (ZOOM_OFFSET + landmarks[a].y * ZOOM_SCALE) * height;
      const bx = (1 - (ZOOM_OFFSET + landmarks[b].x * ZOOM_SCALE)) * width;
      const by = (ZOOM_OFFSET + landmarks[b].y * ZOOM_SCALE) * height;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    for (const lm of landmarks) {
      const x = (1 - (ZOOM_OFFSET + lm.x * ZOOM_SCALE)) * width;
      const y = (ZOOM_OFFSET + lm.y * ZOOM_SCALE) * height;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }
  }

  // ── MediaPipe init + rAF loop ─────────────────────────────────────────────
  useEffect(() => {
    let stopped = false;

    const originalConsoleError = console.error.bind(console);
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].startsWith('INFO:')) return;
      originalConsoleError(...args);
    };

    async function init() {
      const { HandLandmarker, FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      setStatus('Loading models...');

      const wasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
      const [visionHand, visionFace] = await Promise.all([
        FilesetResolver.forVisionTasks(wasmUrl),
        FilesetResolver.forVisionTasks(wasmUrl),
      ]);

      const [handLandmarker, faceLandmarker] = await Promise.all([
        HandLandmarker.createFromOptions(visionHand, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        }),
        FaceLandmarker.createFromOptions(visionFace, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        }),
      ]);

      landmarkerRef.current     = handLandmarker;
      faceLandmarkerRef.current = faceLandmarker;
      setStatus('Starting camera...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }

      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise(res => (video.onloadedmetadata = res));
      video.play();

      const zoomCanvas = document.createElement('canvas');
      zoomCanvas.width  = video.videoWidth;
      zoomCanvas.height = video.videoHeight;
      zoomCanvasRef.current = zoomCanvas;

      setStatus(null);

      function loop() {
        if (stopped) return;

        const now = performance.now();
        if (now - lastInferenceRef.current < 33) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        lastInferenceRef.current = now;

        const canvas = canvasRef.current;
        if (!canvas || !video) { rafRef.current = requestAnimationFrame(loop); return; }

        const { videoWidth: w, videoHeight: h } = video;

        const zc = zoomCanvasRef.current;
        const zctx = zc.getContext('2d');
        zctx.drawImage(video, w * ZOOM_OFFSET, h * ZOOM_OFFSET, w * ZOOM_SCALE, h * ZOOM_SCALE, 0, 0, w, h);

        const handResult = handLandmarker.detectForVideo(zc, performance.now());

        frameCountRef.current++;
        if (hasFaceGestureRef.current && frameCountRef.current % 2 === 1 && faceLandmarkerRef.current) {
          const faceTs = Math.max(performance.now(), lastFaceTsRef.current + 1);
          lastFaceTsRef.current = faceTs;
          try {
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, faceTs);
            cachedFaceLandmarksRef.current = faceResult?.faceLandmarks?.[0] ?? null;
          } catch {
            cachedFaceLandmarksRef.current = null;
          }
        }
        const faceLandmarks = cachedFaceLandmarksRef.current;
        const hands = handResult.landmarks ?? [];

        // Warmup: wait for 3 consecutive frames with hands before starting turns
        if (gamePhaseRef.current === 'warmup') {
          if (hands.length > 0) {
            warmupCountRef.current++;
            if (warmupCountRef.current >= 3) {
              gamePhaseRef.current = 'selecting';
              setGamePhase('selecting');
            }
          } else {
            warmupCountRef.current = 0;
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        if (showLandmarksRef.current) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, w, h);
          if (faceLandmarks) drawFaceLandmarks(ctx, faceLandmarks, w, h);
          if (hands.length > 0) for (const hl of hands) drawLandmarks(ctx, hl, w, h);
        }

        let detected = null;
        if (!detected && hands.length >= 2) {
          for (const key of loadout) {
            const ab = ABILITIES[key];
            if (ab.gestureType === 'two-hand' && ab.detect(hands, faceLandmarks)) { detected = key; break; }
          }
        }
        if (!detected && hands.length > 0) {
          for (const key of loadout) {
            const ab = ABILITIES[key];
            if (ab.gestureType === 'single' && ab.detect(hands, faceLandmarks)) { detected = key; break; }
          }
        }
        if (!detected) {
          for (const key of loadout) {
            const ab = ABILITIES[key];
            if (ab.gestureType === 'face' && ab.detect(hands, faceLandmarks)) { detected = key; break; }
          }
        }

        if (hands.length > 0 &&
            detectThumbsDown(hands[0]) &&
            gamePhaseRef.current === 'selecting' &&
            confirmedGestureRef.current &&
            !playerStateRef.current.multiTurnActive) {
          lastGestureRef.current      = null;
          confirmedGestureRef.current = null;
          setConfirmedGesture(null);
        }

        const gesture = detected && loadout.has(detected) ? detected : null;
        if (gesture !== currentGestureRef.current) {
          currentGestureRef.current = gesture;
          setCurrentGesture(gesture);
        }

        const hold = gestureHoldRef.current;
        if (gesture === hold.gesture) {
          if (gesture && Date.now() - hold.since >= HOLD_THRESHOLD_MS) {
            if (gamePhaseRef.current === 'selecting' && !playerStateRef.current.multiTurnActive) {
              lastGestureRef.current      = gesture;
              confirmedGestureRef.current = gesture;
              setConfirmedGesture(gesture);
            }
            gestureHoldRef.current = { gesture: null, since: 0 };
          }
        } else {
          gestureHoldRef.current = { gesture, since: Date.now() };
        }

        rafRef.current = requestAnimationFrame(loop);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    init().catch(err => {
      console.error('BotCanvas init error:', err);
      setStatus(`Error: ${err.message}`);
    });

    return () => {
      stopped = true;
      console.error = originalConsoleError;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      landmarkerRef.current?.close();
      faceLandmarkerRef.current?.close();
    };
  }, [loadout]);

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
        {gamePhase === 'selecting' && playerState.multiTurnActive && (() => {
          const L = ABILITIES[playerState.multiTurnActive.abilityKey]?.LoopEffect;
          return L ? <L /> : null;
        })()}
        {gamePhase === 'selecting' && playerState.activeDomain && (() => {
          const L = ABILITIES[playerState.activeDomain.abilityKey]?.LoopEffect;
          return L ? <L /> : null;
        })()}

        <StatsHUD state={playerState} />
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
        <StatsHUD state={botState} />
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
            : (resolveMessage ?? ABILITIES[lockedGesture]?.name?.toUpperCase() ?? 'NO MOVE')}
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
