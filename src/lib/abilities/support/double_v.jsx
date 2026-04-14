export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-dv-streak {
        0%   { opacity: 0; transform: translateX(-60px) scaleX(0.4); }
        20%  { opacity: 1; transform: translateX(0)    scaleX(1); }
        70%  { opacity: 0.6; }
        100% { opacity: 0; transform: translateX(20px); }
      }
      @keyframes fx-dv-burst {
        0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
        25%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
      }
      .fx-dv-streak {
        position: fixed; top: 50%; left: 0;
        width: 100%; height: 3px;
        background: linear-gradient(90deg, transparent, rgba(120,220,255,0.9), rgba(255,255,255,0.6), transparent);
        filter: blur(1px);
        animation: fx-dv-streak 0.5s ease-out forwards;
      }
      .fx-dv-streak:nth-child(2) { top: 46%; animation-delay: 0.05s; opacity: 0.7; }
      .fx-dv-streak:nth-child(3) { top: 54%; animation-delay: 0.08s; opacity: 0.5; }
      .fx-dv-burst {
        position: fixed; top: 50%; left: 50%;
        width: 120px; height: 120px; border-radius: 50%;
        background: radial-gradient(circle, rgba(180,240,255,0.5) 0%, transparent 70%);
        animation: fx-dv-burst 0.6s ease-out forwards;
      }
    `}</style>
    <div className="fx-dv-streak" />
    <div className="fx-dv-streak" />
    <div className="fx-dv-streak" />
    <div className="fx-dv-burst" />
  </>
);

import { isFingerExtended, isFingerCurled, dist } from '@/lib/gestures';

function isPeaceSign(lm) {
  if (!lm) return false;
  const indexExtended  = isFingerExtended(lm, 8);
  const middleExtended = isFingerExtended(lm, 12);
  const ringCurled     = isFingerCurled(lm, 16);
  const pinkyCurled    = isFingerCurled(lm, 20);
  if (!indexExtended || !middleExtended || !ringCurled || !pinkyCurled) return false;
  // Fingers must be spread (not IT pose)
  const handWidth  = Math.abs(lm[5].x - lm[17].x);
  const fingerGap  = Math.abs(lm[8].x  - lm[12].x);
  return handWidth <= 0 || fingerGap / handWidth >= 0.3;
}

export default {
  name: 'Double V', category: 'support', color: '#88eeff',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Peace sign with both hands',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isPeaceSign(lm0) && isPeaceSign(lm1) && dist(lm0[0], lm1[0]) < 0.8;
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/strike/caster.mp4' },
    target: null,
  },
  resolve() { return { speedBoost: 1 }; },
};
