import logic from './instant_transmission.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-it {
        0%   { opacity: 0; }
        5%   { opacity: 0.9; }
        30%  { opacity: 0; }
        60%  { opacity: 0.4; }
        100% { opacity: 0; }
      }
      .fx-it {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(255, 220, 80, 0.75);
        animation: fx-it 0.6s ease-out forwards;
      }
    `}</style>
    <div className="fx-it" />
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/instant_transmission/caster.webm' },
    target: null,
  },
};
