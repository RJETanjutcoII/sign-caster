'use client';

import { useState } from 'react';
import { STATS, computeBuildFromPoints } from '@/lib/buildUtils';

const TOTAL_POINTS = 10;
const MAX_PER_STAT = 5;

const PRESETS = [
  { label: 'Balanced',  pts: { hp: 2, atk: 2, def: 2, spd: 2, mp: 2 } },
  { label: 'Brawler',   pts: { hp: 0, atk: 5, def: 3, spd: 0, mp: 2 } },
  { label: 'Tank',      pts: { hp: 5, atk: 0, def: 5, spd: 0, mp: 0 } },
  { label: 'Speedster', pts: { hp: 2, atk: 0, def: 0, spd: 5, mp: 3 } },
];

const DEFAULT_PTS = { hp: 0, atk: 0, def: 0, spd: 0, mp: 0 };

export default function StatBuilder({ onConfirm, onBack, initialPoints }) {
  const [pts, setPts] = useState(initialPoints ?? DEFAULT_PTS);

  const spent     = Object.values(pts).reduce((a, b) => a + b, 0);
  const remaining = TOTAL_POINTS - spent;

  function adjust(key, delta) {
    setPts(prev => {
      const next = prev[key] + delta;
      if (next < 0 || next > MAX_PER_STAT) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [key]: next };
    });
  }

  function applyPreset(preset) {
    setPts({ ...preset.pts });
  }

  function handleConfirm() {
    onConfirm(computeBuildFromPoints(pts), pts);
  }

  return (
    <div className="statbuilder-screen">
      <h1 className="statbuilder-title">BUILD</h1>

      <div className="statbuilder-pool">
        <span className="statbuilder-pool-num" data-empty={remaining === 0}>{remaining}</span>
        <span className="statbuilder-pool-label"> points remaining</span>
      </div>

      <div className="statbuilder-rows">
        {STATS.map(stat => {
          const val = stat.base + pts[stat.key] * stat.perPt;
          return (
            <div key={stat.key} className="statbuilder-row">
              <div className="statbuilder-row-info">
                <span className="statbuilder-row-label">{stat.label}</span>
                <span className="statbuilder-row-desc">{stat.desc}</span>
              </div>

              <div className="statbuilder-row-pips">
                {Array.from({ length: MAX_PER_STAT }, (_, i) => (
                  <span key={i} className={`statbuilder-pip${i < pts[stat.key] ? ' statbuilder-pip--filled' : ''}`} />
                ))}
              </div>

              <div className="statbuilder-row-controls">
                <button
                  className="statbuilder-btn"
                  onClick={() => adjust(stat.key, -1)}
                  disabled={pts[stat.key] === 0}
                >−</button>
                <span className="statbuilder-row-val">{val}</span>
                <button
                  className="statbuilder-btn"
                  onClick={() => adjust(stat.key, 1)}
                  disabled={pts[stat.key] >= MAX_PER_STAT || remaining <= 0}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="statbuilder-presets">
        {PRESETS.map(p => (
          <button key={p.label} className="statbuilder-preset-btn" onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="statbuilder-actions">
        <button className="loadout-start" onClick={handleConfirm}>Confirm Build →</button>
        <button className="statbuilder-back-btn" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}
