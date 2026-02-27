-- Audit logs table (used by the StorageClient for system-level audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  actor_type      TEXT NOT NULL,
  actor_id        TEXT,
  details         JSONB,
  mailbox         TEXT,
  dossier_id      TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON audit_logs;
CREATE POLICY "Service role full access" ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
