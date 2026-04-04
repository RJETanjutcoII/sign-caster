import { ABILITIES } from './abilities';

export const INITIAL_STATE = {
  hp:    100, maxHp:   100,
  mana:   20, maxMana:  20,
  ultBar:  0, maxUlt:    5,
  // Ongoing effects
  stunTurnsRemaining: 0,
  dot: null,               // { damage, turnsRemaining }
  multiTurnActive: null,   // { abilityKey, turnsLeft } when a multi-turn move is charging
  activeDomain: null,      // { abilityKey, turnsLeft } when a domain is active
  nullified: false,        // incoming attacks negated this turn (IT)
};

/**
 * Called at the start of each selecting phase.
 * Ticks down DoT, stun, and determines if a gesture is forced.
 *
 * @param {object} state
 * @returns {{ newState: object, forcedGesture: string|null }}
 *   forcedGesture is 'stunned' (skip turn) or 'spirit_bomb' (forced fire), or null
 */
export function applyStartOfTurn(state) {
  const s = { ...state, nullified: false };

  // Tick domain passive
  const domainOutgoing = { damage: 0, stunTurns: 0 };
  if (s.activeDomain) {
    const domainAbility = ABILITIES[s.activeDomain.abilityKey];
    if (domainAbility?.domainTick) {
      const tick = domainAbility.domainTick({ caster: s });
      if (tick.manaRegen)     s.mana = Math.min(s.maxMana, s.mana + tick.manaRegen);
      if (tick.healSelf)      s.hp   = Math.min(s.maxHp,   s.hp   + tick.healSelf);
      if (tick.damageOpponent) domainOutgoing.damage    = tick.damageOpponent;
      if (tick.stunOpponent)   domainOutgoing.stunTurns = tick.stunOpponent;
    }
    s.activeDomain = s.activeDomain.turnsLeft > 1
      ? { ...s.activeDomain, turnsLeft: s.activeDomain.turnsLeft - 1 }
      : null;
  }

  // Tick DoT
  if (s.dot && s.dot.turnsRemaining > 0) {
    s.hp  = Math.max(0, s.hp - s.dot.damage);
    s.dot = s.dot.turnsRemaining > 1
      ? { ...s.dot, turnsRemaining: s.dot.turnsRemaining - 1 }
      : null;
  }

  // Multi-turn moves take priority over stun
  if (s.multiTurnActive && s.multiTurnActive.turnsLeft > 0) {
    const { abilityKey } = s.multiTurnActive;
    s.multiTurnActive = { ...s.multiTurnActive, turnsLeft: s.multiTurnActive.turnsLeft - 1 };
    return { newState: s, forcedGesture: abilityKey, domainOutgoing };
  }

  if (s.stunTurnsRemaining > 0) {
    s.stunTurnsRemaining--;
    return { newState: s, forcedGesture: 'stunned', domainOutgoing };
  }

  return { newState: s, forcedGesture: null, domainOutgoing };
}

/**
 * Resolves a player's turn action and returns the updated self-state
 * plus outgoing effects to apply to the opponent.
 *
 * @param {object} state       - current player state
 * @param {string|null} gesture - locked gesture key, 'stunned', or null (rest)
 * @returns {{ newState: object, outgoing: object, message: string|null }}
 */
export function resolveTurn(state, gesture) {
  let s = { ...state };
  const outgoing = { damage: 0, stunTurns: 0, noRestBonus: false, dot: null };
  let message = null;

  // Stunned — skip turn entirely
  if (gesture === 'stunned') {
    message = 'Stunned — turn skipped';
    return { newState: s, outgoing, message };
  }

  // Rest — no gesture selected
  if (!gesture) {
    s.mana = Math.min(s.maxMana, s.mana + 10);
    message = 'Rested (+10 MP)';
    return { newState: s, outgoing, message, effectKey: 'rest' };
  }

  const ability = ABILITIES[gesture];
  if (!ability) return { newState: s, outgoing, message };

  // ── Domain: activate (or replace existing) ──────────────────────────────
  if (ability.turnType === 'domain') {
    if ((ability.manaCost || 0) > s.mana)   return { newState: s, outgoing, message: 'Not enough mana', effectKey: 'fail' };
    if ((ability.ultCost  || 0) > s.ultBar) return { newState: s, outgoing, message: 'Not enough ult',  effectKey: 'fail' };
    s.mana   -= (ability.manaCost || 0);
    s.ultBar -= (ability.ultCost  || 0);
    s.ultBar  = Math.min(s.maxUlt, s.ultBar + (ability.ultGain || 0));
    s.activeDomain = { abilityKey: gesture, turnsLeft: ability.turnAmount };
    return { newState: s, outgoing, effectKey: 'domain_start', message: `${ability.name} activated!` };
  }

  // ── Multi-turn: continuation / final turn ────────────────────────────────
  // Costs already paid on first cast; just resolve.
  if (ability.turnType === 'multi' && s.multiTurnActive?.abilityKey === gesture) {
    s.ultBar = Math.min(s.maxUlt, s.ultBar + (ability.ultGain || 0));
    s.multiTurnActive = null;

    const result = ability.resolve({ caster: s });
    if (result.healSelf)    s.hp = Math.min(s.maxHp, s.hp + result.healSelf);
    if (result.nullifySelf) s.nullified = true;
    outgoing.damage      = result.damage      ?? 0;
    outgoing.stunTurns   = result.stunTurns   ?? 0;
    outgoing.noRestBonus = result.noRestBonus ?? false;
    outgoing.dot         = result.dot         ?? null;
    return { newState: s, outgoing, effectKey: 'multi_turn_final' };
  }

  // ── Multi-turn: first cast ───────────────────────────────────────────────
  // Pay costs immediately so bars update visibly when the move is committed.
  if (ability.turnType === 'multi' && !s.multiTurnActive) {
    if ((ability.manaCost || 0) > s.mana)   return { newState: s, outgoing, message: 'Not enough mana', effectKey: 'fail' };
    if ((ability.ultCost  || 0) > s.ultBar) return { newState: s, outgoing, message: 'Not enough ult',  effectKey: 'fail' };
    s.mana   -= (ability.manaCost || 0);
    s.ultBar -= (ability.ultCost  || 0);
    s.multiTurnActive = { abilityKey: gesture, turnsLeft: ability.turnAmount - 1 };
    return { newState: s, outgoing, effectKey: 'multi_turn_start', message: `${ability.name} charging...` };
  }

  // ── Single-turn ──────────────────────────────────────────────────────────
  if ((ability.manaCost || 0) > s.mana) {
    message = 'Not enough mana';
    return { newState: s, outgoing, message, effectKey: 'fail' };
  }
  if ((ability.ultCost || 0) > s.ultBar) {
    message = 'Not enough ult';
    return { newState: s, outgoing, message, effectKey: 'fail' };
  }

  s.mana   -= (ability.manaCost || 0);
  s.ultBar -= (ability.ultCost  || 0);
  s.ultBar  = Math.min(s.maxUlt, s.ultBar + (ability.ultGain || 0));

  const result = ability.resolve({ caster: s });
  if (result.healSelf)    s.hp = Math.min(s.maxHp, s.hp + result.healSelf);
  if (result.nullifySelf) s.nullified = true;
  outgoing.damage      = result.damage      ?? 0;
  outgoing.stunTurns   = result.stunTurns   ?? 0;
  outgoing.noRestBonus = result.noRestBonus ?? false;
  outgoing.dot         = result.dot         ?? null;

  return { newState: s, outgoing, message: result.message ?? message };
}

