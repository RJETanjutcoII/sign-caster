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
import { INITIAL_STATE, applyStartOfTurn, resolveTurn } from '@/lib/gameState';

const HOLD_THRESHOLD_MS  = 300; // ms a gesture must be held to be confirmed
const TURN_DURATION_S    = 5;   // gesture selection window
const RESOLVE_DURATION_S = 4;   // time to display the effect before next round

export default function GameCanvas({ loadout, onBack }) {
  const videoRef          = useRef(null);
  const canvasRef         = useRef(null);
  const landmarkerRef     = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const rafRef            = useRef(null);

  // Face detection alternates frames to avoid WASM timestamp conflicts
  const frameCountRef        = useRef(0);
  const lastFaceTsRef        = useRef(0);
  const cachedFaceLandmarksRef = useRef(null);

  // Gesture hold debounce — lives in a ref so the rAF closure always sees current value
  const gestureHoldRef = useRef({ gesture: null, since: 0 });

  // Turn state
  const [gamePhase,       setGamePhase]       = useState('selecting'); // 'selecting' | 'resolving'
  const timeLeftRef = useRef(TURN_DURATION_S);
  const [turnKey,         setTurnKey]         = useState(0); // increments each selection phase to restart the bar animation
  const [confirmedGesture, setConfirmedGesture] = useState(null); // last confirmed during window
  const [lockedGesture,   setLockedGesture]   = useState(null);   // locked in at window end
  const [activeEffect,    setActiveEffect]    = useState(null);
  const [resolveMessage,  setResolveMessage]  = useState(null);
  const [currentGesture,  setCurrentGesture]  = useState(null);
  const [status,          setStatus]          = useState('Initializing...');

  // Ref copy of gamePhase so the rAF loop can read it without stale closures
  const gamePhaseRef          = useRef('selecting');
  const lastGestureRef        = useRef(null);
  const confirmedGestureRef   = useRef(null);

  // Player game state
  const [playerState, setPlayerState] = useState(INITIAL_STATE);
  const playerStateRef  = useRef(INITIAL_STATE);
  const forcedGestureRef = useRef(null); // 'stunned' | 'spirit_bomb' | null

  // Debug / dev helpers
  const [showLandmarks, setShowLandmarks] = useState(true);
  const showLandmarksRef  = useRef(true);
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

  // ── Drawing ───────────────────────────────────────────────────────────────

  function drawFaceLandmarks(ctx, landmarks, width, height) {
    ctx.fillStyle = 'rgba(180, 130, 255, 0.55)';
    for (const lm of landmarks) {
      const x = (1 - lm.x) * width;
      const y = lm.y * height;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const g  = landmarks[9];
    const gx = (1 - g.x) * width;
    const gy = g.y * height;

    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 210, 60, 0.9)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(gx, gy, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 210, 60, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
      const ax = (1 - landmarks[a].x) * width;
      const ay = landmarks[a].y * height;
      const bx = (1 - landmarks[b].x) * width;
      const by = landmarks[b].y * height;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    for (const lm of landmarks) {
      const x = (1 - lm.x) * width;
      const y = lm.y * height;
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

        const handResult = handLandmarker.detectForVideo(video, performance.now());

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

        if (showLandmarksRef.current) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, w, h);
          if (faceLandmarks) drawFaceLandmarks(ctx, faceLandmarks, w, h);
          if (hands.length > 0) for (const hl of hands) drawLandmarks(ctx, hl, w, h);
        }

        let detected = null;

        // Phase 1 — two-hand (must run before single-hand to avoid false positives)
        if (!detected && hands.length >= 2) {
          for (const key of loadout) {
            const ab = ABILITIES[key];
            if (ab.gestureType === 'two-hand' && ab.detect(hands, faceLandmarks)) {
              detected = key; break;
            }
          }
        }
        // Phase 2 — single-hand
        if (!detected && hands.length > 0) {
          for (const key of loadout) {
            const ab = ABILITIES[key];
            if (ab.gestureType === 'single' && ab.detect(hands, faceLandmarks)) {
              detected = key; break;
            }
          }
        }
        // Phase 3 — face-only
        if (!detected) {
          for (const key of loadout) {
            const ab = ABILITIES[key];
            if (ab.gestureType === 'face' && ab.detect(hands, faceLandmarks)) {
              detected = key; break;
            }
          }
        }

        // Thumbs down cancels the confirmed move
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

        // Gesture hold debounce — only update lock-in during selecting phase
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
      console.error('GameCanvas init error:', err);
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
    <div className="game-root">
      {status && <div className="status-overlay">{status}</div>}

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
