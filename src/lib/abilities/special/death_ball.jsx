export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-death-ball {
        0%   { opacity: 0; transform: scale(0.2); }
        30%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(2.2); }
      }
      .fx-death-ball {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, rgba(180,60,255,0.75) 0%, rgba(100,0,180,0.3) 40%, transparent 70%);
        animation: fx-death-ball 0.8s ease-out forwards;
      }
    `}</style>
    <div className="fx-death-ball" />
  </>
);

import { isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Death Ball', category: 'special', color: '#bb44ff',
  manaCost: 5, ultCost: 0, ultGain: 2,
  gesture: 'Index finger pointed upward, others curled',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    if (!isFingerExtended(lm, 8))  return false;
    if (!isFingerCurled(lm,   12)) return false;
    if (!isFingerCurled(lm,   16)) return false;
    if (!isFingerCurled(lm,   20)) return false;
    // Finger must be pointing upward — vertical component > horizontal
    const dy = lm[5].y - lm[8].y; // positive = tip above MCP knuckle
    const dx = Math.abs(lm[8].x - lm[5].x);
    return dy > dx;
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/death_ball/caster.mp4' },
    target: { type: 'overlay', src: '/effects/death_ball/target.mp4' },
  },
  resolve() { return { damage: 30 }; },
};
