export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-strike {
        0%   { opacity: 0; transform: scale(0.6); }
        20%  { opacity: 1; transform: scale(1.05); }
        100% { opacity: 0; transform: scale(1.6); }
      }
      .fx-strike {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, rgba(255,80,80,0.7) 0%, transparent 65%);
        animation: fx-strike 0.6s ease-out forwards;
      }
    `}</style>
    <div className="fx-strike" />
  </>
);

import { dist } from '@/lib/gestures';

export default {
  name: 'Strike', category: 'basic', color: '#ff4444',
  manaCost: 0, ultCost: 0, ultGain: 1,
  gesture: 'Fist',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const closedCount = tips.filter(i => dist(lm[i], lm[0]) < handSize * 1.6).length;
    if (closedCount < 3) return false;
    const thumbHighAboveWrist = lm[4].y < lm[0].y - handSize * 0.9;
    return !thumbHighAboveWrist;
  },
  Effect,
  resolve() { return { damage: 10 }; },
};
