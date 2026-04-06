'use client';

export default function StatsHUD({ state }) {
  if (!state) return null;

  const { hp, maxHp, mana, maxMana, ultBar, maxUlt,
          atk, def, spd,
          stunTurnsRemaining, dot, multiTurnActive, activeDomain, nullified,
          speedMod, tempAtk, tempDef } = state;

  const hpPct  = (hp   / maxHp)   * 100;
  const mpPct  = (mana / maxMana) * 100;
  const ultPct = (ultBar / maxUlt) * 100;

  const effectiveSpd = Math.max(0, (spd || 1) + (speedMod || 0));
  const effectiveAtk = (atk || 0) + (tempAtk?.delta ?? 0);
  const effectiveDef = (def || 0) + (tempDef?.delta ?? 0);

  const statuses = [];
  if (stunTurnsRemaining > 0) statuses.push(`STUNNED (${stunTurnsRemaining})`);
  if (dot)                    statuses.push(`BURNING ${dot.damage}/turn (${dot.turnsRemaining})`);
  if (multiTurnActive)        statuses.push('CHARGING...');
  if (activeDomain)           statuses.push(`DOMAIN (${activeDomain.turnsLeft})`);
  if (nullified)              statuses.push('NULLIFIED');

  return (
    <div className="stats-hud">
      <div className="stats-row">
        <span className="stats-label">HP</span>
        <div className="stats-track">
          <div className="stats-fill stats-fill--hp" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="stats-value">{hp}/{maxHp}</span>
      </div>

      <div className="stats-row">
        <span className="stats-label">MP</span>
        <div className="stats-track">
          <div className="stats-fill stats-fill--mp" style={{ width: `${mpPct}%` }} />
        </div>
        <span className="stats-value">{mana}/{maxMana}</span>
      </div>

      <div className="stats-row">
        <span className="stats-label">ULT</span>
        <div className="stats-track">
          <div className="stats-fill stats-fill--ult" style={{ width: `${ultPct}%` }} />
        </div>
        <span className="stats-value">{ultBar}/{maxUlt}</span>
      </div>

      <div className="stats-row">
        <span className="stats-label">SPD</span>
        <span className="stats-value stats-value--spd">{effectiveSpd}</span>
      </div>

      {effectiveAtk > 0 && (
        <div className="stats-row">
          <span className="stats-label">ATK</span>
          <span className="stats-value" style={{ color: tempAtk?.delta > 0 ? '#7f7' : tempAtk?.delta < 0 ? '#f77' : undefined }}>
            +{effectiveAtk}
          </span>
        </div>
      )}

      {effectiveDef > 0 && (
        <div className="stats-row">
          <span className="stats-label">DEF</span>
          <span className="stats-value" style={{ color: tempDef?.delta > 0 ? '#7f7' : tempDef?.delta < 0 ? '#f77' : undefined }}>
            -{effectiveDef}
          </span>
        </div>
      )}

      {statuses.length > 0 && (
        <div className="stats-statuses">
          {statuses.map(s => <span key={s} className="stats-status">{s}</span>)}
        </div>
      )}
    </div>
  );
}