/**
 * Applies incoming outgoing effects from the opponent to this player's state.
 * Called when the opponent's turn resolves.
 *
 * @param {object} state
 * @param {object} outgoing  - { damage, stunTurns, noRestBonus, dot }
 * @returns {object} newState
 */
export function applyIncoming(state, outgoing) {
  if (!outgoing) return state;
  // Nullify check: if player used IT this turn, skip all incoming
  if (state.nullified) return state;

  let s = { ...state };
  s.hp = Math.max(0, s.hp - (outgoing.damage || 0));
  if (outgoing.stunTurns) {
    s.stunTurnsRemaining = Math.max(s.stunTurnsRemaining, outgoing.stunTurns);
  }
  if (outgoing.dot) {
    s.dot = outgoing.dot;
  }
  return s;
}

const EMPTY_OUTGOING = { damage: 0, stunTurns: 0, noRestBonus: false, dot: null };

/**
 * Resolves both players' turns with speed/priority ordering.
 * The faster mover's outgoing applies first; if it kills or stuns the slower
 * mover, the slower mover's outgoing is suppressed this turn.
 *
 * @param {object} playerState
 * @param {string|null} playerGesture
 * @param {number} playerSpeed
 * @param {object} botState
 * @param {string|null} botGesture
 * @param {number} botSpeed
 * @returns {{ playerFinal, botFinal, effectKey, message, playerGoesFirst }}
 */
export function resolveOrderedTurns(
  playerState, playerGesture, playerSpeed,
  botState,    botGesture,    botSpeed
) {
  const playerPriority = ABILITIES[playerGesture]?.priority ?? 0;
  const botPriority    = ABILITIES[botGesture]?.priority    ?? 0;

  let playerGoesFirst;
  if      (playerPriority !== botPriority) playerGoesFirst = playerPriority > botPriority;
  else if (playerSpeed    !== botSpeed)    playerGoesFirst = playerSpeed    > botSpeed;
  else                                     playerGoesFirst = Math.random() < 0.5;

  // Both resolve independently (costs paid, self-effects applied)
  const { newState: playerResolved, outgoing: playerOut, effectKey, message } =
    resolveTurn(playerState, playerGesture);
  const { newState: botResolved, outgoing: botOut } =
    resolveTurn(botState, botGesture);

  // Apply first mover's outgoing, then check if second mover is suppressed
  function applyOrdered(first, firstOut, second, secondOut) {
    const secondHit = applyIncoming(second, firstOut);
    const secondDead    = secondHit.hp <= 0;
    const secondStunned = (firstOut.stunTurns ?? 0) > 0 && !second.nullified;
    const suppressed    = secondDead || secondStunned;

    // If stunned this turn, consume one stun turn so they aren't double-penalised
    let secondFinal = secondHit;
    if (secondStunned && secondFinal.stunTurnsRemaining > 0) {
      secondFinal = { ...secondFinal, stunTurnsRemaining: secondFinal.stunTurnsRemaining - 1 };
    }

    const firstFinal = applyIncoming(first, suppressed ? EMPTY_OUTGOING : secondOut);
    return { firstFinal, secondFinal };
  }

  let playerFinal, botFinal;
  if (playerGoesFirst) {
    const { firstFinal, secondFinal } = applyOrdered(playerResolved, playerOut, botResolved, botOut);
    playerFinal = firstFinal;
    botFinal    = secondFinal;
  } else {
    const { firstFinal, secondFinal } = applyOrdered(botResolved, botOut, playerResolved, playerOut);
    botFinal    = firstFinal;
    playerFinal = secondFinal;
  }

  return { playerFinal, botFinal, playerOut, botOut, effectKey, message, playerGoesFirst };
}
