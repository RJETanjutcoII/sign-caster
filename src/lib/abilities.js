/**
 * abilities.js
 * Maps gesture names to ability configs and manages cooldowns.
 */

export const ABILITIES = {
  fist: {
    name: 'Strike',
    category: 'basic',
    color: '#ff4444',
    effectClass: 'effect-strike',
    cooldown: 1500,
  },
  point: {
    name: 'Death Ball',
    category: 'basic',
    color: '#bb44ff',
    effectClass: 'effect-death-ball',
    cooldown: 1500,
  },
  finger_gun: {
    name: 'Shot',
    category: 'basic',
    color: '#ff8844',
    effectClass: 'effect-shot',
    cooldown: 1500,
  },
  unlimited_void: {
    name: 'Unlimited Void',
    category: 'ultimate',
    color: '#c8a8ff',
    effectClass: 'effect-domain',
    cooldown: 8000,
  },
  malevolent_shrine: {
    name: 'Malevolent Shrine',
    category: 'ultimate',
    color: '#ff3333',
    effectClass: 'effect-shrine',
    cooldown: 12000,
  },
  mahoraga: {
    name: 'Summon Mahoraga',
    category: 'ultimate',
    color: '#a0c8ff',
    effectClass: 'effect-mahoraga',
    cooldown: 15000,
  },
  instant_transmission: {
    name: 'Instant Transmission',
    category: 'support',
    color: '#ffd966',
    effectClass: 'effect-it',
    cooldown: 2000,
  },
};

// Tracks the last time each ability was triggered
const lastTriggeredAt = {};

/**
 * Attempts to trigger an ability for the given gesture.
 * Returns the ability config if triggered, null if on cooldown or unknown gesture.
 * @param {string} gesture
 * @returns {object | null}
 */
export function tryTriggerAbility(gesture) {
  const ability = ABILITIES[gesture];
  if (!ability) return null;

  const now = Date.now();
  const last = lastTriggeredAt[gesture] ?? 0;

  if (now - last < ability.cooldown) return null;

  lastTriggeredAt[gesture] = now;
  return ability;
}

/**
 * Returns a 0–1 value representing how much of the cooldown has elapsed.
 * 1.0 = fully ready, 0.0 = just triggered.
 * @param {string} gesture
 * @returns {number}
 */
export function getCooldownProgress(gesture) {
  const ability = ABILITIES[gesture];
  if (!ability) return 1;
  const last = lastTriggeredAt[gesture] ?? 0;
  const elapsed = Date.now() - last;
  return Math.min(elapsed / ability.cooldown, 1);
}
