import { dist } from '@/lib/gestures';

export default {
  name: 'Sharingan', category: 'innate', color: '#ff2222',
  manaCost: 15, ultCost: 0, ultGain: 0,
  gesture: 'Wink (close one eye, keep the other wide open)',
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
  resolve() { return { stunTurns: 2, noRestBonus: true }; },
};
