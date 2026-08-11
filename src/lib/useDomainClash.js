'use client';

import { useState, useRef, useEffect } from 'react';
import { resolveDomainClashOutcome } from './gameState';

import { Effect as DomainBreakEffect } from './effects/domain_break';

const DUEL_POOL = ['fist', 'finger_gun', 'thumbs_up', 'kamehameha', 'web_shot', 'double_v'];

function getDuelPrompt(seed, round) {
  return DUEL_POOL[Math.abs((seed * 31 + round * 17) % DUEL_POOL.length)];
}

/**
 * Manages the 4-phase domain clash sequence for both PvP and PvB modes.
 *
 * @param {object} opts
 * @param {string}   opts.gamePhase
 * @param {function} opts.setGamePhase
 * @param {Ref}      opts.playerStateRef
 * @param {Ref}      opts.opponentStateRef
 * @param {function} opts.setPlayerState
 * @param {function} opts.setOpponentState
 * @param {function} opts.setActiveEffect
 * @param {Ref}      opts.applyVideoEffectRef   — stable ref to applyVideoEffect
 * @param {Ref}      opts.clearVideoEffectRef   — stable ref to clearVideoEffect
 * @param {Ref}      opts.duelTargetGestureRef  — pre-created ref owned by canvas; hook writes to it
 * @param {Ref}      opts.handleDuelResultRef   — pre-created ref owned by canvas; hook writes to it
 * @param {'pvp'|'pvb'} opts.mode
 * @param {object}   [opts.mp]       — useMultiplayer instance (pvp only)
 * @param {string}   [opts.playerId] — 'p1'|'p2' (pvp only)
 *
 * @returns {{
 *   clashPlayerDomainRef, clashOppDomainRef,
 *   initClash,
 *   clashScores, clashRound, clashWinner, clashPromptGesture,
 * }}
 */
