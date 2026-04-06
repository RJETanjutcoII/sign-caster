'use client';

import { useState } from 'react';

const TOTAL_POINTS = 10;
const MAX_PER_STAT = 5;

const STATS = [
  { key: 'hp',  label: 'HP',  desc: 'Max health',           base: 120, perPt: 25 },
  { key: 'atk', label: 'ATK', desc: 'Bonus damage on every hit', base: 0,   perPt: 4  },
  { key: 'def', label: 'DEF', desc: 'Flat damage reduction',  base: 0,   perPt: 3  },
  { key: 'spd', label: 'SPD', desc: 'Determines turn order',  base: 1,   perPt: 1  },
  { key: 'mp',  label: 'MP',  desc: 'Max mana',               base: 20,  perPt: 3  },
];

const PRESETS = [
  { label: 'Balanced',  pts: { hp: 2, atk: 2, def: 2, spd: 2, mp: 2 } },
  { label: 'Brawler',   pts: { hp: 0, atk: 5, def: 3, spd: 0, mp: 2 } },
  { label: 'Tank',      pts: { hp: 5, atk: 0, def: 5, spd: 0, mp: 0 } },
  { label: 'Speedster', pts: { hp: 2, atk: 0, def: 0, spd: 5, mp: 3 } },
];

function computeBuild(pts) {
  return {
    hp:  STATS.find(s => s.key === 'hp').base  + pts.hp  * STATS.find(s => s.key === 'hp').perPt,
    atk: STATS.find(s => s.key === 'atk').base + pts.atk * STATS.find(s => s.key === 'atk').perPt,
    def: STATS.find(s => s.key === 'def').base + pts.def * STATS.find(s => s.key === 'def').perPt,
    spd: STATS.find(s => s.key === 'spd').base + pts.spd * STATS.find(s => s.key === 'spd').perPt,
    mp:  STATS.find(s => s.key === 'mp').base  + pts.mp  * STATS.find(s => s.key === 'mp').perPt,
  };
}

export default function StatBuilder({ onConfirm, onBack }) {
  const [pts, setPts] = useState({ hp: 0, atk: 0, def: 0, spd: 0, mp: 0 });

  const spent = Object.values(pts).reduce((a, b) => a + b, 0);
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
    onConfirm(computeBuild(pts));
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
