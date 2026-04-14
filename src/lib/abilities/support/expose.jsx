import { dist } from '@/lib/gestures';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-ex-fade {
        0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
        20%  { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        80%  { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(1.1); }
      }
      @keyframes fx-ex-converge {
        0%   { opacity: 0; transform: translate(-50%,-50%) scale(2.5); }
        50%  { opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(0.9); }
      }
      .fx-ex-reticle {
        position: fixed; top: 50%; left: 50%;
        width: 80px; height: 80px; border-radius: 50%;
        border: 2px solid rgba(255, 80, 100, 0.9);
        pointer-events: none;
        animation: fx-ex-fade 1.3s ease-out forwards;
      }
      .fx-ex-reticle::before,
      .fx-ex-reticle::after {
        content: ''; position: absolute;
        background: rgba(255, 80, 100, 0.8);
      }
      .fx-ex-reticle::before { top: 50%; left: -12px; right: -12px; height: 1px; transform: translateY(-50%); }
      .fx-ex-reticle::after  { left: 50%; top: -12px; bottom: -12px; width: 1px; transform: translateX(-50%); }
      .fx-ex-outer {
        position: fixed; top: 50%; left: 50%;
        width: 120px; height: 120px; border-radius: 50%;
        border: 1px solid rgba(255, 100, 120, 0.5);
        pointer-events: none;
        animation: fx-ex-converge 1s ease-out forwards;
      }
      .fx-ex-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(255, 60, 80, 0.25) 0%,
          transparent 60%
        );
        animation: fx-ex-fade 1.3s ease-out forwards;
      }
    `}</style>
    <div className="fx-ex-bg" />
    <div className="fx-ex-outer" />
    <div className="fx-ex-reticle" />
  </>
);

function isFingerGun(lm) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  const indexExtended = dist(lm[8],  lm[0]) > handSize * 1.5;
  const middleCurled  = dist(lm[12], lm[0]) < handSize * 1.4;
  const ringCurled    = dist(lm[16], lm[0]) < handSize * 1.4;
  const pinkyCurled   = dist(lm[20], lm[0]) < handSize * 1.4;
  return indexExtended && middleCurled && ringCurled && pinkyCurled;
}

export default {
  name: 'Expose', category: 'support', color: '#ff6688',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Both hands in finger-gun pose',
  gestureType: 'two-hand',
  detect(hands) {
    if (hands.length < 2) return false;
    return isFingerGun(hands[0]) && isFingerGun(hands[1]);
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/expose/caster.mp4' },
    target: { type: 'overlay', src: '/effects/expose/target.mp4' },
  },
  resolve() { return { defDebuff: { amount: 6, turns: 2 } }; },
};
