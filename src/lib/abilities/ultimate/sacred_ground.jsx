import { dist, isFingerExtended, isFingerCurled } from '@/lib/gestures';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-sg-bloom {
        0%   { opacity: 0; transform: scale(0.4); }
        25%  { opacity: 1; transform: scale(1.05); }
        70%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.3); }
      }
      @keyframes fx-sg-ring {
        0%   { transform: translate(-50%,-50%) scale(0); opacity: 0.9; }
        100% { transform: translate(-50%,-50%) scale(6); opacity: 0; }
      }
      .fx-sg-bloom {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(255, 220, 100, 0.65) 0%,
          rgba(255, 180, 50, 0.3) 45%,
          transparent 75%
        );
        animation: fx-sg-bloom 1.4s ease-out forwards;
      }
      .fx-sg-ring {
        position: fixed; top: 50%; left: 50%;
        width: 80px; height: 80px; border-radius: 50%;
        border: 2px solid rgba(255, 210, 80, 0.9);
        pointer-events: none;
        animation: fx-sg-ring 1.2s ease-out forwards;
      }
      .fx-sg-ring:nth-child(3) { animation-delay: 0.2s; border-color: rgba(255, 240, 160, 0.6); }
      .fx-sg-ring:nth-child(4) { animation-delay: 0.4s; border-color: rgba(255, 200, 60, 0.4); }
    `}</style>
    <div className="fx-sg-bloom" />
    <div className="fx-sg-ring" />
    <div className="fx-sg-ring" />
    <div className="fx-sg-ring" />
  </>
);

export const LoopEffect = () => (
  <>
    <style>{`
      @keyframes fx-sg-pulse {
        0%   { opacity: 0.18; }
        50%  { opacity: 0.32; }
        100% { opacity: 0.18; }
      }
      .fx-sg-loop {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(255, 210, 80, 0.35) 0%,
          rgba(200, 140, 20, 0.15) 55%,
          transparent 80%
        );
        animation: fx-sg-pulse 3s ease-in-out infinite;
      }
    `}</style>
    <div className="fx-sg-loop" />
  </>
);

export default {
  name: 'Sacred Ground', category: 'ultimate', color: '#ffcc44',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Open hand, palm facing camera',
  gestureType: 'single',
  turnType: 'domain',
  turnAmount: 3,
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const extendedCount = tips.filter(i => dist(lm[i], lm[0]) > handSize * 1.5).length;
    return extendedCount >= 3;
  },
  domainTick() { return { manaRegen: 3 }; },
  Effect,
  LoopEffect,
  videoEffects: {
    caster: { type: 'background', src: '/effects/sacred_ground/bg.webm', loop: true },
    target: { type: 'background', src: '/effects/sacred_ground/bg.webm', loop: true },
  },
  resolve() { return {}; },
};
