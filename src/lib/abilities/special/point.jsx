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
  gesture: 'Point (index up)',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    return (
      isFingerExtended(lm, 8)  &&
      isFingerCurled(lm,   12) &&
      isFingerCurled(lm,   16) &&
      isFingerCurled(lm,   20)
    );
  },
  Effect,
  resolve() { return { damage: 20 }; },
};
