-- ============================================================
-- LB-BOT Supabase Schema
-- Persistent storage for email matching pipeline
-- ============================================================

-- 1. Match logs — records every email processed and its match result
CREATE TABLE IF NOT EXISTS match_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Email metadata (NO body/content stored — privacy by design)
  mailbox         TEXT NOT NULL,                      -- e.g. "nm@lbrosset.com"
  email_id        TEXT NOT NULL,                      -- Graph API message ID
  conversation_id TEXT,                               -- Graph conversation thread ID
  sender_email    TEXT NOT NULL,
  sender_name     TEXT,
  sender_domain   TEXT,
  subject_hash    TEXT NOT NULL,                      -- SHA-256 of subject (not raw subject)
  received_at     TIMESTAMPTZ,
  has_attachments BOOLEAN DEFAULT false,
  is_ebarreau     BOOLEAN DEFAULT false,

  -- Match result
  matched         BOOLEAN NOT NULL DEFAULT false,
  dossier_id      INTEGER,                            -- KLEOS dossier ID
  dossier_ref     TEXT,                               -- KLEOS reference (e.g. "202940")
  dossier_name    TEXT,
  confidence      REAL,                               -- 0.0 to 1.0
  match_source    TEXT,                               -- "reference_exact", "ai_classifier_scoped", etc.
  match_reasons   TEXT[],                             -- Array of reason strings
  lawyer          TEXT,                               -- Assigned lawyer name

  -- Classification
  action_taken    TEXT DEFAULT 'dry_run',             -- "dry_run", "auto_filed", "review", "skipped"
  reviewed_by     TEXT,                               -- Lawyer who reviewed (for review queue)
  reviewed_at     TIMESTAMPTZ,
  review_approved BOOLEAN,                            -- true = correct match, false = wrong

  -- Outlook-style category (computed at processing time)
  category_label  TEXT,                              -- e.g. "LB - Classé"
  category_color  TEXT,                              -- "green", "orange", "red", "blue", "grey", "purple"

  -- Prevent duplicate processing
  UNIQUE(email_id, mailbox)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_match_logs_mailbox ON match_logs(mailbox, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_logs_sender ON match_logs(sender_email);
CREATE INDEX IF NOT EXISTS idx_match_logs_conversation ON match_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_dossier ON match_logs(dossier_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_action ON match_logs(action_taken);
CREATE INDEX IF NOT EXISTS idx_match_logs_category ON match_logs(category_color);

-- 2. Sender history — persistent sender → dossier patterns (learned over time)
CREATE TABLE IF NOT EXISTS sender_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  sender_email    TEXT NOT NULL,
  dossier_id      INTEGER NOT NULL,
  dossier_ref     TEXT NOT NULL,
  dossier_name    TEXT NOT NULL,
  match_count     INTEGER DEFAULT 1 NOT NULL,          -- How many times this sender→dossier seen
  last_seen       TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Track confidence of this association
  avg_confidence  REAL DEFAULT 0.0,                    -- Running average of match confidences

  UNIQUE(sender_email, dossier_id)
);

CREATE INDEX IF NOT EXISTS idx_sender_history_email ON sender_history(sender_email);
CREATE INDEX IF NOT EXISTS idx_sender_history_dossier ON sender_history(dossier_id);

-- 3. Conversation threads — persistent conversation → dossier mapping
CREATE TABLE IF NOT EXISTS conversation_threads (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  conversation_id TEXT NOT NULL UNIQUE,                -- Graph API conversation ID
  dossier_id      INTEGER NOT NULL,
  dossier_ref     TEXT NOT NULL,
  dossier_name    TEXT NOT NULL,
  confidence      REAL NOT NULL,
  match_source    TEXT,
  lawyer          TEXT,
  email_count     INTEGER DEFAULT 1,                   -- Emails in thread matched so far

  last_email_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_threads_conversation ON conversation_threads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_threads_dossier ON conversation_threads(dossier_id);

-- 4. Skip domains — dynamically managed list (can add via dashboard later)
CREATE TABLE IF NOT EXISTS skip_domains (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  domain          TEXT NOT NULL UNIQUE,
  category        TEXT,                                -- "social", "newsletter", "spam", etc.
  added_by        TEXT DEFAULT 'system',               -- "system" or lawyer name
  is_active       BOOLEAN DEFAULT true
);

-- 5. Pipeline runs — track each execution for monitoring
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  finished_at     TIMESTAMPTZ,

  mailbox         TEXT NOT NULL,
  emails_fetched  INTEGER DEFAULT 0,
  emails_skipped  INTEGER DEFAULT 0,
  emails_processed INTEGER DEFAULT 0,
  emails_matched  INTEGER DEFAULT 0,
  emails_auto_filed INTEGER DEFAULT 0,
  emails_review   INTEGER DEFAULT 0,
  emails_no_match INTEGER DEFAULT 0,

  -- Source breakdown
  source_stats    JSONB DEFAULT '{}',

  -- Errors
  error_count     INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]',

  status          TEXT DEFAULT 'running'               -- "running", "completed", "failed"
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_mailbox ON pipeline_runs(mailbox, started_at DESC);

-- 6. User preferences — per-lawyer settings
CREATE TABLE IF NOT EXISTS user_preferences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  user_id         TEXT NOT NULL UNIQUE,              -- Microsoft Graph user ID
  email           TEXT NOT NULL,                      -- Login email = mailbox
  display_name    TEXT,

  -- Settings
  email_notifications  BOOLEAN DEFAULT true,
  urgent_alerts        BOOLEAN DEFAULT true,
  language             TEXT DEFAULT 'fr'
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON user_preferences(email);

-- 7. Lawyer style profiles — cached AI-extracted writing style (for draft replies)
CREATE TABLE IF NOT EXISTS lawyer_style_profiles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT,

  -- AI-extracted style data
  style_summary   TEXT NOT NULL,
  sample_greetings TEXT[],
  sample_signoffs  TEXT[],
  formality_level  TEXT DEFAULT 'formal',
  avg_reply_length INTEGER DEFAULT 150,
  raw_samples      JSONB DEFAULT '[]',

  -- Cache expiry (refresh after 30 days)
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_email ON lawyer_style_profiles(email);

-- ============================================================
-- Row Level Security (RLS) — restrict access
-- ============================================================

ALTER TABLE match_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE skip_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by the bot)
-- TO service_role ensures anon key has NO access to these tables
CREATE POLICY "Service role full access" ON match_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sender_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON conversation_threads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON skip_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pipeline_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON user_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE lawyer_style_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON lawyer_style_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Activity logs — per-user action tracking
CREATE TABLE IF NOT EXISTS activity_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  user_id         TEXT NOT NULL,
  user_email      TEXT NOT NULL,
  user_name       TEXT NOT NULL,

  action          TEXT NOT NULL,
  details         JSONB,
  resource_type   TEXT,
  resource_id     TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON activity_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Helper functions
