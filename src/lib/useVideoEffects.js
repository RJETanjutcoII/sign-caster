'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getVideoEffect } from './effectHelper';

/**
 * Encapsulates all player-side video effect state and lifecycle.
 *
 * @param {object}   opts
 * @param {function} opts.setActiveBackground  - From useGestureEngine; drives the compositing pipeline
 * @param {{ abilityKey, turnsLeft } | null} opts.activeDomain - playerState.activeDomain
 */
export function useVideoEffects({ setActiveBackground, activeDomain }) {
  const [playerVideoEffect,      setPlayerVideoEffect]      = useState(null);
  const [activeBackground_local, setActiveBackground_local] = useState(null);
  const activeBgRef = useRef(null); // always-current mirror — avoids stale closures in useEffects

  // Both functions read only refs and stable setters — no deps needed.
  const applyVideoEffect = useCallback((gesture, isCaster, variant = 'normal') => {
    const effect = getVideoEffect(gesture, isCaster, variant) ?? null;
    setPlayerVideoEffect(effect);
    if (effect?.type === 'background') {
      activeBgRef.current = effect;
      setActiveBackground(effect);
      setActiveBackground_local(effect);
    }
  }, [setActiveBackground]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearVideoEffect = useCallback(() => {
    setPlayerVideoEffect(null);
    if (!activeBgRef.current?.loop) {
      activeBgRef.current = null;
      setActiveBackground(null);
      setActiveBackground_local(null);
    }
  }, [setActiveBackground]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear looping background when domain expires
  useEffect(() => {
    if (!activeDomain && activeBgRef.current?.loop) {
      activeBgRef.current = null;
      setActiveBackground(null);
      setActiveBackground_local(null);
    }
  }, [activeDomain, setActiveBackground]);

  return {
    playerVideoEffect,
    backgroundActive: !!activeBackground_local,
    applyVideoEffect,
    clearVideoEffect,
  };
}
