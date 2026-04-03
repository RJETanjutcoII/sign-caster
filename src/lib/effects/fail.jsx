export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-fail {
        0%   { opacity: 0.6; filter: grayscale(0); }
        20%  { opacity: 1;   filter: grayscale(1); }
        100% { opacity: 0;   filter: grayscale(1); }
      }
      .fx-fail {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(120, 120, 120, 0.35);
        animation: fx-fail 0.7s ease-out forwards;
      }
    `}</style>
    <div className="fx-fail" />
  </>
);
