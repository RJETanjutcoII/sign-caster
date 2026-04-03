'use client';

import { useState } from 'react';
import { ABILITIES } from '@/lib/abilities';

const CATEGORY_CONFIG = {
  basic:             { label: 'Basic Attacks',      max: 3 },
  special:           { label: 'Special',            max: 1 },
  ultimate:          { label: 'Ultimate',           max: 1 },
  support:           { label: 'Support',            max: 1 },
  innate:            { label: 'Innate',             max: 1 },
};

export default function LoadoutSelect({ onStart }) {
  const [slots, setSlots] = useState([]);

  function toggle(key) {
    setSlots(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      const cat = ABILITIES[key].category;
      const catCount = prev.filter(k => ABILITIES[k].category === cat).length;
      if (catCount >= CATEGORY_CONFIG[cat].max) return prev;
      return [...prev, key];
    });
  }

  const grouped = Object.entries(CATEGORY_CONFIG).map(([cat, config]) => ({
    cat,
    config,
    abilities: Object.entries(ABILITIES).filter(([, a]) => a.category === cat),
  }));

  return (
    <div className="loadout-screen">
      <h1 className="loadout-title">SIGN CASTER</h1>

      {grouped.map(({ cat, config, abilities }) => {
        const selected = slots.filter(k => ABILITIES[k].category === cat);
        return (
          <div key={cat} className="loadout-category">
            <div className="loadout-category-header">
              <span className="loadout-category-label">{config.label}</span>
              <span className="loadout-category-count">{selected.length} / {config.max}</span>
            </div>
            <div className="loadout-grid">
              {abilities.map(([key, ability]) => {
                const active = slots.includes(key);
                const maxed  = !active && selected.length >= config.max;
                return (
                  <button
                    key={key}
                    className={`loadout-card ${active ? 'loadout-card--active' : ''} ${maxed ? 'loadout-card--disabled' : ''}`}
                    style={{ '--ability-color': ability.color }}
                    onClick={() => toggle(key)}
                    disabled={maxed}
                  >
                    <span className="loadout-card-name">{ability.name}</span>
                    <span className="loadout-card-gesture">{ability.gesture}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        className="loadout-start"
        disabled={slots.length === 0}
        onClick={() => onStart(new Set(slots))}
      >
        Enter the Arena
      </button>
    </div>
  );
}
