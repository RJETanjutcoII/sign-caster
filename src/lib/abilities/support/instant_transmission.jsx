export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-it {
        0%   { opacity: 0; }
        5%   { opacity: 0.9; }
        30%  { opacity: 0; }
        60%  { opacity: 0.4; }
        100% { opacity: 0; }
      }
      .fx-it {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(255, 220, 80, 0.75);
        animation: fx-it 0.6s ease-out forwards;
      }
    `}</style>
    <div className="fx-it" />
  </>
);

import { dist, isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Instant Transmission', category: 'support', color: '#ffd966',
  manaCost: 10, ultCost: 0, ultGain: 0,
  gesture: 'Two fingers to forehead',
  gestureType: 'single',
  detect(hands, face) {
    const lm = hands[0];
    if (!lm) return false;
    const indexExtended  = isFingerExtended(lm, 8);
    const middleExtended = isFingerExtended(lm, 12);
    const ringCurled     = isFingerCurled(lm,   16);
    const pinkyCurled    = isFingerCurled(lm,   20);
    if (!indexExtended || !middleExtended || !ringCurled || !pinkyCurled) return false;
    const handWidth = Math.abs(lm[5].x - lm[17].x);
    const fingerGap = Math.abs(lm[8].x  - lm[12].x);
    if (handWidth > 0 && fingerGap / handWidth >= 0.4) return false; // V sign
    if (!face || face.length <= 9) return false;
    const tipToFace = Math.min(dist(lm[8], face[9]), dist(lm[12], face[9]));
    return tipToFace < 0.15;
  },
  Effect,
  resolve() { return { nullifySelf: true }; },
};
