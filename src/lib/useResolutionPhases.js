'use client';

import { useEffect } from 'react';
import { getEffectComponent, buildLabel } from './effectHelper';

const RESOLVE_SUB_S = 2;

/**
 * Owns the resolving_first → resolving_second → selecting phase transitions.
 * Shared by BotCanvas (pvb) and PvPCanvas (pvp) — the only difference is the
 * opponent label string ('BOT' vs 'OPP').
 *
 * @param {object} opts
 * @param {string}   opts.gamePhase
 * @param {boolean}  opts.gameOver
 * @param {Ref}      opts.pendingResolutionRef
 * @param {Ref}      opts.playerStateRef
 * @param {Ref}      opts.opponentStateRef
 * @param {function} opts.setPlayerState
 * @param {function} opts.setOpponentState
 * @param {function} opts.setGameOver
 * @param {function} opts.setGamePhase
 * @param {function} opts.setResolveMessage
 * @param {function} opts.setActiveEffect
 * @param {Ref}      opts.applyVideoEffectRef
 * @param {Ref}      opts.clearVideoEffectRef
 * @param {string}   opts.opponentLabel  — 'BOT' | 'OPP'
 */
export function useResolutionPhases({
  gamePhase,
  gameOver,
  pendingResolutionRef,
  playerStateRef,
  opponentStateRef,
  setPlayerState,
  setOpponentState,
  setGameOver,
  setGamePhase,
  setResolveMessage,
  setActiveEffect,
  applyVideoEffectRef,
  clearVideoEffectRef,
  opponentLabel,
}) {
  // ── resolving_first → resolving_second ──────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_first') return;

    const timeout = setTimeout(() => {
      const r = pendingResolutionRef.current;

      playerStateRef.current   = r.playerFinal;
      opponentStateRef.current = r.botFinal;
      setPlayerState(r.playerFinal);
      setOpponentState(r.botFinal);

      const go = r.gameOverResult ??
        (r.playerFinal.hp <= 0 ? 'loss' : r.botFinal.hp <= 0 ? 'win' : null);
      if (go) setGameOver(go);

      setResolveMessage(buildLabel(!r.firstMoverIsPlayer ? 'YOU' : opponentLabel, r.secondGesture, r.secondMessage));
      const secondEffect = getEffectComponent(r.secondEffectKey, r.secondGesture);
      setActiveEffect(!r.firstMoverIsPlayer && secondEffect ? () => secondEffect : null);
      applyVideoEffectRef.current(r.secondGesture, !r.firstMoverIsPlayer);
      setGamePhase('resolving_second');
    }, RESOLVE_SUB_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── resolving_second → selecting ────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'resolving_second') return;

    const timeout = setTimeout(() => {
      setActiveEffect(null);
      clearVideoEffectRef.current();
      if (!gameOver) setGamePhase('selecting');
    }, RESOLVE_SUB_S * 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps
}
