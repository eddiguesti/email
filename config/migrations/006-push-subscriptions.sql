-- Migration 006: push_subscriptions table
-- Stores browser Web Push (VAPID) subscriptions per user.
-- Used by apps/worker to send notifications on email match / calendar suggestion.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,   -- lawyers.microsoft_id
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,   -- ECDH public key from PushSubscription
  auth        TEXT        NOT NULL,   -- Auth token from PushSubscription
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- RLS: service role has full access; no direct client access
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON push_subscriptions;
CREATE POLICY "Service role full access" ON push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
