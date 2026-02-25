import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const minCount = parseInt(searchParams.get('min_count') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const search = searchParams.get('search');

  let query = supabaseAdmin
    .from('sender_history')
    .select('*', { count: 'exact' })
    .gte('match_count', minCount)
    .order('match_count', { ascending: false })
    .limit(limit);

  if (search) {
    query = query.ilike('sender_email', `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ senders: data || [], total: count || 0 });
}
