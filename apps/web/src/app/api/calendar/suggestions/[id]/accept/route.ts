/**
 * PATCH /api/calendar/suggestions/:id/accept
 *
 * Accepts a pending suggestion and creates the corresponding Outlook calendar event.
 * Accepts optional field overrides in the request body (title, start_at, end_at, location,
 * description, attendees) so the user can edit before confirming.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { decryptToken } from '@lb-bot/shared';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('lawyers')
    .select('access_token')
    .eq('microsoft_id', userId)
    .single();
  return data?.access_token ? decryptToken(data.access_token) : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  // Fetch suggestion — enforce user_id scope
  const { data: suggestion, error: fetchErr } = await supabaseAdmin
    .from('calendar_suggestions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.userId)
    .single();

  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 });
  }

  if (suggestion.status !== 'pending') {
    return NextResponse.json(
      { error: `Suggestion déjà "${suggestion.status}"` },
      { status: 409 }
    );
  }

  // Parse optional user edits from request body
  let overrides: Record<string, unknown> = {};
  try { overrides = await req.json(); } catch { /* no body — use suggestion defaults */ }

  const title       = (overrides.title       as string | undefined) || suggestion.title;
  const startAt     = (overrides.start_at    as string | undefined) || suggestion.start_at;
  const endAt       = (overrides.end_at      as string | undefined) || suggestion.end_at;
  const location    = (overrides.location    as string | undefined) || suggestion.location;
  const description = (overrides.description as string | undefined) || suggestion.description;
  const attendees   = (overrides.attendees   as { email: string; name?: string }[] | undefined)
                      || suggestion.attendees || [];

  // Validate date ordering before hitting the Graph API.
  const startDate = new Date(startAt);
  const endDate   = endAt ? new Date(endAt) : new Date(startDate.getTime() + 3600_000);

  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Date de début invalide' }, { status: 400 });
  }
  if (isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Date de fin invalide' }, { status: 400 });
  }
  if (startDate >= endDate) {
    return NextResponse.json(
      { error: 'La date de fin doit être après la date de début' },
      { status: 400 }
    );
  }

  const accessToken = await getAccessToken(user.userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'Token Microsoft introuvable' }, { status: 401 });
  }

  let eventId: string;
  try {
    const start = startDate;
    const end   = endDate;

    const newEvent = {
      subject: title,
      body: description ? { contentType: 'Text', content: description } : undefined,
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end:   { dateTime: end.toISOString(),   timeZone: 'UTC' },
      location: location ? { displayName: location } : undefined,
      attendees: attendees.map((a: { email: string; name?: string }) => ({
        emailAddress: { address: a.email, name: a.name },
        type: 'required',
      })),
    };

    const graphRes = await fetch(`${GRAPH_BASE}/me/calendar/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newEvent),
      signal: AbortSignal.timeout(15_000),
    });

    if (!graphRes.ok) {
      let errBody = '';
      try { errBody = await graphRes.text(); } catch { /* ignore */ }
      console.error('Graph API error:', graphRes.status, errBody);
      throw new Error(`Graph ${graphRes.status}`);
    }

    const created = await graphRes.json() as { id?: string };
    if (!created.id) throw new Error('Missing event ID in Graph response');
    eventId = created.id;
  } catch (err) {
    console.error('Outlook event creation failed:', err);
    await supabaseAdmin
      .from('calendar_suggestions')
      .update({ status: 'error' })
      .eq('id', id)
      .eq('user_id', user.userId);
    return NextResponse.json({ error: "Erreur création événement Outlook" }, { status: 502 });
  }

  // Atomic: .eq('status', 'pending') ensures only one concurrent accept wins.
  const { error: updateErr, data: updatedRows } = await supabaseAdmin
    .from('calendar_suggestions')
    .update({
      status: 'accepted',
      outlook_event_id: eventId,
      accepted_at: new Date().toISOString(),
      title,
      start_at: startAt,
      end_at: endAt,
      location,
      description,
      attendees,
    })
    .eq('id', id)
    .eq('user_id', user.userId)
    .eq('status', 'pending')
    .select('id');

  if (updateErr) {
    console.error('[accept] DB error:', updateErr.message);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Suggestion déjà traitée' }, { status: 409 });
  }

  return NextResponse.json({ success: true, eventId });
}
