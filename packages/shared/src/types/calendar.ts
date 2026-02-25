/**
 * Calendar & Suggestion Types
 *
 * Shared between worker (writes suggestions) and web/API (reads/updates).
 */

// ─── Calendar Suggestion ────────────────────────────────────────────────────

export type CalendarSuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'error';

export interface SuggestionAttendee {
  name?: string;
  email: string;
}

/**
 * A calendar event suggestion extracted from an incoming email.
 * Stored in Supabase `calendar_suggestions` table.
 * Never contains raw email body — only metadata + short evidence snippet.
 */
export interface CalendarSuggestion {
  id: string;
  created_at: string;
  updated_at: string;

  // Owner
  user_id: string;          // lawyers.microsoft_id
  mailbox: string;

  // Source email
  email_id: string;
  sender_email?: string;
  sender_name?: string;
  email_subject_preview?: string;

  // Status
  status: CalendarSuggestionStatus;

  // Event data (editable)
  title: string;
  description?: string;
  start_at: string;           // ISO 8601
  end_at?: string;            // ISO 8601, optional
  location?: string;
  attendees: SuggestionAttendee[];

  // Detection metadata
  confidence: number;         // 0–1
  evidence?: string;          // Short snippet from email (max 500 chars)
  detected_patterns: string[];

  // Outcome
  outlook_event_id?: string;
  accepted_at?: string;
  dismissed_at?: string;
}

// ─── Meeting Intent (output from the detector) ──────────────────────────────

/**
 * Raw output from the meeting intent detector.
 * Returned when an email contains evidence of a real appointment.
 */
export interface MeetingIntent {
  /** Proposed event title (from subject or extracted phrase) */
  title: string;
  /** Parsed start date+time, assumed Europe/Paris timezone */
  startAt: Date;
  /** Parsed end date+time, if a duration/range was found */
  endAt?: Date;
  /** Extracted location, if any */
  location?: string;
  /** Detection confidence 0.3–1.0 */
  confidence: number;
  /** Short evidence snippet that triggered detection (max 500 chars) */
  evidence: string;
  /** Names of the patterns that matched */
  detectedPatterns: string[];
}

// ─── Input for creating a suggestion ────────────────────────────────────────

export interface CreateCalendarSuggestionInput {
  user_id: string;
  mailbox: string;
  email_id: string;
  sender_email?: string;
  sender_name?: string;
  email_subject_preview?: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  location?: string;
  attendees?: SuggestionAttendee[];
  confidence: number;
  evidence?: string;
  detected_patterns?: string[];
}
