-- ============================================================
-- Activity Logs — per-user action tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- User who performed the action
  user_id         TEXT NOT NULL,
  user_email      TEXT NOT NULL,
  user_name       TEXT NOT NULL,

  -- Action details
  action          TEXT NOT NULL,                    -- "match_approved", "match_rejected", "draft_generated", "settings_updated", "login", "search"
  details         JSONB,                            -- Action-specific metadata
  resource_type   TEXT,                             -- "match_log", "user_preferences", etc.
  resource_id     TEXT                              -- ID of the affected resource
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON activity_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
