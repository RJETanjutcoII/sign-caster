import logic from './sharingan.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-sharingan-bg {
        0%   { opacity: 0; }
        10%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes fx-sharingan-ring {
        0%   { transform: rotate(0deg)   scale(0.5); opacity: 0; }
        15%  { transform: rotate(30deg)  scale(1);   opacity: 1; }
        85%  { transform: rotate(330deg) scale(1);   opacity: 1; }
        100% { transform: rotate(360deg) scale(1.2); opacity: 0; }
      }
      .fx-sharingan-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center, rgba(120,0,0,0.7) 0%, rgba(60,0,0,0.5) 50%, transparent 80%);
        animation: fx-sharingan-bg 2s ease-in-out forwards;
      }
      .fx-sharingan-ring {
        position: absolute; inset: 0; margin: auto;
        width: 35vmin; height: 35vmin;
        border: 3px solid rgba(255,40,40,0.85);
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(255,0,0,0.6), inset 0 0 20px rgba(255,0,0,0.3);
        animation: fx-sharingan-ring 2s ease-out forwards;
      }
    `}</style>
    <div className="fx-sharingan-bg">
      <div className="fx-sharingan-ring" />
    </div>
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/sharingan/caster.webm' },
    target: { type: 'overlay', src: '/effects/sharingan/target.webm' },
  },
};
