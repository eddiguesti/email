-- ============================================================
-- Migration 007: Enable RLS on all tables missing it
-- Closes Supabase security advisory: "RLS Disabled in Public"
--
-- Uses IF EXISTS guards — safe to run regardless of which
-- earlier migrations have been applied in this environment.
--
-- Pattern used throughout this project:
--   All DB access is server-side via supabaseAdmin (service_role key).
--   Users authenticate via HMAC cookie + Microsoft OAuth — NOT via Supabase.
--   The anon/authenticated roles must have zero direct table access.
-- ============================================================

DO $$ BEGIN
  -- firms (flagged by Supabase advisor)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firms') THEN
    ALTER TABLE "public"."firms" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."firms";
    CREATE POLICY "Service role full access" ON "public"."firms"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- unpaid_invoices (migration 004)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unpaid_invoices') THEN
    ALTER TABLE "public"."unpaid_invoices" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."unpaid_invoices";
    CREATE POLICY "Service role full access" ON "public"."unpaid_invoices"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- reminder_history (migration 004)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_history') THEN
    ALTER TABLE "public"."reminder_history" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."reminder_history";
    CREATE POLICY "Service role full access" ON "public"."reminder_history"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- invoice_groups (migration 004)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_groups') THEN
    ALTER TABLE "public"."invoice_groups" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."invoice_groups";
    CREATE POLICY "Service role full access" ON "public"."invoice_groups"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- invoice_group_members (migration 004)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_group_members') THEN
    ALTER TABLE "public"."invoice_group_members" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."invoice_group_members";
    CREATE POLICY "Service role full access" ON "public"."invoice_group_members"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- reminder_templates (migration 004)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_templates') THEN
    ALTER TABLE "public"."reminder_templates" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."reminder_templates";
    CREATE POLICY "Service role full access" ON "public"."reminder_templates"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- security_audit_log (migration 005)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_audit_log') THEN
    ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON "public"."security_audit_log";
    CREATE POLICY "Service role full access" ON "public"."security_audit_log"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
