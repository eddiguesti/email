/**
 * Supabase Persistence
 * Save/load match logs, sender history, conversation threads, and pipeline runs.
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineMatchResult, GraphEmailData, PipelineRunStats, SenderHistoryEntry } from './types.js';
import { classifyCategory, type CategoryInput } from './category-classifier.js';

/**
 * Hash subject for privacy — we never store raw email subjects in the database.
 */
export function hashSubject(subject: string): string {
  return createHash('sha256').update(subject).digest('hex').slice(0, 32);
}

/** French + English urgency keywords scanned in the subject line */
const URGENCY_KEYWORDS = [
  'urgent', 'urgence', 'urgente', 'urgentes', 'urgents',
  'important', 'importante', 'importants', 'importantes',
  'priorité', 'prioritaire', 'prioritaires',
  'immédiat', 'immédiate', 'immédiatement',
  'deadline', 'échéance', 'délai impératif',
  'réponse requise', 'réponse souhaitée', 'réponse attendue',
  'rappel', 'relance',
  'tribunal', 'audience', 'convocation', 'assignation',
  'mise en demeure', 'injonction',
];

/**
 * Detect urgency from Outlook importance flag and/or subject keywords.
 * Returns 'high' if the sender flagged it important OR the subject contains urgency signals.
 */
export function detectEmailImportance(
  importanceFlag: string | undefined,
  subject: string
): 'low' | 'normal' | 'high' {
  if (importanceFlag === 'high') return 'high';
  if (importanceFlag === 'low') return 'low';
  const lower = subject.toLowerCase();
  if (URGENCY_KEYWORDS.some(kw => lower.includes(kw))) return 'high';
  return 'normal';
}

/**
 * Save a match log to Supabase.
 */
export async function saveMatchLog(
  supabase: SupabaseClient,
  mailbox: string,
  email: GraphEmailData,
  match: PipelineMatchResult | null,
  action: string,
  isEBarreau: boolean,
  options?: { skipped?: boolean; hasSenderHistory?: boolean }
): Promise<void> {
  try {
    const from = email.from?.emailAddress?.address || '';

    // Classify category
    const categoryInput: CategoryInput = {
      matched: !!match,
      confidence: match?.confidence || null,
      isEBarreau,
      skipped: options?.skipped || action === 'skipped',
      hasSenderHistory: options?.hasSenderHistory ?? false,
    };
    const category = classifyCategory(categoryInput);

    const emailImportance = detectEmailImportance(email.importance, email.subject || '');

    await supabase.from('match_logs').upsert({
      mailbox,
      email_id: email.id,
      conversation_id: (email as any).conversationId || null,
      sender_email: from,
      sender_name: email.from?.emailAddress?.name || null,
      sender_domain: from.split('@')[1] || null,
      subject_hash: hashSubject(email.subject || ''),
      received_at: email.receivedDateTime || null,
      has_attachments: email.hasAttachments || false,
      is_ebarreau: isEBarreau,
      matched: !!match,
      dossier_id: match?.dossierId || null,
      dossier_ref: match?.dossierRef || null,
      dossier_name: match?.dossierName || null,
      confidence: match?.confidence || null,
      match_source: match?.source || null,
      match_reasons: match?.reasons || null,
      lawyer: match?.lawyer || null,
      action_taken: action,
      category_label: category.label,
      category_color: category.color,
      email_importance: emailImportance,
    }, { onConflict: 'email_id,mailbox' });
  } catch (err) {
    console.log(`  ⚠️  DB log failed: ${(err as Error).message?.slice(0, 60)}`);
  }
}

/**
 * Persist sender history update to Supabase via RPC.
 */
export async function persistSenderHistory(
  supabase: SupabaseClient,
  senderEmail: string,
  match: PipelineMatchResult
): Promise<void> {
  try {
    await supabase.rpc('upsert_sender_history', {
      p_sender_email: senderEmail.toLowerCase(),
      p_dossier_id: match.dossierId,
      p_dossier_ref: match.dossierRef,
      p_dossier_name: match.dossierName,
      p_confidence: match.confidence,
    });
  } catch {
    // Silent — non-critical
  }
}

/**
 * Persist conversation thread mapping to Supabase via RPC.
 */
export async function persistConversationThread(
  supabase: SupabaseClient,
  conversationId: string,
  match: PipelineMatchResult
): Promise<void> {
  try {
    await supabase.rpc('upsert_conversation_thread', {
      p_conversation_id: conversationId,
      p_dossier_id: match.dossierId,
      p_dossier_ref: match.dossierRef,
      p_dossier_name: match.dossierName,
      p_confidence: match.confidence,
      p_match_source: match.source,
      p_lawyer: match.lawyer,
    });
  } catch {
    // Silent — non-critical
  }
}

/**
 * Save pipeline run summary to Supabase.
 */
export async function savePipelineRun(
  supabase: SupabaseClient,
  mailbox: string,
  stats: PipelineRunStats,
  status: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('pipeline_runs').insert({
      mailbox,
      emails_fetched: stats.fetched,
      emails_skipped: stats.skipped,
      emails_processed: stats.processed,
      emails_matched: stats.matched,
      emails_auto_filed: stats.autoFile,
      emails_review: stats.review,
      emails_no_match: stats.noMatch,
      source_stats: stats.sourceStats,
      error_count: stats.errors.length,
      errors: stats.errors,
      status,
      finished_at: new Date().toISOString(),
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.log(`  ⚠️  Failed to save pipeline run: ${(err as Error).message?.slice(0, 60)}`);
    return null;
  }
}

/**
 * Load persistent sender history from Supabase into a Map.
 */
export async function loadSenderHistoryFromDB(
  supabase: SupabaseClient
): Promise<Map<string, SenderHistoryEntry[]>> {
  const map = new Map<string, SenderHistoryEntry[]>();
  try {
    const { data, error } = await supabase
      .from('sender_history')
      .select('sender_email, dossier_id, dossier_ref, dossier_name, match_count')
      .order('match_count', { ascending: false });
    if (error) throw error;
    if (!data) return map;

    for (const row of data) {
      const email = row.sender_email.toLowerCase();
      if (!map.has(email)) {
        map.set(email, []);
      }
      map.get(email)!.push({
        dossierId: row.dossier_id,
        dossierRef: row.dossier_ref,
        dossierName: row.dossier_name,
        count: row.match_count,
      });
    }
  } catch (err) {
    console.log(`  ⚠️  Failed to load sender history: ${(err as Error).message}`);
  }
  return map;
}

/**
 * Load persistent conversation threads from Supabase into a Map.
 * Only loads threads from the last 90 days to avoid stale matches.
 */
export async function loadConversationThreadsFromDB(
  supabase: SupabaseClient
): Promise<Map<string, PipelineMatchResult>> {
  const map = new Map<string, PipelineMatchResult>();
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('conversation_threads')
      .select('conversation_id, dossier_id, dossier_ref, dossier_name, confidence, match_source, lawyer')
      .gte('last_email_at', cutoff);
    if (error) throw error;
    if (!data) return map;

    for (const row of data) {
      map.set(row.conversation_id, {
        dossierId: row.dossier_id,
        dossierRef: row.dossier_ref,
        dossierName: row.dossier_name,
        confidence: row.confidence,
        reasons: ['Loaded from persistent thread history'],
        source: row.match_source || 'db_thread',
        lawyer: row.lawyer || 'N/A',
      });
    }
  } catch (err) {
    console.log(`  ⚠️  Failed to load conversation threads: ${(err as Error).message}`);
  }
  return map;
}
