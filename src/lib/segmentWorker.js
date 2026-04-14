import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

let segmenter = null;
let prevMask  = null; // temporal smoothing — blend with previous frame

FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
).then(vision =>
  ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  })
).then(seg => { segmenter = seg; }).catch(() => {});

self.onmessage = ({ data }) => {
  if (data.type !== 'segment') return;
  const { bitmap, timestamp, width, height } = data;
  if (!segmenter) { bitmap.close(); return; }

  try {
    const result = segmenter.segmentForVideo(bitmap, timestamp);
    bitmap.close();
    const masks = result?.confidenceMasks;
    if (masks?.length > 0) {
      const maskF32 = masks[0].getAsFloat32Array();

      // Temporal smoothing — blend with previous frame to kill jitter
      if (!prevMask || prevMask.length !== maskF32.length) {
        prevMask = new Float32Array(maskF32);
      } else {
        for (let i = 0; i < maskF32.length; i++)
          prevMask[i] = 0.65 * maskF32[i] + 0.35 * prevMask[i];
      }

      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < prevMask.length; i++) {
        const v = prevMask[i];
        rgba[i * 4 + 3] = (1 / (1 + Math.exp(-10 * (v - 0.25)))) * 255;
      }
      masks.forEach(m => m.close());
      self.postMessage({ type: 'mask', rgba: rgba.buffer, width, height }, [rgba.buffer]);
    } else {
      masks?.forEach(m => m.close());
    }
  } catch { bitmap.close(); }
};
