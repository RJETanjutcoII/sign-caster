import logic from './web_shot.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-web-strand {
        0%   { opacity: 0; transform: scaleX(0) rotate(var(--r)); }
        15%  { opacity: 0.9; transform: scaleX(1) rotate(var(--r)); }
        70%  { opacity: 0.7; transform: scaleX(1) rotate(var(--r)); }
        100% { opacity: 0; transform: scaleX(1.05) rotate(var(--r)); }
      }
      @keyframes fx-web-splat {
        0%   { opacity: 0; transform: translate(-50%, -50%) scale(0); }
        20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        60%  { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); }
      }
      .fx-web-overlay {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(200, 220, 255, 0.08);
        animation: fx-web-strand 0.9s ease-out forwards;
      }
      .fx-web-strand {
        position: fixed;
        top: 50%; left: 50%;
        width: 55vw; height: 2px;
        background: linear-gradient(90deg, transparent, rgba(180, 210, 255, 0.85), transparent);
        transform-origin: left center;
        filter: blur(0.5px);
        animation: fx-web-strand 0.9s ease-out forwards;
      }
      .fx-web-splat {
        position: fixed; top: 50%; left: 50%;
        width: 90px; height: 90px;
        border-radius: 50%;
        border: 2px solid rgba(180, 210, 255, 0.6);
        animation: fx-web-splat 0.9s ease-out forwards;
      }
    `}</style>
    <div className="fx-web-overlay" />
    <div className="fx-web-strand" style={{ '--r': '-18deg', marginLeft: '-27.5vw', marginTop: '-1px' }} />
    <div className="fx-web-strand" style={{ '--r':  '5deg',  marginLeft: '-27.5vw', marginTop: '-1px' }} />
    <div className="fx-web-strand" style={{ '--r':  '28deg', marginLeft: '-27.5vw', marginTop: '-1px' }} />
    <div className="fx-web-splat" />
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/web_shot/caster.webm' },
    target: { type: 'overlay', src: '/effects/web_shot/target.webm' },
  },
};
