/**
 * Calendar Suggestions API
 *
 * CRUD endpoints for meeting/event suggestions extracted from emails.
 * All data is scoped to the authenticated user's mailbox.
 *
 * Security: every request validated via session token; user can only
 * read/modify their own suggestions (enforced both in query and by RLS).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  errorResponse,
  successResponse,
  logSecurityEvent,
  checkRateLimit,
} from '../utils/auth.js';
import {
  getMicrosoftCalendarEvents,
  createMicrosoftCalendarEvent,
} from '../services/calendar-sync.js';
import type { CalendarSuggestion } from '@lb-bot/shared';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// ─── GET /api/calendar/suggestions ──────────────────────────────────────────

async function listSuggestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`cal-suggestions:${clientIp}`, 60, 60000)) {
    return errorResponse(429, 'Trop de requêtes');
  }

  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.status, auth.error);

  try {
    const status = request.query.get('status') || 'pending';
    const validStatuses = ['pending', 'accepted', 'dismissed', 'error', 'all'];
    if (!validStatuses.includes(status)) {
      return errorResponse(400, 'Statut invalide');
    }

    let query = supabase
      .from('calendar_suggestions')
      .select('*')
      .eq('user_id', auth.user.userId)  // Scope to authenticated user only
      .order('created_at', { ascending: false })
      .limit(50);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return successResponse({ suggestions: data || [], count: (data || []).length });
  } catch (error) {
    context.error('List suggestions error:', error);
    return errorResponse(500, 'Erreur lors de la récupération des suggestions');
  }
}

// ─── PATCH /api/calendar/suggestions/:id/accept ──────────────────────────────

async function acceptSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.status, auth.error);

  const id = request.params['id'];
  if (!id) return errorResponse(400, 'ID requis');

  try {
    // Fetch suggestion — must belong to this user
    const { data: suggestion, error: fetchErr } = await supabase
      .from('calendar_suggestions')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.userId)
      .single();

    if (fetchErr || !suggestion) {
      return errorResponse(404, 'Suggestion introuvable');
    }

    if (suggestion.status !== 'pending') {
      return errorResponse(409, `Cette suggestion est déjà "${suggestion.status}"`);
    }

    // Parse optional overrides from request body
    let overrides: Partial<CalendarSuggestion> = {};
    try {
      overrides = (await request.json()) as Partial<CalendarSuggestion>;
    } catch {
      // No body — use suggestion as-is
    }

    const finalTitle       = overrides.title       || suggestion.title;
    const finalStartAt     = overrides.start_at    || suggestion.start_at;
    const finalEndAt       = overrides.end_at      || suggestion.end_at;
    const finalLocation    = overrides.location    || suggestion.location;
    const finalDescription = overrides.description || suggestion.description;
    const finalAttendees   = overrides.attendees   || suggestion.attendees || [];

    // Create the Outlook event
    let eventId: string;
    try {
      eventId = await createMicrosoftCalendarEvent(auth.user.accessToken, {
        subject: finalTitle,
        body: finalDescription || undefined,
        start: new Date(finalStartAt),
        end: finalEndAt ? new Date(finalEndAt) : new Date(new Date(finalStartAt).getTime() + 3600_000),
        location: finalLocation || undefined,
        attendees: (finalAttendees as { email: string; name?: string }[]).map(a => ({
          email: a.email,
          name: a.name,
        })),
      });
    } catch (graphErr) {
      context.error('Outlook event creation failed:', graphErr);
      // Mark as error so user can retry
      await supabase
        .from('calendar_suggestions')
        .update({ status: 'error' })
        .eq('id', id);
      return errorResponse(502, "Erreur lors de la création de l'événement Outlook");
    }

    // Mark as accepted
    const { error: updateErr } = await supabase
      .from('calendar_suggestions')
      .update({
        status: 'accepted',
        outlook_event_id: eventId,
        accepted_at: new Date().toISOString(),
        // Persist any user edits
        title:       finalTitle,
        start_at:    finalStartAt,
        end_at:      finalEndAt,
        location:    finalLocation,
        description: finalDescription,
        attendees:   finalAttendees,
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    await logSecurityEvent('calendar_suggestion_accepted', auth.user.userId, request, {
      suggestionId: id,
      eventId,
      title: finalTitle,
    });

    return successResponse({ success: true, eventId });
  } catch (error) {
    context.error('Accept suggestion error:', error);
    return errorResponse(500, "Erreur lors de l'acceptation de la suggestion");
  }
}

// ─── PATCH /api/calendar/suggestions/:id/dismiss ─────────────────────────────

async function dismissSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.status, auth.error);

  const id = request.params['id'];
  if (!id) return errorResponse(400, 'ID requis');

  try {
    const { error } = await supabase
      .from('calendar_suggestions')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', auth.user.userId);  // Scope guard

    if (error) throw error;

    await logSecurityEvent('calendar_suggestion_dismissed', auth.user.userId, request, {
      suggestionId: id,
    });

    return successResponse({ success: true });
  } catch (error) {
    context.error('Dismiss suggestion error:', error);
    return errorResponse(500, 'Erreur lors du rejet de la suggestion');
  }
}

// ─── PUT /api/calendar/suggestions/:id ───────────────────────────────────────

async function updateSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.status, auth.error);

  const id = request.params['id'];
  if (!id) return errorResponse(400, 'ID requis');

  try {
    const body = await request.json() as Partial<CalendarSuggestion>;

    // Whitelist editable fields — never allow status change via this endpoint
    const allowed = {
      title:       body.title,
      description: body.description,
      start_at:    body.start_at,
      end_at:      body.end_at,
      location:    body.location,
      attendees:   body.attendees,
    };

    // Validate start_at
    if (allowed.start_at && isNaN(new Date(allowed.start_at).getTime())) {
      return errorResponse(400, 'Date de début invalide');
    }
    if (allowed.title && allowed.title.length > 200) {
      return errorResponse(400, 'Titre trop long (200 caractères max)');
    }

    // Strip undefined fields
    const update = Object.fromEntries(
      Object.entries(allowed).filter(([, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('calendar_suggestions')
      .update(update)
      .eq('id', id)
      .eq('user_id', auth.user.userId)   // Scope guard
      .select()
      .single();

    if (error) throw error;

    return successResponse({ suggestion: data });
  } catch (error) {
    context.error('Update suggestion error:', error);
    return errorResponse(500, 'Erreur lors de la mise à jour');
  }
}

// ─── Register endpoints ───────────────────────────────────────────────────────

app.http('calendar-suggestions-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar/suggestions',
  handler: listSuggestions,
});

app.http('calendar-suggestions-accept', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'calendar/suggestions/{id}/accept',
  handler: acceptSuggestion,
});

app.http('calendar-suggestions-dismiss', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'calendar/suggestions/{id}/dismiss',
  handler: dismissSuggestion,
});

app.http('calendar-suggestions-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'calendar/suggestions/{id}',
  handler: updateSuggestion,
});
