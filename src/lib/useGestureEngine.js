'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { detectThumbsDown } from '@/lib/gestures';
import { ABILITIES } from '@/lib/abilities';

const HOLD_THRESHOLD_MS = 300;
const FACE_HIGHLIGHTED  = new Set([10, 33, 133, 159, 145, 160, 144, 362, 263, 386, 374, 387, 373]);
const HAND_CONNECTIONS  = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function drawFaceLandmarks(ctx, landmarks, w, h, scale, offset) {
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x  = (1 - (offset + lm.x * scale)) * w;
    const y  = (offset + lm.y * scale) * h;
    ctx.beginPath();
    if (FACE_HIGHLIGHTED.has(i)) {
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 210, 60, 0.9)';
    } else {
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180, 130, 255, 0.55)';
    }
    ctx.fill();
  }
}

function drawHandLandmarks(ctx, landmarks, w, h, scale, offset) {
  ctx.strokeStyle = 'rgba(0, 255, 180, 0.8)';
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const ax = (1 - (offset + landmarks[a].x * scale)) * w;
    const ay = (offset + landmarks[a].y * scale) * h;
    const bx = (1 - (offset + landmarks[b].x * scale)) * w;
    const by = (offset + landmarks[b].y * scale) * h;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  for (const lm of landmarks) {
    const x = (1 - (offset + lm.x * scale)) * w;
    const y = (offset + lm.y * scale) * h;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
  }
}

/**
 * Owns the full MediaPipe camera + detection pipeline.
 *
 * @param {Object} opts
 * @param {Set}    opts.loadout         - Set of ability keys in use
 * @param {Ref}    opts.videoRef        - <video> DOM ref
 * @param {Ref}    opts.canvasRef       - <canvas> DOM ref for landmark overlay
 * @param {number} [opts.zoom]          - Zoom factor (e.g. 1.25); omit for no zoom
 * @param {Ref}    opts.gamePhaseRef    - Current phase string ref
 * @param {Ref}    opts.showLandmarksRef - Boolean ref to gate drawing
 * @param {Ref}    opts.playerStateRef  - Player state ref (reads .multiTurnActive)
 * @param {()=>void} opts.onWarmupComplete - Called when warmup (3 frames w/ hands) passes
 * @param {(gesture:string)=>void} opts.onConfirm - Called on gesture hold lock-in
 * @param {()=>void} opts.onCancel      - Called on thumbs-down cancel
 *
 * @returns {{ status, currentGesture, confirmedGestureRef, lastGestureRef }}
 */
export function useGestureEngine({
  loadout,
  videoRef,
  canvasRef,
  zoom,
  gamePhaseRef,
  showLandmarksRef,
  playerStateRef,
  onWarmupComplete,
  onConfirm,
  onCancel,
}) {
  const [status,         setStatus]         = useState('Initializing...');
  const [currentGesture, setCurrentGesture] = useState(null);

  // Refs the hook owns internally
  const landmarkerRef          = useRef(null);
  const faceLandmarkerRef      = useRef(null);
  const rafRef                 = useRef(null);
  const zoomCanvasRef          = useRef(null);
  const frameCountRef          = useRef(0);
  const lastFaceTsRef          = useRef(0);
  const cachedFaceLandmarksRef = useRef(null);
  const gestureHoldRef         = useRef({ gesture: null, since: 0 });
  const lastInferenceRef       = useRef(0);
  const warmupCountRef         = useRef(0);
  const currentGestureRef      = useRef(null);

  // Exposed refs (read by turn-timer logic outside this hook)
  const confirmedGestureRef = useRef(null);
  const lastGestureRef      = useRef(null);

  // Keep callbacks fresh without restarting the rAF loop
  const onWarmupCompleteRef = useRef(onWarmupComplete);
  const onConfirmRef        = useRef(onConfirm);
  const onCancelRef         = useRef(onCancel);
  onWarmupCompleteRef.current = onWarmupComplete;
  onConfirmRef.current        = onConfirm;
  onCancelRef.current         = onCancel;

  const hasFaceGesture = useMemo(
    () => [...loadout].some(key => ABILITIES[key]?.gestureType === 'face' || ABILITIES[key]?.needsFace),
    [loadout]
  );
  const hasFaceGestureRef = useRef(hasFaceGesture);
  useEffect(() => { hasFaceGestureRef.current = hasFaceGesture; }, [hasFaceGesture]);

  // Precompute zoom drawing params
  const zoomScale  = zoom ? 1 / zoom : 1;
  const zoomOffset = zoom ? (1 - 1 / zoom) / 2 : 0;

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

      if (zoom) {
        const zc = document.createElement('canvas');
        zc.width  = video.videoWidth;
        zc.height = video.videoHeight;
        zoomCanvasRef.current = zc;
      }

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

        // Hand detection — optionally via zoom canvas
        let detectionSource = video;
        if (zoom && zoomCanvasRef.current) {
          const zc   = zoomCanvasRef.current;
          const zctx = zc.getContext('2d');
          zctx.drawImage(video, w * zoomOffset, h * zoomOffset, w * zoomScale, h * zoomScale, 0, 0, w, h);
          detectionSource = zc;
        }
        const handResult = handLandmarker.detectForVideo(detectionSource, performance.now());

        // Face detection — every other frame
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

        // Warmup: wait for 3 consecutive frames with hands
        if (gamePhaseRef.current === 'warmup') {
          if (hands.length > 0) {
            warmupCountRef.current++;
            if (warmupCountRef.current >= 3) {
              gamePhaseRef.current = 'selecting';
              onWarmupCompleteRef.current();
            }
          } else {
            warmupCountRef.current = 0;
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // Landmark drawing (when enabled)
        if (showLandmarksRef.current) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, w, h);
          if (faceLandmarks) drawFaceLandmarks(ctx, faceLandmarks, w, h, zoomScale, zoomOffset);
          for (const hl of hands) drawHandLandmarks(ctx, hl, w, h, zoomScale, zoomOffset);
        }

        // Gesture detection — priority: two-hand > single-hand > face
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

        // Thumbs-down cancels confirmed move (selecting phase only, no multi-turn active)
        if (hands.length > 0 &&
            detectThumbsDown(hands[0]) &&
            gamePhaseRef.current === 'selecting' &&
            confirmedGestureRef.current &&
            !playerStateRef.current.multiTurnActive) {
          lastGestureRef.current      = null;
          confirmedGestureRef.current = null;
          onCancelRef.current();
        }

        const gesture = detected && loadout.has(detected) ? detected : null;
        if (gesture !== currentGestureRef.current) {
          currentGestureRef.current = gesture;
          setCurrentGesture(gesture);
        }

        // Hold debounce — lock in gesture after HOLD_THRESHOLD_MS
        const hold = gestureHoldRef.current;
        if (gesture === hold.gesture) {
          if (gesture && Date.now() - hold.since >= HOLD_THRESHOLD_MS) {
            if (gamePhaseRef.current === 'selecting' && !playerStateRef.current.multiTurnActive) {
              lastGestureRef.current      = gesture;
              confirmedGestureRef.current = gesture;
              onConfirmRef.current(gesture);
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
      console.error('useGestureEngine init error:', err);
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
  }, [loadout]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, currentGesture, confirmedGestureRef, lastGestureRef };
}
