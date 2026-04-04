export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-heal {
        0%   { opacity: 0; transform: scale(0.8); }
        30%  { opacity: 1; transform: scale(1.05); }
        65%  { opacity: 1; transform: scale(0.97); }
        100% { opacity: 0; transform: scale(1.1); }
      }
      .fx-heal {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, rgba(255,120,180,0.55) 0%, rgba(120,255,160,0.2) 50%, transparent 70%);
        animation: fx-heal 1s ease-in-out forwards;
      }
    `}</style>
    <div className="fx-heal" />
  </>
);

import { dist } from '@/lib/gestures';

export default {
  name: 'Heal', category: 'support', color: '#ff6699',
  manaCost: 5, ultCost: 0, ultGain: 0,
  gesture: 'Fist with thumb raised up',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const closedCount = tips.filter(i => dist(lm[i], lm[0]) < handSize * 1.6).length;
    if (closedCount < 3) return false;
    return lm[4].y < lm[0].y - handSize * 0.9;
  },
  Effect,
  resolve() { return { healSelf: 10 }; },
};
