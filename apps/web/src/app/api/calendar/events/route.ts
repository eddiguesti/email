/**
 * GET /api/calendar/events
 *
 * Fetches calendar events from Microsoft Graph for the authenticated user.
 * Uses native fetch — no additional SDK dependency required.
 * Decrypts the stored access token server-side; never exposes tokens to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { decryptToken } from '@lb-bot/shared';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const startDateParam = searchParams.get('startDate');
  const endDateParam   = searchParams.get('endDate');

  const startDate = startDateParam ? new Date(startDateParam) : new Date();
  const endDate   = endDateParam
    ? new Date(endDateParam)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Dates invalides' }, { status: 400 });
  }

  // Fetch + decrypt access token from lawyers table
  const { data: lawyer, error: dbErr } = await supabaseAdmin
    .from('lawyers')
    .select('access_token')
    .eq('microsoft_id', user.userId)
    .single();

  if (dbErr || !lawyer?.access_token) {
    return NextResponse.json({ error: 'Token introuvable' }, { status: 401 });
  }

  const accessToken = decryptToken(lawyer.access_token);
  if (!accessToken) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  }

  try {
    const filter = `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`;
    const select = 'id,subject,bodyPreview,start,end,location,isAllDay,attendees,categories,importance,organizer,onlineMeetingUrl';

    const url = new URL(`${GRAPH_BASE}/me/calendar/events`);
    url.searchParams.set('$filter', filter);
    url.searchParams.set('$orderby', 'start/dateTime');
    url.searchParams.set('$top', '200');
    url.searchParams.set('$select', select);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Graph API error:', response.status);
      return NextResponse.json({ error: 'Erreur Microsoft Graph' }, { status: 502 });
    }

    const data = await response.json() as { value?: Record<string, unknown>[] };

    const events = (data.value || []).map(e => ({
      id:          e.id as string,
      source:      'microsoft' as const,
      subject:     (e.subject as string) || 'Sans titre',
      bodyPreview: (e.bodyPreview as string) || '',
      // Graph returns { dateTime, timeZone } for timed events, { date } for all-day.
      // Normalise both to an ISO string.
      start:       (e.start as { dateTime?: string; date?: string } | null)?.dateTime
                   ?? `${(e.start as { date?: string } | null)?.date}T00:00:00.000Z`,
      end:         (e.end   as { dateTime?: string; date?: string } | null)?.dateTime
                   ?? `${(e.end   as { date?: string } | null)?.date}T00:00:00.000Z`,
      location:    (e.location as { displayName?: string } | null)?.displayName || undefined,
      isAllDay:    (e.isAllDay as boolean) || false,
      attendees:   ((e.attendees as { emailAddress: { name?: string; address?: string } }[]) || []).map(a => ({
        name:  a.emailAddress?.name,
        email: a.emailAddress?.address,
      })),
      categories:       (e.categories as string[]) || [],
      importance:       (e.importance as string) || 'normal',
      organizer:        (e.organizer as { emailAddress: { name?: string } } | null)?.emailAddress?.name || undefined,
      onlineMeetingUrl: (e.onlineMeetingUrl as string) || undefined,
    }));

    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    console.error('Calendar events error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des événements' }, { status: 500 });
  }
}
