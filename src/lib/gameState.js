import { ABILITIES } from './abilities';

/**
 * Creates a fresh player state from a build configuration.
 * @param {{ hp?, atk?, def?, spd?, mp? }} build
 */
export function makeState({ hp = 120, atk = 0, def = 0, spd = 1, mp = 20 } = {}) {
  return {
    hp, maxHp: hp,
    mana: mp, maxMana: mp,
    ultBar: 0, maxUlt: 5,
    atk, def, spd,
    stunTurnsRemaining: 0,
    dot: null,               // { damage, turnsRemaining }
    multiTurnActive: null,   // { abilityKey, turnsLeft }
    activeDomain: null,      // { abilityKey, turnsLeft }
    nullified: false,        // incoming attacks negated this turn (IT)
    speedMod: 0,             // net speed modifier: positive = faster, negative = slower
    tempAtk: null,           // { delta, turnsLeft } — temporary ATK buff/debuff
    tempDef: null,           // { delta, turnsLeft } — temporary DEF buff/debuff
  };
}

export const INITIAL_STATE = makeState();

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the early-exit failure result if the ability costs can't be met,
 * or null if the player can afford it.
 */
function checkCosts(s, ability, outgoing) {
  if ((ability.manaCost || 0) > s.mana)   return { newState: s, outgoing, message: 'Not enough mana', effectKey: 'fail' };
  if ((ability.ultCost  || 0) > s.ultBar) return { newState: s, outgoing, message: 'Not enough ult',  effectKey: 'fail' };
  return null;
}

/**
 * Returns `damage` scaled by the caster's effective ATK stat, or 0 if damage is falsy.
 */
function withAtk(damage, state) {
  if (!damage) return 0;
  return damage + (state.atk || 0) + (state.tempAtk?.delta ?? 0);
}

/**
 * Activates a domain on the caster's state.
 * Deducts costs, sets activeDomain, and computes initial outgoing effects
 * from ability.resolve(). Cost sufficiency must be pre-checked by the caller.
 *
 * @param {object} casterState
 * @param {string} abilityKey
 * @returns {{ newCasterState: object, outgoing: object }}
 */
