-- Migration 004: Unpaid Invoice Reminders System
-- Tables: unpaid_invoices, reminder_history, invoice_groups, invoice_group_members, reminder_templates

CREATE TABLE IF NOT EXISTS unpaid_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  client_reference VARCHAR(100),
  firm_reference VARCHAR(100),
  case_name VARCHAR(500),
  kleos_case_id INTEGER,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  client_salutation VARCHAR(100),
  kleos_identity_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending','reminded','paid','partial','contested','processing','written_off','legal'
  )),
  payment_received_at TIMESTAMP,
  payment_amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  contested BOOLEAN DEFAULT FALSE,
  contested_reason TEXT,
  contested_at TIMESTAMP,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP,
  next_reminder_at TIMESTAMP,
  phone_call_required BOOLEAN DEFAULT FALSE,
  phone_call_completed BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_from VARCHAR(255),
  import_batch_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES lawyers(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES lawyers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_unpaid_invoices_status ON unpaid_invoices(status);
CREATE INDEX IF NOT EXISTS idx_unpaid_invoices_next_reminder ON unpaid_invoices(next_reminder_at) WHERE status IN ('pending', 'reminded');
CREATE INDEX IF NOT EXISTS idx_unpaid_invoices_client ON unpaid_invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_unpaid_invoices_kleos_case ON unpaid_invoices(kleos_case_id) WHERE kleos_case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unpaid_invoices_invoice_number ON unpaid_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_unpaid_invoices_batch ON unpaid_invoices(import_batch_id);

CREATE TABLE IF NOT EXISTS reminder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES unpaid_invoices(id) ON DELETE CASCADE,
  reminder_number INTEGER NOT NULL,
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('email', 'phone', 'letter', 'sms')),
  sent_at TIMESTAMP DEFAULT NOW(),
  email_to VARCHAR(255),
  email_cc TEXT,
  email_bcc TEXT,
  email_subject VARCHAR(500),
  email_body TEXT,
  email_attachments TEXT,
  graph_message_id VARCHAR(255),
  phone_number VARCHAR(50),
  call_duration_minutes INTEGER,
  call_notes TEXT,
  call_result VARCHAR(50) CHECK (call_result IN (
    'answered','voicemail','no_answer','busy','wrong_number','callback_requested'
  )),
  callback_scheduled_at TIMESTAMP,
  response_received BOOLEAN DEFAULT FALSE,
  response_date TIMESTAMP,
  response_notes TEXT,
  payment_promise BOOLEAN DEFAULT FALSE,
  payment_promise_date DATE,
  payment_promise_amount DECIMAL(10,2),
  created_by UUID REFERENCES lawyers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_history_invoice ON reminder_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminder_history_sent ON reminder_history(sent_at DESC);

CREATE TABLE IF NOT EXISTS invoice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name VARCHAR(255),
  case_name VARCHAR(500),
  firm_reference VARCHAR(100),
  kleos_case_id INTEGER,
  primary_client_name VARCHAR(255),
  primary_client_email VARCHAR(255),
  additional_emails TEXT,
  total_invoices INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_group_members (
  group_id UUID REFERENCES invoice_groups(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES unpaid_invoices(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
    'first_reminder','second_reminder','urgent_reminder','final_reminder','grouped_reminder'
  )),
  language VARCHAR(5) DEFAULT 'fr',
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS for all tables created in this migration
ALTER TABLE unpaid_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON unpaid_invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE reminder_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON reminder_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE invoice_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON invoice_groups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE invoice_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON invoice_group_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON reminder_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
