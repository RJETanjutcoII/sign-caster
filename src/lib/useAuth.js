'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

export function useAuth() {
  const [user,        setUser]        = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [savedConfig, setSavedConfig] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Track whether we've already fetched profile for the current user
  const fetchedForRef = useRef(null);

  async function fetchProfileAndConfig(userId) {
    if (fetchedForRef.current === userId) return;
    fetchedForRef.current = userId;

    const [{ data: prof }, { data: cfg }] = await Promise.all([
      supabase.from('profiles').select('id,username,wins,losses').eq('id', userId).single(),
      supabase.from('saved_configs').select('points,loadout').eq('user_id', userId).single(),
    ]);

    setProfile(prof ?? null);
    setSavedConfig(cfg ?? null);
  }

  useEffect(() => {
    // Restore any existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfileAndConfig(u.id).finally(() => setAuthLoading(false));
      else    setAuthLoading(false);
    });

    // Listen for auth state changes (handles OAuth redirect callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchedForRef.current = null; // force re-fetch after sign-in
        fetchProfileAndConfig(u.id).finally(() => setAuthLoading(false));
      } else {
        setProfile(null);
        setSavedConfig(null);
        fetchedForRef.current = null;
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  function signInWithGoogle() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function setUsername(name) {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .update({ username: name })
      .eq('id', user.id)
      .select('id,username,wins,losses')
      .single();
    if (data) setProfile(data);
  }

  async function saveConfig(points, loadout) {
    if (!user) return;
    const { data } = await supabase
      .from('saved_configs')
      .upsert({ user_id: user.id, points, loadout, updated_at: new Date().toISOString() })
      .select('points,loadout')
      .single();
    if (data) setSavedConfig(data);
  }

  function recordBattleResult(result, mode, opponentName, points, loadout, resultToken) {
    if (!user) return;
    fetch('/api/record-battle', {
      method:    'POST',
      keepalive: true,
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify({ result, mode, opponentName, points, loadout, resultToken }),
    }).then(res => {
      if (!res.ok) console.error('record-battle failed:', res.status);
    }).catch(err => {
      console.error('record-battle network error:', err);
    });
    const col = result === 'win' ? 'wins' : 'losses';
    setProfile(prev => prev ? { ...prev, [col]: (prev[col] ?? 0) + 1 } : prev);
  }

  return {
    user,
    profile,
    savedConfig,
    authLoading,
    signInWithGoogle,
    signOut,
    setUsername,
    saveConfig,
    recordBattleResult,
    getAccessToken,
  };
}
