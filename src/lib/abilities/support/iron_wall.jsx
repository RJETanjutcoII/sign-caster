import { dist } from '@/lib/gestures';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-iw-burst {
        0%   { opacity: 0;   transform: scale(0.3); }
        20%  { opacity: 1;   transform: scale(1.05); }
        70%  { opacity: 0.8; transform: scale(1); }
        100% { opacity: 0;   transform: scale(1.4); }
      }
      @keyframes fx-iw-ring {
        0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }
        100% { transform: translate(-50%,-50%) scale(5); opacity: 0; }
      }
      .fx-iw-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(100, 150, 255, 0.55) 0%,
          rgba(60, 100, 220, 0.25) 50%,
          transparent 75%
        );
        animation: fx-iw-burst 1.4s ease-out forwards;
      }
      .fx-iw-ring {
        position: fixed; top: 50%; left: 50%;
        width: 90px; height: 90px; border-radius: 50%;
        border: 3px solid rgba(140, 180, 255, 0.9);
        pointer-events: none;
        animation: fx-iw-ring 1.1s ease-out forwards;
      }
      .fx-iw-ring:nth-child(3) { animation-delay: 0.15s; border-color: rgba(180, 210, 255, 0.6); }
      .fx-iw-ring:nth-child(4) { animation-delay: 0.3s;  border-color: rgba(100, 150, 255, 0.4); }
    `}</style>
    <div className="fx-iw-bg" />
    <div className="fx-iw-ring" />
    <div className="fx-iw-ring" />
    <div className="fx-iw-ring" />
  </>
);

export default {
  name: 'Iron Wall', category: 'support', color: '#88aaff',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Cross both forearms in front of your chest',
  gestureType: 'two-hand',
  detect(hands, face, handedness) {
    if (hands.length < 2 || !handedness || handedness.length < 2) return false;
    const leftIdx  = handedness.findIndex(h => h[0]?.categoryName === 'Left');
    const rightIdx = handedness.findIndex(h => h[0]?.categoryName === 'Right');
    if (leftIdx < 0 || rightIdx < 0) return false;
    // In a mirrored camera the physical left hand appears on screen-right (higher x).
    // Crossed arms means the left hand is now on screen-left (lower x) — inverted.
    return hands[leftIdx][0].x < hands[rightIdx][0].x;
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/iron_wall/caster.mp4' },
    target: null,
  },
  resolve() { return { defBuff: { delta: 9, turnsLeft: 2 } }; },
};
