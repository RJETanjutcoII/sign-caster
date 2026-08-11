import logic from './fist.logic.js';

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

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/strike/caster.webm' },
    target: { type: 'overlay', src: '/effects/strike/target.webm' },
  },
};
