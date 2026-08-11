import logic from './power_up.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-pu-bloom {
        0%   { opacity: 0;   transform: scale(0.4); }
        25%  { opacity: 1;   transform: scale(1.1); }
        70%  { opacity: 0.9; transform: scale(1); }
        100% { opacity: 0;   transform: scale(1.5); }
      }
      @keyframes fx-pu-streak {
        0%   { opacity: 0.9; transform: translateY(0)   scaleX(1); }
        100% { opacity: 0;   transform: translateY(-80px) scaleX(0.3); }
      }
      .fx-pu-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          rgba(255, 190, 60, 0.6) 0%,
          rgba(255, 140, 20, 0.3) 45%,
          transparent 75%
        );
        animation: fx-pu-bloom 1.5s ease-out forwards;
      }
      .fx-pu-streak {
        position: fixed; bottom: 35%; pointer-events: none;
        width: 3px; height: 40px; border-radius: 2px;
        background: rgba(255, 210, 80, 0.85);
        animation: fx-pu-streak 0.7s ease-out forwards;
      }
    `}</style>
    <div className="fx-pu-bg" />
    {[-18,-9,0,9,18].map(x => (
      <div key={x} className="fx-pu-streak"
        style={{ left: `calc(50% + ${x * 5}px)`, animationDelay: `${Math.abs(x) * 0.04}s` }} />
    ))}
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/power_up/caster.webm' },
    target: null,
  },
};
