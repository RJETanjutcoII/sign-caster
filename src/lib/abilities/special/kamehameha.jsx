export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-kame-beam {
        0%   { opacity: 0; transform: scaleX(0); }
        10%  { opacity: 1; transform: scaleX(1); }
        80%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes fx-kame-bg {
        0%   { opacity: 0; }
        20%  { opacity: 0.4; }
        100% { opacity: 0; }
      }
      .fx-kame-wrap {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(20, 100, 255, 0.2);
        animation: fx-kame-bg 1.2s ease-out forwards;
      }
      .fx-kame-beam {
        position: absolute; top: 44%; left: 0; right: 0; height: 12%;
        background: linear-gradient(90deg, transparent 0%, rgba(100,200,255,0.9) 30%, white 50%, rgba(100,200,255,0.9) 70%, transparent 100%);
        transform-origin: left center;
        animation: fx-kame-beam 1.2s ease-out forwards;
        filter: blur(4px);
      }
    `}</style>
    <div className="fx-kame-wrap">
      <div className="fx-kame-beam" />
    </div>
  </>
);

import { dist } from '@/lib/gestures';

function isOpenPalm(lm) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  const tips = [8, 12, 16, 20];
  return tips.filter(i => dist(lm[i], lm[0]) > handSize * 1.5).length >= 3;
}

export default {
  name: 'Kamehameha', category: 'special', color: '#44aaff',
  manaCost: 5, ultCost: 0, ultGain: 2,
  gesture: 'Both open palms, wrists pressed together',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isOpenPalm(lm0) && isOpenPalm(lm1) && dist(lm0[0], lm1[0]) < 0.35;
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/kamehameha/caster.mp4' },
    target: { type: 'overlay', src: '/effects/kamehameha/target.mp4' },
  },
  resolve() { return { damage: 30 }; },
};
