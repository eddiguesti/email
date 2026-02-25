-- ============================================================
-- Migration 001: Calendar Suggestions
-- Stores meeting/event suggestions extracted from emails.
-- Privacy: no raw email body; only metadata + short evidence snippet.
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_suggestions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Owner (scoped to the authenticated lawyer)
  user_id               TEXT NOT NULL,                  -- lawyers.microsoft_id
  mailbox               TEXT NOT NULL,                  -- e.g. "nm@lbrosset.com"

  -- Source email (never store body)
  email_id              TEXT NOT NULL,                  -- Graph message ID
  sender_email          TEXT,
  sender_name           TEXT,
  email_subject_preview TEXT,                           -- First 100 chars of subject (no hash)

  -- Status machine: pending → accepted | dismissed | error
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'error')),

  -- Extracted / user-editable event data
  title                 TEXT NOT NULL,
  description           TEXT,                           -- Short context (max 500 chars)
  start_at              TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ,
  location              TEXT,
  attendees             JSONB NOT NULL DEFAULT '[]',    -- [{name?,email}]

  -- Detection metadata
  confidence            REAL NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  evidence              TEXT,                           -- Snippet that triggered detection (max 500 chars)
  detected_patterns     TEXT[] NOT NULL DEFAULT '{}',  -- Pattern names that matched

  -- Outcome
  outlook_event_id      TEXT,                           -- Set after Outlook event created
  accepted_at           TIMESTAMPTZ,
  dismissed_at          TIMESTAMPTZ,

  -- Idempotency: one suggestion per email per mailbox
  UNIQUE(email_id, mailbox)
);

CREATE INDEX IF NOT EXISTS idx_cal_suggestions_user    ON calendar_suggestions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_suggestions_mailbox ON calendar_suggestions(mailbox, status);
CREATE INDEX IF NOT EXISTS idx_cal_suggestions_status  ON calendar_suggestions(status, created_at DESC);

ALTER TABLE calendar_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON calendar_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_calendar_suggestions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_suggestions_updated_at ON calendar_suggestions;
CREATE TRIGGER calendar_suggestions_updated_at
  BEFORE UPDATE ON calendar_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_calendar_suggestions_updated_at();
