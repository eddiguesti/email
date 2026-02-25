-- ============================================================
-- Migration 002: Lawyer Style Profiles (for AI Draft Reply)
-- ============================================================

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

-- RLS
ALTER TABLE lawyer_style_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON lawyer_style_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
