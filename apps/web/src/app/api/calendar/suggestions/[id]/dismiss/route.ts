/**
 * PATCH /api/calendar/suggestions/:id/dismiss
 *
 * Marks a pending suggestion as dismissed. No Outlook event is created.
 * Uses an atomic update (WHERE status = 'pending') to prevent race conditions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  // Atomic update: only succeeds if suggestion exists, belongs to this user, and is pending.
  // This avoids a separate read + write race condition.
  const { error, data } = await supabaseAdmin
    .from('calendar_suggestions')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.userId)
    .eq('status', 'pending')
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    // Either not found, wrong user, or already processed
    const { data: existing } = await supabaseAdmin
      .from('calendar_suggestions')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.userId)
      .single();

    if (!existing) return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 });
    return NextResponse.json({ error: `Suggestion déjà "${existing.status}"` }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
