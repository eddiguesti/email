-- ============================================================
-- FIX: Scope RLS policies to service_role only
-- Run this in Supabase SQL Editor to close the security gap
-- where the anon key could access all tables.
-- ============================================================

-- Drop the old overly-permissive policies
DROP POLICY IF EXISTS "Service role full access" ON match_logs;
DROP POLICY IF EXISTS "Service role full access" ON sender_history;
DROP POLICY IF EXISTS "Service role full access" ON conversation_threads;
DROP POLICY IF EXISTS "Service role full access" ON skip_domains;
DROP POLICY IF EXISTS "Service role full access" ON pipeline_runs;

-- Recreate with TO service_role — blocks anon key completely
CREATE POLICY "Service role full access" ON match_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sender_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON conversation_threads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON skip_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pipeline_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
