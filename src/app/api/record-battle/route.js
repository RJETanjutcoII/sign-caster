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

  const { result, mode, opponentName, points, loadout } = await request.json();

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
