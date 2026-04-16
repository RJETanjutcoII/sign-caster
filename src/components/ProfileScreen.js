'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ABILITIES } from '@/lib/abilities';

export default function ProfileScreen({ profile, onBack, onSignOut, onChangeSetup }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('battle_history')
      .select('id,result,mode,opponent_name,loadout_snapshot,played_at')
      .eq('user_id', profile.id)
      .order('played_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory(data ?? []));
  }, [profile?.id]);

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function abilityNames(loadout) {
    if (!Array.isArray(loadout)) return '';
    return loadout
      .map(k => ABILITIES[k]?.name ?? k)
      .join(', ');
  }

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <div>
          <h1 className="profile-username">{profile?.username ?? '—'}</h1>
          <div className="profile-record">
            <span className="profile-wins">{profile?.wins ?? 0}W</span>
            <span className="profile-sep"> / </span>
            <span className="profile-losses">{profile?.losses ?? 0}L</span>
          </div>
        </div>
        <div className="profile-header-btns">
          <button className="profile-action-btn" onClick={onChangeSetup}>Change Setup</button>
          <button className="profile-action-btn profile-action-btn--danger" onClick={onSignOut}>Sign Out</button>
        </div>
      </div>

      <h2 className="profile-section-title">Recent Battles</h2>

      {history === null && <p className="profile-loading">Loading…</p>}
      {history?.length === 0 && <p className="profile-empty">No battles yet. Get out there!</p>}

      {history && history.length > 0 && (
        <div className="profile-history">
          {history.map(row => (
            <div key={row.id} className={`profile-history-row profile-history-row--${row.result}`}>
              <span className={`profile-result-badge profile-result-badge--${row.result}`}>
                {row.result === 'win' ? 'WIN' : 'LOSS'}
              </span>
              <div className="profile-history-info">
                <span className="profile-history-mode">
                  {row.mode === 'pvp' ? `vs ${row.opponent_name ?? 'Unknown'}` : 'vs Bot'}
                </span>
                <span className="profile-history-loadout">{abilityNames(row.loadout_snapshot)}</span>
              </div>
              <span className="profile-history-date">{formatDate(row.played_at)}</span>
            </div>
          ))}
        </div>
      )}

      <button className="statbuilder-back-btn" style={{ marginTop: '2rem' }} onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
