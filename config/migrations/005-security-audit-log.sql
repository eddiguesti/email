-- Migration 005: Security Audit Log
-- Tracks security-relevant events (login attempts, token issues, suspicious activity)

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_lawyer ON security_audit_log(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON security_audit_log(created_at DESC);
