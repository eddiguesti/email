import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const matched = searchParams.get('matched');
  const confidenceMin = searchParams.get('confidence_min');
  const confidenceMax = searchParams.get('confidence_max');
  const source = searchParams.get('source');
  const lawyer = searchParams.get('lawyer');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const reviewed = searchParams.get('reviewed');
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50', 10), 200);

  let query = supabaseAdmin
    .from('match_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (!user.isAdmin) query = query.eq('mailbox', user.email);
  if (matched === 'true') query = query.eq('matched', true);
  if (matched === 'false') query = query.eq('matched', false);
  if (confidenceMin) query = query.gte('confidence', parseFloat(confidenceMin));
  if (confidenceMax) query = query.lte('confidence', parseFloat(confidenceMax));
  if (source) query = query.eq('match_source', source);
  if (lawyer) query = query.ilike('lawyer', `%${lawyer}%`);
  if (dateFrom) query = query.gte('received_at', dateFrom);
  if (dateTo) query = query.lte('received_at', dateTo);
  if (reviewed === 'true') query = query.not('review_approved', 'is', null);
  if (reviewed === 'false') query = query.is('review_approved', null);

  const category = searchParams.get('category');
  if (category) query = query.eq('category_color', category);

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    matches: data || [],
    total: count || 0,
    page,
    per_page: perPage,
  });
}
