import logic from './death_ball.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-death-ball {
        0%   { opacity: 0; transform: scale(0.2); }
        30%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(2.2); }
      }
      .fx-death-ball {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, rgba(180,60,255,0.75) 0%, rgba(100,0,180,0.3) 40%, transparent 70%);
        animation: fx-death-ball 0.8s ease-out forwards;
      }
    `}</style>
    <div className="fx-death-ball" />
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/death_ball/caster.webm' },
    target: { type: 'overlay', src: '/effects/death_ball/target.webm' },
  },
};
