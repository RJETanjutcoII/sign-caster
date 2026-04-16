'use client';

export default function ModeSelect({ onTraining, onBot, onPvP, onProfile, onEditBuild, onEditLoadout, hasSavedConfig }) {
  return (
    <div className="mode-select">
      <div className="mode-top-bar">
        <button className="mode-profile-btn" onClick={onProfile}>My Profile</button>
        <button className="mode-profile-btn" onClick={onEditBuild}>Edit Build</button>
        <button className="mode-profile-btn" onClick={onEditLoadout}>Edit Moveset</button>
      </div>
      <h1 className="mode-title">SIGN CASTER</h1>
      {hasSavedConfig
        ? <p className="mode-subtitle">Saved setup ready — pick a mode to fight</p>
        : <p className="mode-subtitle">Choose your mode</p>
      }
      <div className="mode-buttons">
        <button className="mode-btn" onClick={onTraining}>
          <span className="mode-btn-name">Training Mode</span>
          <span className="mode-btn-desc">Practice gestures freely — no opponent</span>
        </button>
        <button className="mode-btn mode-btn--battle" onClick={onBot}>
          <span className="mode-btn-name">1v1 vs Bot</span>
          <span className="mode-btn-desc">Fight an AI opponent in split-screen</span>
        </button>
        <button className="mode-btn mode-btn--pvp" onClick={onPvP}>
          <span className="mode-btn-name">1v1 PvP</span>
          <span className="mode-btn-desc">Fight a real opponent online</span>
        </button>
      </div>
    </div>
  );
}
