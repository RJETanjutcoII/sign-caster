import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  const body = await request.json();
  const { result, mode, opponentName, points, loadout } = body;

  const VALID_RESULTS = ['win', 'loss'];
  const VALID_MODES = ['bot', 'pvp', 'training'];
  if (!VALID_RESULTS.includes(result)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 });
  if (!VALID_MODES.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (typeof points !== 'object' || points === null || Array.isArray(points)) return NextResponse.json({ error: 'Invalid points' }, { status: 400 });
  if (opponentName !== undefined && opponentName !== null && typeof opponentName !== 'string') return NextResponse.json({ error: 'Invalid opponentName' }, { status: 400 });
  if (opponentName && opponentName.length > 32) return NextResponse.json({ error: 'opponentName too long' }, { status: 400 });

  await supabase.from('battle_history').insert({
    user_id:          user.id,
    result,
    mode,
    opponent_name:    opponentName ?? null,
    points_snapshot:  points,
    loadout_snapshot: loadout,
  });

  const col = result === 'win' ? 'wins' : 'losses';
  const { data: prof } = await supabase.from('profiles').select(col).eq('id', user.id).single();
  await supabase.from('profiles')
    .update({ [col]: (prof?.[col] ?? 0) + 1 })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
