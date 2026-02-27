-- LB-BOT Supabase Complete Setup

-- 1. Lawyers table
CREATE TABLE IF NOT EXISTS lawyers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microsoft_id    VARCHAR(255) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  display_name    VARCHAR(255),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes          TEXT[],
  is_active       BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  graph_subscription_id VARCHAR(255),
  subscription_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyers_microsoft_id ON lawyers(microsoft_id);
CREATE INDEX IF NOT EXISTS idx_lawyers_email ON lawyers(email);

-- 2. Match logs
CREATE TABLE IF NOT EXISTS match_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  mailbox         TEXT NOT NULL,
  email_id        TEXT NOT NULL,
  conversation_id TEXT,
  sender_email    TEXT NOT NULL,
  sender_name     TEXT,
  sender_domain   TEXT,
  subject_hash    TEXT NOT NULL,
  received_at     TIMESTAMPTZ,
  has_attachments BOOLEAN DEFAULT false,
  is_ebarreau     BOOLEAN DEFAULT false,
  matched         BOOLEAN NOT NULL DEFAULT false,
  dossier_id      INTEGER,
  dossier_ref     TEXT,
  dossier_name    TEXT,
  confidence      REAL,
  match_source    TEXT,
  match_reasons   TEXT[],
  lawyer          TEXT,
  action_taken    TEXT DEFAULT 'dry_run',
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  review_approved BOOLEAN,
  category_label  TEXT,
  category_color  TEXT,
  UNIQUE(email_id, mailbox)
);

CREATE INDEX IF NOT EXISTS idx_match_logs_mailbox ON match_logs(mailbox, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_logs_sender ON match_logs(sender_email);
CREATE INDEX IF NOT EXISTS idx_match_logs_conversation ON match_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_dossier ON match_logs(dossier_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_action ON match_logs(action_taken);
CREATE INDEX IF NOT EXISTS idx_match_logs_category ON match_logs(category_color);

-- 3. Sender history
CREATE TABLE IF NOT EXISTS sender_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  sender_email    TEXT NOT NULL,
  dossier_id      INTEGER NOT NULL,
  dossier_ref     TEXT NOT NULL,
  dossier_name    TEXT NOT NULL,
  match_count     INTEGER DEFAULT 1 NOT NULL,
  last_seen       TIMESTAMPTZ DEFAULT now() NOT NULL,
  avg_confidence  REAL DEFAULT 0.0,
  UNIQUE(sender_email, dossier_id)
);

CREATE INDEX IF NOT EXISTS idx_sender_history_email ON sender_history(sender_email);
CREATE INDEX IF NOT EXISTS idx_sender_history_dossier ON sender_history(dossier_id);

-- 4. Conversation threads
CREATE TABLE IF NOT EXISTS conversation_threads (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  conversation_id TEXT NOT NULL UNIQUE,
  dossier_id      INTEGER NOT NULL,
  dossier_ref     TEXT NOT NULL,
  dossier_name    TEXT NOT NULL,
  confidence      REAL NOT NULL,
  match_source    TEXT,
  lawyer          TEXT,
  email_count     INTEGER DEFAULT 1,
  last_email_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_threads_conversation ON conversation_threads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_threads_dossier ON conversation_threads(dossier_id);

-- 5. Skip domains
CREATE TABLE IF NOT EXISTS skip_domains (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  domain          TEXT NOT NULL UNIQUE,
  category        TEXT,
  added_by        TEXT DEFAULT 'system',
  is_active       BOOLEAN DEFAULT true
);

-- 6. Pipeline runs
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
  source_stats    JSONB DEFAULT '{}',
  error_count     INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_mailbox ON pipeline_runs(mailbox, started_at DESC);

-- 7. User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id         TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL,
  display_name    TEXT,
  email_notifications  BOOLEAN DEFAULT true,
  urgent_alerts        BOOLEAN DEFAULT true,
  language             TEXT DEFAULT 'fr'
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON user_preferences(email);

-- 8. Lawyer style profiles
CREATE TABLE IF NOT EXISTS lawyer_style_profiles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  style_summary   TEXT NOT NULL,
  sample_greetings TEXT[],
  sample_signoffs  TEXT[],
  formality_level  TEXT DEFAULT 'formal',
  avg_reply_length INTEGER DEFAULT 150,
  raw_samples      JSONB DEFAULT '[]',
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_email ON lawyer_style_profiles(email);

-- 9. Activity logs
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

-- Row Level Security
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE skip_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
DROP POLICY IF EXISTS "Service role full access" ON lawyers;
CREATE POLICY "Service role full access" ON lawyers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON match_logs;
CREATE POLICY "Service role full access" ON match_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON sender_history;
CREATE POLICY "Service role full access" ON sender_history FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON conversation_threads;
CREATE POLICY "Service role full access" ON conversation_threads FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON skip_domains;
CREATE POLICY "Service role full access" ON skip_domains FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON pipeline_runs;
CREATE POLICY "Service role full access" ON pipeline_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON user_preferences;
CREATE POLICY "Service role full access" ON user_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON lawyer_style_profiles;
CREATE POLICY "Service role full access" ON lawyer_style_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON activity_logs;
CREATE POLICY "Service role full access" ON activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helper functions
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

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_lawyers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lawyers_updated_at ON lawyers;
CREATE TRIGGER lawyers_updated_at
  BEFORE UPDATE ON lawyers
  FOR EACH ROW
  EXECUTE FUNCTION update_lawyers_updated_at();
