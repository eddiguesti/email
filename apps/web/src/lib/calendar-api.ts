/**
 * Calendar API helpers
 *
 * Typed wrappers around the Next.js /api/calendar/* routes.
 * All calls are unauthenticated from the client side — the session cookie is
 * sent automatically; server-side routes handle validation.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarSuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'error';

export interface SuggestionAttendee {
  name?: string;
  email: string;
}

export interface CalendarSuggestion {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  mailbox: string;
  email_id: string;
  sender_email?: string;
  sender_name?: string;
  email_subject_preview?: string;
  status: CalendarSuggestionStatus;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  location?: string;
  attendees: SuggestionAttendee[];
  confidence: number;
  evidence?: string;
  detected_patterns: string[];
  outlook_event_id?: string;
  accepted_at?: string;
  dismissed_at?: string;
}

export interface CalendarEvent {
  id: string;
  source: 'microsoft';
  subject: string;
  bodyPreview?: string;
  start: string;           // ISO 8601 datetime
  end: string;             // ISO 8601 datetime
  location?: string;
  isAllDay: boolean;
  attendees: { name?: string; email?: string }[];
  categories: string[];
  importance: 'low' | 'normal' | 'high';
  organizer?: string;
  onlineMeetingUrl?: string;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function calendarFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/calendar${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new Error((err as { error?: string }).error || `Error ${res.status}`);
  }
  return res.json();
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

export async function getCalendarEvents(params?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<{ events: CalendarEvent[]; count: number }> {
  const sp = new URLSearchParams();
  if (params?.startDate) sp.set('startDate', params.startDate.toISOString());
  if (params?.endDate)   sp.set('endDate',   params.endDate.toISOString());
  return calendarFetch(`/events?${sp}`);
}

// ─── Calendar Suggestions ─────────────────────────────────────────────────────

export async function getCalendarSuggestions(
  status: 'pending' | 'accepted' | 'dismissed' | 'error' | 'all' = 'pending'
): Promise<{ suggestions: CalendarSuggestion[]; count: number }> {
  return calendarFetch(`/suggestions?status=${status}`);
}

export async function acceptSuggestion(
  id: string,
  overrides?: Partial<Pick<CalendarSuggestion, 'title' | 'start_at' | 'end_at' | 'location' | 'description' | 'attendees'>>
): Promise<{ success: boolean; eventId: string }> {
  return calendarFetch(`/suggestions/${id}/accept`, {
    method: 'PATCH',
    body: overrides ? JSON.stringify(overrides) : undefined,
  });
}

export async function dismissSuggestion(
  id: string
): Promise<{ success: boolean }> {
  return calendarFetch(`/suggestions/${id}/dismiss`, { method: 'PATCH' });
}

export async function updateSuggestion(
  id: string,
  data: Partial<Pick<CalendarSuggestion, 'title' | 'start_at' | 'end_at' | 'location' | 'description' | 'attendees'>>
): Promise<{ suggestion: CalendarSuggestion }> {
  return calendarFetch(`/suggestions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
