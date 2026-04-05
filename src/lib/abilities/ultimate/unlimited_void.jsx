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

export const LoopEffect = () => (
  <>
    <style>{`
      @keyframes fx-uv-loop-pulse {
        0%   { opacity: 0.55; }
        50%  { opacity: 0.75; }
        100% { opacity: 0.55; }
      }
      @keyframes fx-uv-loop-ring {
        0%   { transform: translate(-50%,-50%) scale(0.85) rotate(0deg);   opacity: 0.15; }
        100% { transform: translate(-50%,-50%) scale(1.15) rotate(180deg); opacity: 0.05; }
      }
      .fx-uv-loop {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(20, 0, 50, 0.75) 0%,
          rgba(60, 20, 130, 0.45) 50%,
          rgba(0, 0, 20, 0.3) 100%
        );
        animation: fx-uv-loop-pulse 4s ease-in-out infinite;
      }
      .fx-uv-loop-ring {
        position: fixed; top: 50%; left: 50%;
        width: 55vmin; height: 55vmin; border-radius: 50%;
        border: 1px solid rgba(180, 130, 255, 0.2);
        animation: fx-uv-loop-ring 8s linear infinite;
      }
    `}</style>
    <div className="fx-uv-loop" />
    <div className="fx-uv-loop-ring" />
  </>
);

import { isFingerExtended, isFingerHalfBent, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Unlimited Void', category: 'ultimate', color: '#c8a8ff',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Index finger up, middle finger slightly curled',
  gestureType: 'single',
  undodgeable: true,
  turnType: 'domain',
  turnAmount: 2,
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
  domainTick() { return { stunOpponent: 1 }; },
  Effect,
  LoopEffect,
  resolve() { return { stunTurns: 1 }; },
};
