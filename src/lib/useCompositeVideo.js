'use client';

import { useRef, useEffect } from 'react';

/**
 * Portable Zoom-style background replacement for any <video> element.
 * Runs the same segmentation worker pipeline as useGestureEngine, but
 * decoupled from gesture detection — works on any MediaStream source
 * (local camera OR WebRTC opponent feed).
 *
 * @param {object} opts
 * @param {Ref}    opts.videoRef     - Ref to the <video> element to composite
 * @param {object|null} opts.activeEffect - { src, loop } background to apply, or null
 * @returns {{ compositeCanvasRef, backgroundActive }}
 */
export function useCompositeVideo({ videoRef, activeEffect }) {
  const compositeCanvasRef = useRef(null);
  const compositeCtxRef    = useRef(null);
  const tempCanvasRef      = useRef(null);
  const tempCtxRef         = useRef(null);
  const maskCanvasRef      = useRef(null);
  const maskCtxRef         = useRef(null);
  const bgVideoRef         = useRef(null);
  const workerRef          = useRef(null);
  const segPendingRef      = useRef(false);
  const rafRef             = useRef(null);
  const activeEffectRef    = useRef(activeEffect);

  // Keep effect ref current without restarting the loop
  useEffect(() => { activeEffectRef.current = activeEffect; }, [activeEffect]);

  // Worker + bgVideo + frame loop — created once on mount
  useEffect(() => {
    const worker = new Worker(new URL('./segmentWorker.js', import.meta.url));
    workerRef.current = worker;

    worker.onmessage = ({ data }) => {
      if (data.type !== 'mask') return;
      const { rgba, width: mw, height: mh } = data;
      const imgData = new ImageData(new Uint8ClampedArray(rgba), mw, mh);
      const mc = maskCanvasRef.current ??= document.createElement('canvas');
      if (mc.width !== mw || mc.height !== mh) { mc.width = mw; mc.height = mh; maskCtxRef.current = null; }
      (maskCtxRef.current ??= mc.getContext('2d')).putImageData(imgData, 0, 0);
      segPendingRef.current = false;
    };

    const bgVideo = document.createElement('video');
    bgVideo.muted      = true;
    bgVideo.playsInline = true;
    bgVideoRef.current = bgVideo;

    let stopped = false;

    function loop() {
      if (stopped) return;

      const video  = videoRef.current;
      const effect = activeEffectRef.current;

      if (!video || !effect || video.readyState < 2) {
        rafRef.current = setTimeout(loop, 33); return;
      }

      const { videoWidth: w, videoHeight: h } = video;
      if (!w || !h) { rafRef.current = setTimeout(loop, 33); return; }

      const bv = bgVideoRef.current;

      // Sync bgVideo src when effect changes
      const wantSrc = window.location.origin + effect.src;
      if (bv.src !== wantSrc) {
        bv.src  = effect.src;
        bv.loop = effect.loop ?? false;
        bv.play().catch(() => {});
      }

      if (bv.readyState < 2) { rafRef.current = setTimeout(loop, 33); return; }

      // Kick off segmentation (async — never blocks the loop)
      if (!segPendingRef.current) {
        segPendingRef.current = true;
        createImageBitmap(video, { resizeWidth: 256, resizeHeight: 256, resizeQuality: 'pixelated' })
          .then(bitmap => {
            if (stopped || !workerRef.current) { bitmap.close(); segPendingRef.current = false; return; }
            workerRef.current.postMessage(
              { type: 'segment', bitmap, timestamp: performance.now(), width: 256, height: 256 },
              [bitmap]
            );
          }).catch(() => { segPendingRef.current = false; });
      }

      // Composite: draw background → masked person cutout
      const cc = compositeCanvasRef.current;
      if (cc) {
        if (cc.width !== w) cc.width = w;
        if (cc.height !== h) cc.height = h;
        const cCtx = compositeCtxRef.current ??= cc.getContext('2d');
        cCtx.drawImage(bv, 0, 0, w, h);

        const mc = maskCanvasRef.current;
        if (mc) {
          const tc = tempCanvasRef.current ??= document.createElement('canvas');
          if (tc.width !== w || tc.height !== h) { tc.width = w; tc.height = h; tempCtxRef.current = null; }
          const tCtx = tempCtxRef.current ??= tc.getContext('2d');
          tCtx.clearRect(0, 0, w, h);
          tCtx.drawImage(video, 0, 0, w, h);
          tCtx.globalCompositeOperation = 'destination-in';
          tCtx.drawImage(mc, 0, 0, w, h);
          tCtx.globalCompositeOperation = 'source-over';
          cCtx.drawImage(tc, 0, 0);
        } else {
          // No mask yet — show raw video as fallback until first mask arrives
          cCtx.drawImage(video, 0, 0, w, h);
        }
      }

      rafRef.current = setTimeout(loop, 33);
    }

    rafRef.current = setTimeout(loop, 0);

    return () => {
      stopped = true;
      if (rafRef.current) clearTimeout(rafRef.current);
      worker.terminate();
      bgVideoRef.current?.pause();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { compositeCanvasRef, backgroundActive: !!activeEffect };
}
