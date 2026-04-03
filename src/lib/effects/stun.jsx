export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-stun {
        0%   { opacity: 0; }
        10%  { opacity: 1; }
        50%  { opacity: 0.6; }
        100% { opacity: 0; }
      }
      @keyframes fx-stun-spark {
        0%   { transform: translate(-50%, -50%) scale(0) rotate(0deg);   opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1.8) rotate(45deg); opacity: 0; }
      }
      .fx-stun {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(255, 230, 50, 0.2);
        animation: fx-stun 0.8s ease-out forwards;
      }
      .fx-stun-spark {
        position: absolute; top: 50%; left: 50%;
        width: 30vmin; height: 30vmin;
        border: 3px solid rgba(255,230,50,0.8);
        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        animation: fx-stun-spark 0.8s ease-out forwards;
      }
    `}</style>
    <div className="fx-stun">
      <div className="fx-stun-spark" />
    </div>
  </>
);
