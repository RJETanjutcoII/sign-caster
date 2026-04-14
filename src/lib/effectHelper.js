import { ABILITIES } from './abilities';
import { Effect as RestEffect } from './effects/rest';
import { Effect as FailEffect  } from './effects/fail';
import { Effect as StunEffect  } from './effects/stun';

export function getEffectComponent(effectKey, gesture) {
  const g = gesture === 'stunned' ? null : gesture;
  if (effectKey === 'rest')             return RestEffect;
  if (effectKey === 'fail')             return FailEffect;
  if (effectKey === 'multi_turn_start') return g ? ABILITIES[g]?.ChargeEffect ?? null : null;
  if (effectKey === 'multi_turn_final') return g ? ABILITIES[g]?.Effect ?? null : null;
  if (effectKey === 'domain_start')     return g ? ABILITIES[g]?.Effect ?? null : null;
  if (gesture === 'stunned')            return StunEffect;
  return g ? ABILITIES[g]?.Effect ?? null : null;
}

// Returns { type, src, loop? } | null for the local player's camera effect
export function getVideoEffect(gesture, isCaster) {
  if (!gesture || gesture === 'stunned') return null;
  const effects = ABILITIES[gesture]?.videoEffects;
  if (!effects) return null;
  return isCaster ? effects.caster : effects.target;
}

export function buildLabel(who, gesture, message) {
  if (gesture === 'stunned') return `${who}: Stunned! Cannot move!`;
  if (message) return `${who}: ${message}`;
  const name = ABILITIES[gesture]?.name?.toUpperCase();
  return name ? `${who}: ${name}` : null;
}
