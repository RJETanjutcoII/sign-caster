'use client';

import { ABILITIES } from '@/lib/abilities';

export default function AbilityDisplay({ gesture, loadout }) {
  const activeAbility = loadout.has(gesture) ? ABILITIES[gesture] : null;

  return (
    <div className="ability-display">
      <div className="gesture-label">
        Gesture: <span className="gesture-value">{gesture ?? '—'}</span>
      </div>

      {activeAbility && (
        <div className="ability-row">
          <span className="ability-name" style={{ color: activeAbility.color }}>
            {activeAbility.name}
          </span>
        </div>
      )}
    </div>
  );
}
