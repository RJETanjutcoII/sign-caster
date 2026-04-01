'use client';

import { ABILITIES, getCooldownProgress } from '@/lib/abilities';
import { useEffect, useState } from 'react';

/**
 * HUD showing the active gesture, ability name, and cooldown bars.
 * Only tracks and renders abilities present in the loadout Set.
 */
export default function AbilityDisplay({ gesture, loadout }) {
  const [cooldowns, setCooldowns] = useState({});

  // Poll cooldown progress at 30fps — only for loadout abilities
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = {};
      for (const key of loadout) {
        updated[key] = getCooldownProgress(key);
      }
      setCooldowns(updated);
    }, 33);
    return () => clearInterval(interval);
  }, [loadout]);

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
          <div className="cooldown-bar-track">
            <div
              className="cooldown-bar-fill"
              style={{
                width: `${(cooldowns[gesture] ?? 1) * 100}%`,
                background: activeAbility.color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
