import logic from './finger_gun.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-shot {
        0%   { opacity: 0; transform: translateX(-60px); }
        15%  { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; transform: translateX(80px); }
      }
      .fx-shot {
        position: fixed; inset: 0; pointer-events: none;
        background: linear-gradient(90deg, transparent 20%, rgba(255,160,60,0.55) 50%, transparent 80%);
        animation: fx-shot 0.55s ease-out forwards;
      }
    `}</style>
    <div className="fx-shot" />
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
