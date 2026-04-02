'use client';

import { ABILITIES } from '@/lib/abilities';

const GESTURE_HINTS = {
  fist:                 'Fist',
  point:                'Point (index up)',
  finger_gun:           'Index + thumb up',
  unlimited_void:       'Two fingers, chest',
  malevolent_shrine:    'Middle + ring up, both hands',
  mahoraga:             'Both fists, close',
  kamehameha:           'Both palms, together',
  spirit_bomb:          'Both palms, wide',
  instant_transmission: 'Two fingers, forehead',
  thumbs_up:            'Thumbs up',
  sharingan:            'Wide eyes',
};

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
            <span className="loadout-hud-hint">{GESTURE_HINTS[key]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