export function useDomainClash({
  gamePhase,
  setGamePhase,
  playerStateRef,
  opponentStateRef,
  setPlayerState,
  setOpponentState,
  setActiveEffect,
  applyVideoEffectRef,
  clearVideoEffectRef,
  duelTargetGestureRef,  // pre-created by canvas, also passed to useGestureEngine
  handleDuelResultRef,   // pre-created by canvas, called by onDuelConfirm
  mode,
  mp,
  playerId,
}) {
  const clashPlayerDomainRef = useRef(null);
  const clashOppDomainRef    = useRef(null);
  const clashSeedRef         = useRef(null);
  const botDuelTimerRef      = useRef(null);

  const [clashScores,        setClashScores]        = useState({ player: 0, opponent: 0 });
  const [clashRound,         setClashRound]         = useState(1);
  const [clashWinner,        setClashWinner]        = useState(null);
  const [clashPromptGesture, setClashPromptGesture] = useState(null);

  // ── initClash — called from canvas resolution logic when clash is detected ─
  function initClash(playerDomain, oppDomain, seed) {
    clashPlayerDomainRef.current = playerDomain;
    clashOppDomainRef.current    = oppDomain;
    clashSeedRef.current         = seed;
    setClashScores({ player: 0, opponent: 0 });
    setClashRound(1);
    setClashWinner(null);
    const prompt = getDuelPrompt(seed, 1);
    duelTargetGestureRef.current = prompt;
    setClashPromptGesture(prompt);
    setGamePhase('clash_resolve_entry');
  }

  // ── Phase A: clash_resolve_entry (5 000 ms) ───────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'clash_resolve_entry') return;
    applyVideoEffectRef.current(clashPlayerDomainRef.current, true, 'entry');
    const tid = setTimeout(() => setGamePhase('clash_resolve_duel'), 5000);
    return () => clearTimeout(tid);
  }, [gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase B: clash_resolve_duel (interactive best-of-5) ──────────────────
  useEffect(() => {
    if (gamePhase !== 'clash_resolve_duel') return;
    applyVideoEffectRef.current(clashPlayerDomainRef.current, true);

    let scores = { player: 0, opponent: 0 };
    let round  = 1;

    function advanceOrFinish(winner) {
      clearTimeout(botDuelTimerRef.current);
      botDuelTimerRef.current = null;
      scores = {
        player:   scores.player   + (winner === 'player'   ? 1 : 0),
        opponent: scores.opponent + (winner === 'opponent' ? 1 : 0),
      };
      setClashScores({ ...scores });

      if (scores.player >= 3 || scores.opponent >= 3) {
        setClashWinner(scores.player >= 3 ? 'player' : 'opponent');
        duelTargetGestureRef.current = null;
        handleDuelResultRef.current  = null;
        setClashPromptGesture(null);
        setGamePhase('clash_resolve_break');
        return;
      }

      round += 1;
      setClashRound(round);
      const prompt = getDuelPrompt(clashSeedRef.current, round);
      duelTargetGestureRef.current = prompt;
      setClashPromptGesture(prompt);

      if (mode === 'pvb') {
        handleDuelResultRef.current = () => { clearTimeout(botDuelTimerRef.current); advanceOrFinish('player'); };
        scheduleBotResponse();
      } else {
        // pvp: update ref so onDuelConfirm emits for the new round
        handleDuelResultRef.current = () => mp.emitClashGesture(round);
      }
    }

    function scheduleBotResponse() {
      botDuelTimerRef.current = setTimeout(
        () => advanceOrFinish('opponent'),
        800 + Math.random() * 1700
      );
    }

    if (mode === 'pvb') {
      handleDuelResultRef.current = () => { clearTimeout(botDuelTimerRef.current); advanceOrFinish('player'); };
      scheduleBotResponse();
    } else {
      handleDuelResultRef.current = () => mp.emitClashGesture(round);
      mp.setOnClashResult((msg) => {
        const validIds = ['p1', 'p2'];
        if (!validIds.includes(msg.winner)) return;
        advanceOrFinish(msg.winner === playerId ? 'player' : 'opponent');
      });
    }

    return () => {
      if (mode === 'pvb') clearTimeout(botDuelTimerRef.current);
      else mp?.setOnClashResult(null);
    };
  }, [gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase C: clash_resolve_break (500 ms) ─────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'clash_resolve_break') return;
    setActiveEffect(() => DomainBreakEffect);
    const tid = setTimeout(() => {
      setActiveEffect(null);
      setGamePhase('clash_resolve_exit');
    }, 500);
    return () => clearTimeout(tid);
  }, [gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase D: clash_resolve_exit ───────────────────────────────────────────
  // pvb still computes the outcome locally. pvp consumes the outcome the
  // relay already computed (via resolveDomainClashOutcome server-side, from
  // its own authoritative clash-round tally) instead of recomputing it —
  // same reasoning as normal turn resolution: the relay decides, the client
  // renders.
  useEffect(() => {
    if (gamePhase !== 'clash_resolve_exit') return;

    const playerWon = clashWinner === 'player';
    if (playerWon) {
      applyVideoEffectRef.current(clashPlayerDomainRef.current, true);
    } else {
      applyVideoEffectRef.current(clashOppDomainRef.current, false);
    }

    function finish(newPlayerState, newOppState) {
      playerStateRef.current   = newPlayerState;
      opponentStateRef.current = newOppState;
      setPlayerState(newPlayerState);
      setOpponentState(newOppState);
      if (!playerWon) clearVideoEffectRef.current();

      clashPlayerDomainRef.current = null;
      clashOppDomainRef.current    = null;
      clashSeedRef.current         = null;
      setGamePhase('selecting');
    }

    if (mode === 'pvp') {
      const oppId = playerId === 'p1' ? 'p2' : 'p1';
      function consume(msg) { finish(msg[playerId], msg[oppId]); }

      const already = mp.clashResolvedRef.current;
      if (already) {
        mp.clashResolvedRef.current = null;
        consume(already);
        return;
      }
      mp.setOnClashResolved(() => {
        const msg = mp.clashResolvedRef.current;
        mp.clashResolvedRef.current = null;
        mp.setOnClashResolved(null);
        consume(msg);
      });
      return () => mp.setOnClashResolved(null);
    }

    // ── pvb: unchanged local computation ────────────────────────────────────
    const winnerKey = playerWon ? clashPlayerDomainRef.current : clashOppDomainRef.current;
    const tid = setTimeout(() => {
      const winnerState = playerWon ? playerStateRef.current : opponentStateRef.current;
      const loserState  = playerWon ? opponentStateRef.current : playerStateRef.current;
      const loserKey    = playerWon ? clashOppDomainRef.current : clashPlayerDomainRef.current;

      const { newWinnerState, newLoserState } =
        resolveDomainClashOutcome(winnerState, winnerKey, loserState, loserKey);

      finish(
        playerWon ? newWinnerState : newLoserState,
        playerWon ? newLoserState  : newWinnerState,
      );
    }, 5000);

    return () => clearTimeout(tid);
  }, [gamePhase, clashWinner]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    clashPlayerDomainRef,
    clashOppDomainRef,
    initClash,
    clashScores,
    clashRound,
    clashWinner,
    clashPromptGesture,
  };
}
