-- Migration 009: Reminder Settings
CREATE TABLE IF NOT EXISTS reminder_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  first_reminder_days INTEGER DEFAULT 14 NOT NULL,
  second_reminder_days INTEGER DEFAULT 14 NOT NULL,
  third_reminder_days INTEGER DEFAULT 7 NOT NULL,
  subsequent_reminder_days INTEGER DEFAULT 7 NOT NULL,
  final_reminder_days INTEGER DEFAULT 30 NOT NULL,
  phone_call_after_reminder INTEGER DEFAULT 3 NOT NULL,
  escalate_to_partner_after INTEGER DEFAULT 4 NOT NULL,
  legal_action_after_days INTEGER DEFAULT 90 NOT NULL,
  auto_send_enabled BOOLEAN DEFAULT false NOT NULL,
  send_time TEXT DEFAULT '09:00' NOT NULL,
  send_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  always_cc_emails TEXT,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  signature TEXT,
  updated_by UUID REFERENCES lawyers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reminder_settings_active ON reminder_settings(is_active);

ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON reminder_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
