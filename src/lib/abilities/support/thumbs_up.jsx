import logic from './thumbs_up.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-heal {
        0%   { opacity: 0; transform: scale(0.8); }
        30%  { opacity: 1; transform: scale(1.05); }
        65%  { opacity: 1; transform: scale(0.97); }
        100% { opacity: 0; transform: scale(1.1); }
      }
      .fx-heal {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, rgba(255,120,180,0.55) 0%, rgba(120,255,160,0.2) 50%, transparent 70%);
        animation: fx-heal 1s ease-in-out forwards;
      }
    `}</style>
    <div className="fx-heal" />
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/heal/caster.webm' },
    target: null,
  },
};
