import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50', 10), 200);

  // Always scope to the authenticated user's own logs
  let query = supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', user.userId)
    .order('created_at', { ascending: false });

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    per_page: perPage,
  });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await req.json();
  const { action, details, resource_type, resource_id } = body;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .insert({
      user_id: user.userId,
      user_email: user.email,
      user_name: user.name,
      action,
      details: details || null,
      resource_type: resource_type || null,
      resource_id: resource_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data }, { status: 201 });
}
