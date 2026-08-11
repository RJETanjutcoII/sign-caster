import logic from './mahoraga.logic.js';

export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-maho-spin {
        0%   { transform: rotate(0deg)   scale(0.4); opacity: 0; }
        20%  { transform: rotate(60deg)  scale(1);   opacity: 1; }
        80%  { transform: rotate(300deg) scale(1);   opacity: 1; }
        100% { transform: rotate(360deg) scale(1.3); opacity: 0; }
      }
      @keyframes fx-maho-bg {
        0%   { opacity: 0; }
        20%  { opacity: 0.3; }
        100% { opacity: 0; }
      }
      .fx-maho-bg {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(30, 60, 120, 0.4);
        animation: fx-maho-bg 2s ease-out forwards;
      }
      .fx-maho-wheel {
        position: absolute; inset: 0; margin: auto;
        width: 50vmin; height: 50vmin;
        border: 4px solid rgba(160,200,255,0.85);
        border-radius: 50%;
        box-shadow: 0 0 30px rgba(160,200,255,0.5);
        animation: fx-maho-spin 2s ease-out forwards;
      }
      .fx-maho-spoke {
        position: absolute; top: 50%; left: 50%;
        width: 50%; height: 2px;
        background: rgba(160,200,255,0.6);
        transform-origin: left center;
      }
    `}</style>
    <div className="fx-maho-bg">
      <div className="fx-maho-wheel">
        {[0,45,90,135,180,225,270,315].map(deg => (
          <div key={deg} className="fx-maho-spoke" style={{ transform: `rotate(${deg}deg)` }} />
        ))}
      </div>
    </div>
  </>
);

export default {
  ...logic,
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/mahoraga/caster.webm' },
    target: { type: 'overlay', src: '/effects/mahoraga/target.webm' },
  },
};
