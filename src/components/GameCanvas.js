'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { detectGesture, detectTwoHandGesture } from '@/lib/gestures';
import { ABILITIES } from '@/lib/abilities';
import AbilityDisplay from './AbilityDisplay';

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
  const [timeLeft,        setTimeLeft]        = useState(TURN_DURATION_S);
  const [confirmedGesture, setConfirmedGesture] = useState(null); // last confirmed during window
  const [lockedGesture,   setLockedGesture]   = useState(null);   // locked in at window end
  const [activeEffect,    setActiveEffect]    = useState(null);
  const [currentGesture,  setCurrentGesture]  = useState(null);
  const [status,          setStatus]          = useState('Initializing...');

  // Ref copy of gamePhase so the rAF loop can read it without stale closures
  const gamePhaseRef          = useRef('selecting');
  const lastGestureRef        = useRef(null); // most recently confirmed gesture this window
  const confirmedGestureRef   = useRef(null); // synced with confirmedGesture for rAF reads

  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'selecting') return;

    // Reset for this window
    setTimeLeft(TURN_DURATION_S);
    setConfirmedGesture(null);
    lastGestureRef.current      = null;
    confirmedGestureRef.current = null;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          const locked = lastGestureRef.current;
          setLockedGesture(locked);
          setGamePhase('resolving');
          if (locked) {
            const ability = ABILITIES[locked];
            if (ability) setActiveEffect(ability.effectClass);
          }
          return 0;
        }
        return next;
      });
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

  const handleAnimationEnd = useCallback(() => {
    // Don't clear the effect early — the resolving timer handles that
  }, []);

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

        const canvas = canvasRef.current;
        if (!canvas || !video) { rafRef.current = requestAnimationFrame(loop); return; }

        const { videoWidth: w, videoHeight: h } = video;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const handResult = handLandmarker.detectForVideo(video, performance.now());

        frameCountRef.current++;
        if (frameCountRef.current % 2 === 1 && faceLandmarkerRef.current) {
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

        if (faceLandmarks) drawFaceLandmarks(ctx, faceLandmarks, w, h);

        if (handResult.landmarks && handResult.landmarks.length > 0) {
          for (const hl of handResult.landmarks) drawLandmarks(ctx, hl, w, h);

          const twoHand = handResult.landmarks.length >= 2
            ? detectTwoHandGesture(handResult.landmarks[0], handResult.landmarks[1])
            : null;

          const detected = twoHand ?? detectGesture(handResult.landmarks[0], faceLandmarks);
          const gesture  = detected && loadout.has(detected) ? detected : null;

          setCurrentGesture(gesture);

          // Gesture hold debounce — only update lock-in during selecting phase
          const hold = gestureHoldRef.current;
          if (gesture === hold.gesture) {
            if (gesture && Date.now() - hold.since >= HOLD_THRESHOLD_MS) {
              if (gamePhaseRef.current === 'selecting') {
                // Record as last confirmed gesture this window
                lastGestureRef.current      = gesture;
                confirmedGestureRef.current = gesture;
                setConfirmedGesture(gesture);
              }
              // Reset so the player can change their mind and confirm again
              gestureHoldRef.current = { gesture: null, since: 0 };
            }
          } else {
            gestureHoldRef.current = { gesture, since: Date.now() };
          }
        } else {
          setCurrentGesture(null);
          gestureHoldRef.current = { gesture: null, since: 0 };
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

  const timerPct   = (timeLeft / TURN_DURATION_S) * 100;
  const timerColor = timeLeft > 3 ? '#44ff88' : timeLeft > 1 ? '#ffcc44' : '#ff4444';

  return (
    <div className="game-root">
      {status && <div className="status-overlay">{status}</div>}

      {activeEffect && (
        <div
          className={`effect-overlay ${activeEffect}`}
          onAnimationEnd={handleAnimationEnd}
        />
      )}

      <video ref={videoRef} className="game-video" playsInline muted />
      <canvas ref={canvasRef} className="game-canvas" />

      <button className="back-button" onClick={onBack}>← Loadout</button>

      {/* Turn timer bar */}
      <div className="turn-timer">
        <div className="turn-timer-label">
          {gamePhase === 'selecting'
            ? (confirmedGesture ? `READY: ${ABILITIES[confirmedGesture]?.name}` : 'SELECT YOUR MOVE')
            : (lockedGesture ? `${ABILITIES[lockedGesture]?.name?.toUpperCase()}` : 'NO MOVE')}
        </div>
        <div className="turn-timer-track">
          <div
            className="turn-timer-fill"
            style={{
              width: gamePhase === 'selecting' ? `${timerPct}%` : '0%',
              background: timerColor,
            }}
          />
        </div>

        {/* Only show cancel once a move has been confirmed */}
        {gamePhase === 'selecting' && confirmedGesture && (
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

      <AbilityDisplay gesture={currentGesture} loadout={loadout} />
    </div>
  );
}
