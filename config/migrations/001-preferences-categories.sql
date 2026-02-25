-- ============================================================
-- Migration 001: User Preferences + Email Categories
-- ============================================================

-- 1. Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  user_id         TEXT NOT NULL UNIQUE,            -- Microsoft Graph user ID
  email           TEXT NOT NULL,                    -- Login email = mailbox
  display_name    TEXT,

  -- Settings (sensible defaults)
  email_notifications  BOOLEAN DEFAULT true,
  urgent_alerts        BOOLEAN DEFAULT true,
  language             TEXT DEFAULT 'fr'
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON user_preferences(email);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON user_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Add category columns to match_logs
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS category_label TEXT;
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS category_color TEXT;

CREATE INDEX IF NOT EXISTS idx_match_logs_category ON match_logs(category_color);

-- 3. Backfill existing match_logs with categories
-- Green: matched >= 85%
UPDATE match_logs
SET category_label = 'LB - Classé', category_color = 'green'
WHERE matched = true AND confidence >= 0.85
  AND category_color IS NULL;

-- Orange: matched 60-85%
UPDATE match_logs
SET category_label = 'LB - À vérifier', category_color = 'orange'
WHERE matched = true AND confidence >= 0.60 AND confidence < 0.85
  AND category_color IS NULL;

-- Blue: e-Barreau
UPDATE match_logs
SET category_label = 'LB - eBarreau', category_color = 'blue'
WHERE is_ebarreau = true
  AND category_color IS NULL;

-- Red: no match (not skipped)
UPDATE match_logs
SET category_label = 'LB - Non classé', category_color = 'red'
WHERE matched = false AND action_taken != 'skipped'
  AND category_color IS NULL;

-- Grey: skipped (spam, newsletters, system)
UPDATE match_logs
SET category_label = 'LB - Ignoré', category_color = 'grey'
WHERE action_taken = 'skipped'
  AND category_color IS NULL;
