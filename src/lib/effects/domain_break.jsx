export const Effect = () => (
  <>
    <style>{`
      @keyframes db-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
      @keyframes db-ring  { 0% { transform: scale(0); opacity: 0.8; } 100% { transform: scale(4); opacity: 0; } }
      .db-flash {
        position: fixed; inset: 0; pointer-events: none;
        background: #fff;
        animation: db-flash 0.5s ease-out forwards;
        z-index: 100;
      }
      .db-ring {
        position: fixed; top: 50%; left: 50%;
        width: 30vmin; height: 30vmin;
        margin-top: -15vmin; margin-left: -15vmin;
        border-radius: 50%;
        border: 4px solid #fff;
        pointer-events: none;
        animation: db-ring 0.5s ease-out forwards;
        z-index: 101;
      }
    `}</style>
    <div className="db-flash" />
    <div className="db-ring" />
  </>
);
