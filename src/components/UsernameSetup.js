'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function UsernameSetup({ onConfirm }) {
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const trimmed = name.trim();
  const valid   = trimmed.length >= 3 && trimmed.length <= 20 && /^[a-zA-Z0-9_]+$/.test(trimmed);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid || loading) return;

    setLoading(true);
    setError(null);

    // Check uniqueness
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .maybeSingle();

    if (data) {
      setError('Username is already taken.');
      setLoading(false);
      return;
    }

    await onConfirm(trimmed);
    setLoading(false);
  }

  return (
    <div className="username-setup-screen">
      <h1 className="auth-title">SIGN CASTER</h1>
      <p className="username-setup-lead">Choose your display name</p>
      <form className="username-setup-form" onSubmit={handleSubmit}>
        <input
          className="username-setup-input"
          type="text"
          placeholder="e.g. ShadowCaster"
          value={name}
          maxLength={20}
          onChange={e => { setName(e.target.value); setError(null); }}
          autoFocus
        />
        <p className="username-setup-hint">3–20 characters · letters, numbers, underscores</p>
        {error && <p className="username-setup-error">{error}</p>}
        <button
          className="auth-google-btn"
          type="submit"
          disabled={!valid || loading}
          style={{ marginTop: '1rem' }}
        >
          {loading ? 'Checking…' : 'Confirm'}
        </button>
      </form>
    </div>
  );
}
