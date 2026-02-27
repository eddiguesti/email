import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check FIRST — before any DB write
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing match id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { approved } = body as Record<string, unknown>;

  if (typeof approved !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required field: approved (boolean)' },
      { status: 400 }
    );
  }

  let updateQuery = supabaseAdmin
    .from('match_logs')
    .update({
      review_approved: approved,
      reviewed_by: user.name || user.email,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('review_approved', null); // atomic: only update if not already reviewed

  // Non-admin lawyers can only review their own mailbox
  if (!user.isAdmin) {
    updateQuery = updateQuery.eq('mailbox', user.email);
  }

  const { data, error } = await updateQuery.select().single();

  if (error) {
    console.error('[review] DB error:', error.message);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }

  // Log user activity (fire-and-forget, non-blocking)
  void Promise.resolve(supabaseAdmin.from('activity_logs').insert({
    user_id: user.userId,
    user_email: user.email,
    user_name: user.name,
    action: approved ? 'match_approved' : 'match_rejected',
    details: {
      dossier_ref: data?.dossier_ref,
      dossier_name: data?.dossier_name,
      confidence: data?.confidence,
      match_source: data?.match_source,
    },
    resource_type: 'match_log',
    resource_id: id,
  })).catch(err => console.error('Failed to log activity:', err));

  return NextResponse.json({ match: data });
}
