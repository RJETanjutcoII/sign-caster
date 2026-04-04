'use client';

export default function ModeSelect({ onTraining, onBot }) {
  return (
    <div className="mode-select">
      <h1 className="mode-title">SIGN CASTER</h1>
      <p className="mode-subtitle">Choose your mode</p>
      <div className="mode-buttons">
        <button className="mode-btn" onClick={onTraining}>
          <span className="mode-btn-name">Training Mode</span>
          <span className="mode-btn-desc">Practice gestures freely — no opponent</span>
        </button>
        <button className="mode-btn mode-btn--battle" onClick={onBot}>
          <span className="mode-btn-name">1v1 vs Bot</span>
          <span className="mode-btn-desc">Fight an AI opponent in split-screen</span>
        </button>
      </div>
    </div>
  );
}
