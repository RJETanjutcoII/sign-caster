export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-shot {
        0%   { opacity: 0; transform: translateX(-60px); }
        15%  { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; transform: translateX(80px); }
      }
      .fx-shot {
        position: fixed; inset: 0; pointer-events: none;
        background: linear-gradient(90deg, transparent 20%, rgba(255,160,60,0.55) 50%, transparent 80%);
        animation: fx-shot 0.55s ease-out forwards;
      }
    `}</style>
    <div className="fx-shot" />
  </>
);

import { isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Shot', category: 'basic', color: '#ff8844',
  manaCost: 0, ultCost: 0, ultGain: 1,
  gesture: 'Index out, thumb up, other fingers curled',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const indexExtended = isFingerExtended(lm, 8);
    const thumbUp       = lm[4].y < lm[5].y;
    const middleCurled  = isFingerCurled(lm, 12);
    const ringCurled    = isFingerCurled(lm, 16);
    const pinkyCurled   = isFingerCurled(lm, 20);
    return indexExtended && thumbUp && middleCurled && ringCurled && pinkyCurled;
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/strike/caster.webm' },
    target: { type: 'overlay', src: '/effects/strike/target.webm' },
  },
  resolve() { return { damage: 15 }; },
};
