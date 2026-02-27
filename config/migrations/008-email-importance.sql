-- Migration 008: Add email_importance to match_logs
-- Stores the sender's importance flag (from MS Graph) and urgency keyword detection result.
-- Possible values: 'low' | 'normal' | 'high'
-- 'high' = sender pressed the Outlook "!" button OR subject contains urgency keywords.

ALTER TABLE match_logs
  ADD COLUMN IF NOT EXISTS email_importance TEXT DEFAULT 'normal';

-- Allow RLS service_role policy to cover the new column (no change needed — existing policy covers all columns)
-- Just add an index so we can efficiently filter urgent emails.
CREATE INDEX IF NOT EXISTS idx_match_logs_importance
  ON match_logs(email_importance, mailbox, created_at DESC)
  WHERE email_importance = 'high';
