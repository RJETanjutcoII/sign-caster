// Single source of truth for "is this a real ability key" and "is this a
// plausible build" checks. Used anywhere untrusted JSON needs sanitizing
// before being trusted: the client's own useMultiplayer.js (validating an
// opponent's handshake), the WS relay (validating both sides' handshake
// before seeding its own shadow simulation), and previously duplicated by
// hand in both places — kept in one file so the three copies can't drift.
export const KNOWN_ABILITIES = new Set([
  'fist', 'finger_gun', 'death_ball', 'kamehameha', 'spirit_bomb', 'unlimited_void',
  'malevolent_shrine', 'mahoraga', 'instant_transmission', 'thumbs_up', 'web_shot',
  'double_v', 'iron_wall', 'power_up', 'expose', 'sharingan', 'sacred_ground',
]);

// Loose, generous bounds on a *final* build (hp/atk/def/spd/mp) — not the
// same as the 0-5 point-allocation bounds enforced by StatBuilder.js on the
// client that actually produces these numbers; this is just a safety clamp
// against an obviously-forged remote build, not a game-balance rule.
export const STAT_BOUNDS = { hp: [120, 620], atk: [0, 80], def: [0, 60], spd: [1, 21], mp: [20, 80] };

export function sanitizeLoadout(loadout, maxLen = 20) {
  const raw = Array.isArray(loadout) ? loadout : [];
  return raw.filter(k => typeof k === 'string' && KNOWN_ABILITIES.has(k)).slice(0, maxLen);
}

export function sanitizeBuild(build) {
  const raw = build && typeof build === 'object' ? build : {};
  return Object.fromEntries(
    Object.entries(STAT_BOUNDS).map(([key, [min, max]]) => {
      const v = Number(raw[key]);
      return [key, Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min];
    })
  );
}
