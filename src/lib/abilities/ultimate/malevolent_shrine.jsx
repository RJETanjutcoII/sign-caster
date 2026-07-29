import { memo } from 'react';

const SLASHES = [
  { top: '20%', left: '10%',  rotate: '45deg',  delay: '0s' },
  { top: '50%', left: '30%',  rotate: '-30deg', delay: '0.1s' },
  { top: '30%', left: '60%',  rotate: '60deg',  delay: '0.05s' },
  { top: '70%', left: '70%',  rotate: '-50deg', delay: '0.15s' },
  { top: '15%', left: '80%',  rotate: '20deg',  delay: '0.08s' },
];

export const Effect = memo(() => (
  <>
    <style>{`
      @keyframes fx-shrine-bg {
        0%   { opacity: 0; }
        10%  { opacity: 0.6; }
        100% { opacity: 0; }
      }
      @keyframes fx-shrine-slash {
        0%   { opacity: 0; transform: scaleX(0) rotate(var(--r)); }
        20%  { opacity: 1; transform: scaleX(1) rotate(var(--r)); }
        100% { opacity: 0; transform: scaleX(1.2) rotate(var(--r)); }
      }
      .fx-shrine-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(180, 0, 0, 0.35);
        animation: fx-shrine-bg 1.2s ease-out forwards;
      }
      .fx-shrine-slash {
        position: absolute;
        width: 35vw; height: 3px;
        background: linear-gradient(90deg, transparent, #ff4444, transparent);
        transform-origin: left center;
        animation: fx-shrine-slash 0.7s ease-out forwards;
        filter: blur(1px);
      }
    `}</style>
    <div className="fx-shrine-bg">
      {SLASHES.map((s, i) => (
        <div
          key={i}
          className="fx-shrine-slash"
          style={{ top: s.top, left: s.left, '--r': s.rotate, animationDelay: s.delay }}
        />
      ))}
    </div>
  </>
));

export const LoopEffect = memo(() => (
  <>
    <style>{`
      @keyframes fx-shrine-loop-pulse {
        0%   { opacity: 0.4; }
        50%  { opacity: 0.6; }
        100% { opacity: 0.4; }
      }
      @keyframes fx-shrine-loop-slash {
        0%   { opacity: 0; transform: scaleX(0) rotate(var(--r)); }
        15%  { opacity: 0.35; transform: scaleX(1) rotate(var(--r)); }
        60%  { opacity: 0.35; transform: scaleX(1) rotate(var(--r)); }
        100% { opacity: 0; transform: scaleX(1) rotate(var(--r)); }
      }
      .fx-shrine-loop {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(100, 0, 0, 0.5) 0%,
          rgba(60, 0, 0, 0.3) 55%,
          transparent 80%
        );
        animation: fx-shrine-loop-pulse 3.5s ease-in-out infinite;
      }
      .fx-shrine-loop-slash {
        position: fixed;
        width: 40vw; height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255,40,40,0.25), transparent);
        transform-origin: left center;
        animation: fx-shrine-loop-slash 3.5s ease-in-out infinite;
        filter: blur(1px);
      }
    `}</style>
    <div className="fx-shrine-loop" />
    {SLASHES.map((s, i) => (
      <div
        key={i}
        className="fx-shrine-loop-slash"
        style={{ top: s.top, left: s.left, '--r': s.rotate, animationDelay: `${i * 0.4}s` }}
      />
    ))}
  </>
));

import { dist, isFingerExtended, isFingerCurled } from '@/lib/gestures';

function isPressedShape(lm) {
  return (
    isFingerExtended(lm, 12) &&
    isFingerExtended(lm, 16) &&
    isFingerCurled(lm,   8)  &&
    isFingerCurled(lm,   20)
  );
}

export default {
  name: 'Malevolent Shrine', category: 'ultimate', color: '#ff3333',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Middle + ring fingers up, index + pinky down — both hands',
  gestureType: 'two-hand',
  turnType: 'domain',
  turnAmount: 3,
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isPressedShape(lm0) && isPressedShape(lm1) && dist(lm0[0], lm1[0]) < 0.7;
  },
  domainTick() { return { damageOpponent: 15 }; },
  Effect,
  LoopEffect,
  videoEffects: {
    caster:         { type: 'background', src: '/effects/malevolent_shrine/bg.webm',                loop: true  },
    target:         { type: 'background', src: '/effects/malevolent_shrine/bg.webm',                loop: true  },
    caster_entry:   { type: 'background', src: '/effects/malevolent_shrine/bg_entry.webm',          loop: false },
    opponent_entry: { type: 'background', src: '/effects/malevolent_shrine/bg_entry_opponent.webm', loop: false },
  },
  resolve() { return {}; },
};
