import logic from './double_v.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-dv-streak {
        0%   { opacity: 0; transform: translateX(-60px) scaleX(0.4); }
        20%  { opacity: 1; transform: translateX(0)    scaleX(1); }
        70%  { opacity: 0.6; }
        100% { opacity: 0; transform: translateX(20px); }
      }
      @keyframes fx-dv-burst {
        0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
        25%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
      }
      .fx-dv-streak {
        position: fixed; top: 50%; left: 0;
        width: 100%; height: 3px;
        background: linear-gradient(90deg, transparent, rgba(120,220,255,0.9), rgba(255,255,255,0.6), transparent);
        filter: blur(1px);
        animation: fx-dv-streak 0.5s ease-out forwards;
      }
      .fx-dv-streak:nth-child(2) { top: 46%; animation-delay: 0.05s; opacity: 0.7; }
      .fx-dv-streak:nth-child(3) { top: 54%; animation-delay: 0.08s; opacity: 0.5; }
      .fx-dv-burst {
        position: fixed; top: 50%; left: 50%;
        width: 120px; height: 120px; border-radius: 50%;
        background: radial-gradient(circle, rgba(180,240,255,0.5) 0%, transparent 70%);
        animation: fx-dv-burst 0.6s ease-out forwards;
      }
    `}</style>
    <div className="fx-dv-streak" />
    <div className="fx-dv-streak" />
    <div className="fx-dv-streak" />
    <div className="fx-dv-burst" />
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/strike/caster.webm' },
    target: null,
  },
};
