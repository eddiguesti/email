/**
 * GET  /api/calendar/suggestions   — list suggestions for authenticated user
 * POST /api/calendar/suggestions   — create a manual suggestion (future use)
 *
 * Data is scoped to user_id from session token; service-role key used for DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') || 'pending';
  const validStatuses = ['pending', 'accepted', 'dismissed', 'error', 'all'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('calendar_suggestions')
    .select('*')
    .eq('user_id', user.userId)           // Always scope to authenticated user
    .order('created_at', { ascending: false })
    .limit(50);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Suggestions fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestions: data || [], count: (data || []).length });
}
