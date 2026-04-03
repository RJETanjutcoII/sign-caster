export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-sharingan-bg {
        0%   { opacity: 0; }
        10%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes fx-sharingan-ring {
        0%   { transform: rotate(0deg)   scale(0.5); opacity: 0; }
        15%  { transform: rotate(30deg)  scale(1);   opacity: 1; }
        85%  { transform: rotate(330deg) scale(1);   opacity: 1; }
        100% { transform: rotate(360deg) scale(1.2); opacity: 0; }
      }
      .fx-sharingan-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center, rgba(120,0,0,0.7) 0%, rgba(60,0,0,0.5) 50%, transparent 80%);
        animation: fx-sharingan-bg 2s ease-in-out forwards;
      }
      .fx-sharingan-ring {
        position: absolute; inset: 0; margin: auto;
        width: 35vmin; height: 35vmin;
        border: 3px solid rgba(255,40,40,0.85);
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(255,0,0,0.6), inset 0 0 20px rgba(255,0,0,0.3);
        animation: fx-sharingan-ring 2s ease-out forwards;
      }
    `}</style>
    <div className="fx-sharingan-bg">
      <div className="fx-sharingan-ring" />
    </div>
  </>
);

import { dist } from '@/lib/gestures';

export default {
  name: 'Sharingan', category: 'innate', color: '#ff2222',
  manaCost: 15, ultCost: 0, ultGain: 0,
  gesture: 'Wink',
  gestureType: 'face',
  detect(hands, face) {
    if (!face || face.length < 478) return false;
    function ear(lm, hL, hR, v1T, v1B, v2T, v2B) {
      const h = dist(lm[hL], lm[hR]);
      if (h < 0.001) return 0;
      return (dist(lm[v1T], lm[v1B]) + dist(lm[v2T], lm[v2B])) / (2 * h);
    }
    const leftEAR  = ear(face, 33,  133, 159, 145, 160, 144);
    const rightEAR = ear(face, 362, 263, 386, 374, 387, 373);
    const leftClosed  = leftEAR  < 0.20;
    const rightClosed = rightEAR < 0.20;
    const leftOpen    = leftEAR  > 0.25;
    const rightOpen   = rightEAR > 0.25;
    return (leftClosed && rightOpen) || (rightClosed && leftOpen);
  },
  Effect,
  resolve() { return { stunTurns: 2, noRestBonus: true }; },
};
