import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  let query = supabaseAdmin
    .from('pipeline_runs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .limit(limit);
  if (!user.isAdmin) query = query.eq('mailbox', user.email);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data || [], total: count || 0 });
}
