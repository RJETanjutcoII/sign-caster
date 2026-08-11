import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { sanitizeLoadout } from '@/lib/abilityWhitelist';

// Point allocations (0-5 per stat, see StatBuilder.js's MAX_PER_STAT) — a
// different domain from the *build* bounds in abilityWhitelist.js (which
// clamp final derived stats like hp/atk), so this stays local rather than
// getting folded into that shared module.
const POINT_BOUNDS = { hp: [0, 5], atk: [0, 5], def: [0, 5], spd: [0, 5], mp: [0, 5] };

function sanitizePoints(points) {
  return Object.fromEntries(
    Object.entries(POINT_BOUNDS).map(([key, [min, max]]) => {
      const v = Number(points?.[key]);
      return [key, Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min];
    })
  );
}

// Soft, in-memory per-user cooldown — a real match takes far longer than
// this, so it catches scripted spam without needing external storage.
// Resets on cold start / doesn't coordinate across regions; a durable
// version would move this to Upstash Redis or Vercel KV if abuse shows up.
const RECORD_COOLDOWN_MS = 10_000;
const lastRecordedAt = new Map(); // user.id → timestamp

// PvP results are verified via a short-lived token the WS relay signs once
// it independently simulates a match to completion (see server/index.mjs) —
// the relay is the one source of truth for who actually won a PvP match,
// this endpoint no longer trusts the client's own claimed `result` for pvp.
const redeemedTokens = new Map(); // `${matchId}:${userId}` -> exp, single-use guard against replay

setInterval(() => {
  const now = Date.now();
  for (const [key, exp] of redeemedTokens) {
    if (now > exp) redeemedTokens.delete(key);
  }
}, 60_000);

function verifyResultToken(token) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = crypto.createHmac('sha256', process.env.BATTLE_RESULT_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

export async function POST(request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lastAt = lastRecordedAt.get(user.id);
  if (lastAt && Date.now() - lastAt < RECORD_COOLDOWN_MS) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json();
  const { result, mode, opponentName, points, loadout, resultToken } = body;

  const VALID_RESULTS = ['win', 'loss'];
  const VALID_MODES = ['bot', 'pvp', 'training'];
  if (!VALID_RESULTS.includes(result)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 });
  if (!VALID_MODES.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (typeof points !== 'object' || points === null || Array.isArray(points)) return NextResponse.json({ error: 'Invalid points' }, { status: 400 });
  if (opponentName !== undefined && opponentName !== null && typeof opponentName !== 'string') return NextResponse.json({ error: 'Invalid opponentName' }, { status: 400 });
  if (opponentName && opponentName.length > 32) return NextResponse.json({ error: 'opponentName too long' }, { status: 400 });

  // PvP is never trusted on the client's say-so — the relay must have
  // independently simulated the match and signed a matching result token.
  if (mode === 'pvp') {
    const payload = verifyResultToken(resultToken);
    if (!payload || payload.userId !== user.id || payload.result !== result || payload.mode !== 'pvp') {
      return NextResponse.json({ error: 'Unverified PvP result' }, { status: 403 });
    }
    const redeemKey = `${payload.matchId}:${payload.userId}`;
    if (redeemedTokens.has(redeemKey)) {
      return NextResponse.json({ error: 'Result already recorded' }, { status: 409 });
    }
    redeemedTokens.set(redeemKey, payload.exp);
  }

  lastRecordedAt.set(user.id, Date.now());

  await supabase.from('battle_history').insert({
    user_id:          user.id,
    result,
    mode,
    opponent_name:    opponentName ?? null,
    points_snapshot:  sanitizePoints(points),
    loadout_snapshot: sanitizeLoadout(loadout),
  });

  const rpcName = result === 'win' ? 'increment_wins' : 'increment_losses';
  const { error: rpcError } = await supabase.rpc(rpcName, { p_user_id: user.id });
  if (rpcError) console.error('Failed to increment profile stat:', rpcError);

  return NextResponse.json({ ok: true });
}
