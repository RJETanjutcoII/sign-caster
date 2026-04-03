export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-rest {
        0%   { opacity: 0; transform: scale(0.9); }
        30%  { opacity: 0.7; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.15); }
      }
      .fx-rest {
        position: fixed; inset: 0; pointer-events: none;
        background: radial-gradient(circle at 50% 50%, rgba(60,220,120,0.45) 0%, transparent 65%);
        animation: fx-rest 1s ease-out forwards;
      }
    `}</style>
    <div className="fx-rest" />
  </>
);
