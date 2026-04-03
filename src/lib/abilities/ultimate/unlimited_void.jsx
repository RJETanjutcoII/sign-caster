export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-uv-in {
        0%   { opacity: 0; }
        15%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes fx-uv-ring {
        0%   { transform: scale(0) rotate(0deg);   opacity: 0.8; }
        100% { transform: scale(3) rotate(180deg); opacity: 0; }
      }
      .fx-uv {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center, rgba(30,0,60,0.92) 0%, rgba(80,30,160,0.7) 50%, transparent 80%);
        animation: fx-uv-in 3s ease-in-out forwards;
      }
      .fx-uv-ring {
        position: absolute; inset: 0; margin: auto;
        width: 40vmin; height: 40vmin;
        border: 3px solid rgba(200,160,255,0.7);
        border-radius: 50%;
        animation: fx-uv-ring 3s ease-out forwards;
      }
    `}</style>
    <div className="fx-uv">
      <div className="fx-uv-ring" />
    </div>
  </>
);

import { isFingerExtended, isFingerHalfBent, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Unlimited Void', category: 'ultimate', color: '#c8a8ff',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Index up, middle half-bent',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    return (
      isFingerExtended(lm, 8)  &&
      isFingerHalfBent(lm, 12) &&
      isFingerCurled(lm,   16) &&
      isFingerCurled(lm,   20)
    );
  },
  Effect,
  resolve() { return { stunTurns: 3 }; },
};
