'use client';

import { ABILITIES } from '@/lib/abilities';

export default function LoadoutHUD({ loadout }) {
  if (!loadout) return null;

  const entries = [...loadout].map(key => ({ key, ability: ABILITIES[key] })).filter(e => e.ability);

  return (
    <div className="loadout-hud">
      {entries.map(({ key, ability }) => (
        <div key={key} className="loadout-hud-entry" style={{ '--ability-color': ability.color }}>
          <span className="loadout-hud-dot" />
          <div className="loadout-hud-text">
            <span className="loadout-hud-name">{ability.name}</span>
            <span className="loadout-hud-hint">{ability.gesture}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