export function applyDomain(casterState, abilityKey) {
  const ability = ABILITIES[abilityKey];
  if (!ability) return { newCasterState: casterState, outgoing: { damage: 0, stunTurns: 0, noRestBonus: false, dot: null, undodgeable: false } };

  let s = { ...casterState };
  s.mana   -= (ability.manaCost || 0);
  s.ultBar -= (ability.ultCost  || 0);
  s.ultBar  = Math.min(s.maxUlt, s.ultBar + (ability.ultGain || 0));
  s.activeDomain = { abilityKey, turnsLeft: ability.turnAmount };

  const outgoing = { damage: 0, stunTurns: 0, noRestBonus: false, dot: null, undodgeable: ability.undodgeable ?? false };
  if (ability.resolve) {
    const result = ability.resolve({ caster: s });
    outgoing.damage    = withAtk(result.damage ?? 0, s);
    outgoing.stunTurns = result.stunTurns ?? 0;
    outgoing.dot       = result.dot ?? null;
  }

  return { newCasterState: s, outgoing };
}

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

  // Tick temporary ATK/DEF modifiers
  if (s.tempAtk) s.tempAtk = s.tempAtk.turnsLeft <= 1 ? null : { ...s.tempAtk, turnsLeft: s.tempAtk.turnsLeft - 1 };
  if (s.tempDef) s.tempDef = s.tempDef.turnsLeft <= 1 ? null : { ...s.tempDef, turnsLeft: s.tempDef.turnsLeft - 1 };

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
  const outgoing = { damage: 0, stunTurns: 0, noRestBonus: false, dot: null, undodgeable: false };
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
    const fail = checkCosts(s, ability, outgoing);
    if (fail) return fail;
    const { newCasterState, outgoing: domainOut } = applyDomain(s, gesture);
    return { newState: newCasterState, outgoing: domainOut, effectKey: 'domain_start', message: `${ability.name} activated!` };
  }

  // ── Multi-turn: continuation / final turn ────────────────────────────────
  // Costs already paid on first cast; just resolve.
  if (ability.turnType === 'multi' && s.multiTurnActive?.abilityKey === gesture) {
    s.ultBar = Math.min(s.maxUlt, s.ultBar + (ability.ultGain || 0));
    s.multiTurnActive = null;

    const result = ability.resolve({ caster: s });
    if (result.healSelf)    s.hp = Math.min(s.maxHp, s.hp + result.healSelf);
    if (result.nullifySelf) s.nullified = true;
    if (result.atkBuff)     s.tempAtk = result.atkBuff;
    if (result.defBuff)     s.tempDef = result.defBuff;
    outgoing.damage      = withAtk(result.damage ?? 0, s);
    outgoing.stunTurns   = result.stunTurns   ?? 0;
    outgoing.noRestBonus = result.noRestBonus ?? false;
    outgoing.dot         = result.dot         ?? null;
    if (result.atkDebuff) outgoing.atkDebuff = result.atkDebuff;
    if (result.defDebuff) outgoing.defDebuff = result.defDebuff;
    return { newState: s, outgoing, effectKey: 'multi_turn_final' };
  }

  // ── Multi-turn: first cast ───────────────────────────────────────────────
  // Pay costs immediately so bars update visibly when the move is committed.
  if (ability.turnType === 'multi' && !s.multiTurnActive) {
    const fail = checkCosts(s, ability, outgoing);
    if (fail) return fail;
    s.mana   -= (ability.manaCost || 0);
    s.ultBar -= (ability.ultCost  || 0);
    s.multiTurnActive = { abilityKey: gesture, turnsLeft: ability.turnAmount - 1 };
    return { newState: s, outgoing, effectKey: 'multi_turn_start', message: `${ability.name} charging...` };
  }

  // ── Single-turn ──────────────────────────────────────────────────────────
  const fail = checkCosts(s, ability, outgoing);
  if (fail) return fail;

  s.mana   -= (ability.manaCost || 0);
  s.ultBar -= (ability.ultCost  || 0);
  s.ultBar  = Math.min(s.maxUlt, s.ultBar + (ability.ultGain || 0));

  const result = ability.resolve({ caster: s });
  if (result.healSelf)    s.hp = Math.min(s.maxHp, s.hp + result.healSelf);
  if (result.nullifySelf) s.nullified = true;
  if (result.speedBoost)  s.speedMod = (s.speedMod || 0) + result.speedBoost;
  if (result.atkBuff)     s.tempAtk = result.atkBuff;
  if (result.defBuff)     s.tempDef = result.defBuff;
  outgoing.damage      = withAtk(result.damage ?? 0, s);
  outgoing.stunTurns   = result.stunTurns   ?? 0;
  outgoing.noRestBonus = result.noRestBonus ?? false;
  outgoing.dot         = result.dot         ?? null;
  outgoing.undodgeable = ability.undodgeable ?? false;
  if (result.atkDebuff) outgoing.atkDebuff = result.atkDebuff;
  if (result.defDebuff) outgoing.defDebuff = result.defDebuff;

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
  // Nullify check: if player used IT this turn, skip all incoming (unless undodgeable)
  if (state.nullified && !outgoing.undodgeable) return state;

  let s = { ...state };
  const rawDamage    = outgoing.damage || 0;
  const effectiveDef = (s.def || 0) + (s.tempDef?.delta ?? 0);
  const reduced      = rawDamage > 0 ? Math.max(1, rawDamage - effectiveDef) : 0;
  s.hp = Math.max(0, s.hp - reduced);
  if (outgoing.stunTurns) {
    s.stunTurnsRemaining = Math.max(s.stunTurnsRemaining, outgoing.stunTurns);
  }
  if (outgoing.dot) {
    s.dot = outgoing.dot;
  }
  if (outgoing.speedReduction) {
    s.speedMod = (s.speedMod || 0) - outgoing.speedReduction;
  }
  if (outgoing.atkDebuff) {
    s.tempAtk = { delta: -(outgoing.atkDebuff.amount), turnsLeft: outgoing.atkDebuff.turns };
  }
  if (outgoing.defDebuff) {
    s.tempDef = { delta: -(outgoing.defDebuff.amount), turnsLeft: outgoing.defDebuff.turns };
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
  botState,    botGesture,    botSpeed,
  coinFlip = Math.random() < 0.5
) {
  // Stunned movers always go last (priority -1)
  const playerPriority = playerGesture === 'stunned' ? -1 : (ABILITIES[playerGesture]?.priority ?? 0);
  const botPriority    = botGesture    === 'stunned' ? -1 : (ABILITIES[botGesture]?.priority    ?? 0);

  let playerGoesFirst;
  if      (playerPriority !== botPriority) playerGoesFirst = playerPriority > botPriority;
  else if (playerSpeed    !== botSpeed)    playerGoesFirst = playerSpeed    > botSpeed;
  else                                     playerGoesFirst = coinFlip;

  // Both resolve independently (costs paid, self-effects applied)
  const { newState: playerResolved, outgoing: playerOut, effectKey: pEK, message: pMsg } =
    resolveTurn(playerState, playerGesture);
  const { newState: botResolved, outgoing: botOut, effectKey: bEK, message: bMsg } =
    resolveTurn(botState, botGesture);

  // Map to first / second mover
  const [firstResolved, firstOut, firstEK, firstMsg, fGesture,
         secondResolved, secondOut, secondEK, secondMsg, sGesture] =
    playerGoesFirst
      ? [playerResolved, playerOut, pEK, pMsg, playerGesture,
         botResolved,    botOut,    bEK, bMsg, botGesture]
      : [botResolved,    botOut,    bEK, bMsg, botGesture,
         playerResolved, playerOut, pEK, pMsg, playerGesture];

  // Original (pre-resolution) state of the second mover
  const secondOrigState = playerGoesFirst ? botState : playerState;

  // Apply first mover's outgoing to second mover
  const secondHit     = applyIncoming(secondResolved, firstOut);
  const secondDead    = secondHit.hp <= 0;
  const secondStunned = (firstOut.stunTurns ?? 0) > 0 && !secondResolved.nullified;
  const suppressed    = secondDead || secondStunned;

  // If stunned: discard the second mover's resolution entirely (refund costs) and
  // apply the hit to their original state instead. No mana/ult spent for a cancelled move.
  let secondFinal = secondStunned
    ? applyIncoming(secondOrigState, firstOut)
    : secondHit;

  // Consume one stun turn to avoid double-penalising on the next SOT
  if (secondStunned && secondFinal.stunTurnsRemaining > 0) {
    secondFinal = { ...secondFinal, stunTurnsRemaining: secondFinal.stunTurnsRemaining - 1 };
  }

  // Compensate: second mover activated a domain with immediate outgoing effects
  // but couldn't benefit this turn (first mover already acted). Add 1 turn.
  if (
    !suppressed &&
    secondFinal.activeDomain?.abilityKey === sGesture &&
    (secondOut.damage > 0 || secondOut.dot != null)
  ) {
    secondFinal = {
      ...secondFinal,
      activeDomain: { ...secondFinal.activeDomain, turnsLeft: secondFinal.activeDomain.turnsLeft + 1 },
    };
  }

  // Apply second mover's outgoing to first mover (empty if suppressed)
  const firstFinal = applyIncoming(firstResolved, suppressed ? EMPTY_OUTGOING : secondOut);

  // Map back to player / bot
  const [playerFinal, botFinal] = playerGoesFirst
    ? [firstFinal,  secondFinal]
    : [secondFinal, firstFinal];

  // Intermediate states for staged display: first mover has acted (resources spent),
  // second mover has only taken HP damage — their resources are NOT deducted yet
  // so their mana/ult bars stay intact until their own phase.
  const secondDisplayHit = applyIncoming(secondOrigState, firstOut);
  const [playerIntermediate, botIntermediate] = playerGoesFirst
    ? [firstResolved,    secondDisplayHit]
    : [secondDisplayHit, firstResolved];

  // Second mover display — override effectKey/message if suppressed
  const secondEffectKey = suppressed && !secondDead ? 'stunned' : secondEK;
  const secondMessage   = suppressed && !secondDead ? 'Stunned! Cannot move!' : secondMsg;

  return {
    playerFinal, botFinal,
    playerOut, botOut,
    playerGoesFirst,
    firstMoverIsPlayer: playerGoesFirst,
    // Phase 1 (first mover)
    firstEffectKey: firstEK,
    firstMessage:   firstMsg,
    firstGesture:   fGesture,
    // Phase 2 (second mover)
    secondEffectKey,
    secondMessage,
    secondGesture: sGesture,
    secondSuppressed: suppressed,
    // Intermediate states for staged HP display
    playerIntermediate,
    botIntermediate,
    // Legacy compat
    effectKey: firstEK,
    message:   firstMsg,
  };
}
