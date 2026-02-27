/**
 * PUT /api/calendar/suggestions/:id
 *
 * Updates suggestion fields (pre-accept editing). Whitelisted fields only.
 * Scoped to the authenticated user's user_id.
 *
 * Accept → PATCH /api/calendar/suggestions/:id/accept
 * Dismiss → PATCH /api/calendar/suggestions/:id/dismiss
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  // Whitelist editable fields
  const update: Record<string, unknown> = {};
  if (body.title       !== undefined) update.title       = String(body.title).slice(0, 200);
  if (body.description !== undefined) update.description = String(body.description).slice(0, 500);
  if (body.start_at    !== undefined) update.start_at    = body.start_at;
  if (body.end_at      !== undefined) update.end_at      = body.end_at;
  if (body.location    !== undefined) update.location    = String(body.location).slice(0, 200);
  if (body.attendees   !== undefined) update.attendees   = body.attendees;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 });
  }

  if (update.start_at && isNaN(new Date(update.start_at as string).getTime())) {
    return NextResponse.json({ error: 'Date de début invalide' }, { status: 400 });
  }
  if (update.end_at && isNaN(new Date(update.end_at as string).getTime())) {
    return NextResponse.json({ error: 'Date de fin invalide' }, { status: 400 });
  }
  // Validate date ordering — even when only one side is being updated
  if (update.start_at || update.end_at) {
    let effectiveStart: Date | null = null;
    let effectiveEnd: Date | null = null;

    if (update.start_at && update.end_at) {
      effectiveStart = new Date(update.start_at as string);
      effectiveEnd   = new Date(update.end_at as string);
    } else {
      // Fetch the existing record to compare against the unchanged side
      const { data: existing } = await supabaseAdmin
        .from('calendar_suggestions')
        .select('start_at, end_at')
        .eq('id', id)
        .eq('user_id', user.userId)
        .single();
      if (existing) {
        effectiveStart = new Date((update.start_at as string | undefined) ?? existing.start_at);
        effectiveEnd   = new Date((update.end_at   as string | undefined) ?? existing.end_at);
      }
    }

    if (effectiveStart && effectiveEnd && effectiveEnd <= effectiveStart) {
      return NextResponse.json({ error: 'La date de fin doit être après la date de début' }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('calendar_suggestions')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.userId) // Scope guard
    .select()
    .single();

  if (error) {
    console.error('[suggestions/put] DB error:', error.message);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
  return NextResponse.json({ suggestion: data });
}