-- ============================================================

-- Upsert sender history: increment count and update avg confidence
CREATE OR REPLACE FUNCTION upsert_sender_history(
  p_sender_email TEXT,
  p_dossier_id INTEGER,
  p_dossier_ref TEXT,
  p_dossier_name TEXT,
  p_confidence REAL
) RETURNS void AS $$
BEGIN
  INSERT INTO sender_history (sender_email, dossier_id, dossier_ref, dossier_name, match_count, avg_confidence, last_seen)
  VALUES (p_sender_email, p_dossier_id, p_dossier_ref, p_dossier_name, 1, p_confidence, now())
  ON CONFLICT (sender_email, dossier_id) DO UPDATE SET
    match_count = sender_history.match_count + 1,
    avg_confidence = (sender_history.avg_confidence * sender_history.match_count + p_confidence) / (sender_history.match_count + 1),
    last_seen = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Upsert conversation thread
CREATE OR REPLACE FUNCTION upsert_conversation_thread(
  p_conversation_id TEXT,
  p_dossier_id INTEGER,
  p_dossier_ref TEXT,
  p_dossier_name TEXT,
  p_confidence REAL,
  p_match_source TEXT,
  p_lawyer TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO conversation_threads (conversation_id, dossier_id, dossier_ref, dossier_name, confidence, match_source, lawyer, email_count, last_email_at)
  VALUES (p_conversation_id, p_dossier_id, p_dossier_ref, p_dossier_name, p_confidence, p_match_source, p_lawyer, 1, now())
  ON CONFLICT (conversation_id) DO UPDATE SET
    email_count = conversation_threads.email_count + 1,
    last_email_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
