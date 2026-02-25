/**
 * DRY-RUN PIPELINE TEST v3 (Shared Matching Engine)
 *
 * Now uses the shared matching engine from @lb-bot/shared/matching.
 * All matching logic lives in packages/shared/src/matching/ for reuse by:
 *   - This dry-run script (testing)
 *   - The Azure Functions worker (production)
 *
 * 8-tier matching:
 *   0. Conversation threading (98%)
 *   1. Exact dossier reference (95%)
 *   2. RG number via KLEOS API (90%)
 *   3. Sender history (70-90%)
 *   4. Grok AI classifier — scoped then global (85-92%)
 *   5. Knowledge base party matching (exact + fuzzy) (75-85%)
 *   6. Dossier name keyword match (60%)
 *   7. Fallback KLEOS search (40%)
 *   + Recipient boost, Lawyer boost, Firm admin filter
 *
 * Usage:
 *   set -a && source config/.env && set +a && tsx config/scripts/dry-run-pipeline.ts [mailbox] [count]
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shared matching engine imports
import {
  MatchingEngine,
  loadKnowledgeBase,
  resolveMailboxOwner,
  shouldSkipEmail,
  parseEBarreau,
  getMeaningfulEBarreauParties,
  extractRgNumbers,
  extractDossierRefs,
  extractEntities,
  analyzeEmail,
  stripHtml,
  stripSignature,
  hashSubject,
  savePipelineRun,
  classifyCategory,
  type KnowledgeBase,
  type MatchSignals,
  type PipelineMatchResult,
  type GraphEmailData,
  type CategoryInput,
} from '@lb-bot/shared/matching';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============= CONFIG =============

const GRAPH_TENANT = process.env.AZURE_TENANT_ID;
const GRAPH_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const GRAPH_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

const KLEOS_CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const KLEOS_CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const KLEOS_API_BASE = 'https://kleosapp.api.wolterskluwer.cloud';
const KLEOS_TOKEN_URL = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_MODEL = 'grok-4-1-fast-reasoning';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const KNOWLEDGE_FILE = join(__dirname, '..', 'kleos-knowledge.json');

const DEFAULT_MAILBOX = 'cabinet@lbrosset.com';
const DEFAULT_COUNT = 10;
const MAX_EMAIL_COUNT = 200;

// ============= SUPABASE CLIENT =============

let supabase: SupabaseClient | null = null;

function initSupabase(): boolean {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('  ⚠️  Supabase not configured — running without persistence');
    return false;
  }
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return true;
  } catch (err) {
    console.log(`  ⚠️  Supabase init failed: ${(err as Error).message}`);
    return false;
  }
}

// ============= SUPABASE MATCH LOG (dry-run specific wrapper) =============

async function saveMatchLog(
  mailbox: string,
  email: GraphMessage,
  match: PipelineMatchResult | null,
  action: string,
  isEBarreau: boolean,
  options?: { skipped?: boolean; hasSenderHistory?: boolean }
): Promise<void> {
  if (!supabase) return;
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

    await supabase.from('match_logs').upsert({
      mailbox,
      email_id: email.id,
      conversation_id: email.conversationId || null,
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
    }, { onConflict: 'email_id,mailbox' });
  } catch (err) {
    console.log(`  ⚠️  DB log failed: ${(err as Error).message?.slice(0, 60)}`);
  }
}

// ============= AUTH =============

async function getGraphToken(): Promise<string> {
  if (!GRAPH_TENANT || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    throw new Error('Missing Azure AD credentials');
  }
  const resp = await fetch(
    `https://login.microsoftonline.com/${GRAPH_TENANT}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: GRAPH_CLIENT_ID,
        client_secret: GRAPH_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!resp.ok) throw new Error(`Graph auth failed: ${await resp.text()}`);
  return ((await resp.json()) as { access_token: string }).access_token;
}

async function getKleosToken(): Promise<string> {
  if (!KLEOS_CLIENT_ID || !KLEOS_CLIENT_SECRET) {
    throw new Error('Missing KLEOS credentials');
  }
  const resp = await fetch(KLEOS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: KLEOS_CLIENT_ID,
      client_secret: KLEOS_CLIENT_SECRET,
      scope: 'kleosStateful kleosLegal kleosLegalApiClient',
    }),
  });
  if (!resp.ok) throw new Error(`Kleos auth failed: ${await resp.text()}`);
  return ((await resp.json()) as { access_token: string }).access_token;
}

// ============= GRAPH API =============

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  ccRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  conversationId: string;
}

async function fetchEmails(token: string, mailbox: string, count: number): Promise<GraphMessage[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?` +
    `$top=${count}&$select=id,subject,receivedDateTime,hasAttachments,bodyPreview,body,from,toRecipients,ccRecipients,conversationId` +
    `&$orderby=receivedDateTime desc`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Graph error for ${mailbox}: ${await resp.text()}`);
  return ((await resp.json()) as { value: GraphMessage[] }).value || [];
}

// ============= KLEOS API (search callback for matching engine) =============

async function searchKleos(token: string, query: string, max = 3): Promise<Array<{ id: number; name: string; reference: string }>> {
  const resp = await fetch(
    `${KLEOS_API_BASE}/api/cases?search=${encodeURIComponent(query)}&currentPage=1&pageSize=${max}&onlyOpen=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return [];
  const data = await resp.json() as { result: { items: Array<{ id: number; name: string; reference: string }> } };
  return data.result?.items || [];
}

// ============= DISPLAY =============

function confidenceBar(c: number): string {
  const filled = Math.round(c * 20);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  if (c >= 0.85) return `🟢 ${bar} ${(c * 100).toFixed(0)}% AUTO-FILE`;
  if (c >= 0.60) return `🟡 ${bar} ${(c * 100).toFixed(0)}% REVIEW`;
  if (c >= 0.40) return `🟠 ${bar} ${(c * 100).toFixed(0)}% LOW`;
  return `🔴 ${bar} ${(c * 100).toFixed(0)}% VERY LOW`;
}

// ============= MAIN =============

async function main() {
  const targetMailbox = process.argv[2] || DEFAULT_MAILBOX;
  const rawCount = parseInt(process.argv[3] || String(DEFAULT_COUNT), 10);
  const emailCount = Math.min(Math.max(isNaN(rawCount) ? DEFAULT_COUNT : rawCount, 1), MAX_EMAIL_COUNT);

  console.log('\n' + '='.repeat(80));
  console.log('  LB-BOT DRY-RUN PIPELINE v3 (Shared Matching Engine)');
  console.log('  READ-ONLY — nothing will be filed to KLEOS');
  console.log('='.repeat(80));
  console.log('  Features: Conversation threading | Sender history | Grok classifier');
  console.log('            Lawyer narrowing | Recipient boost | Persistent learning');

  // Load knowledge base from shared module
  console.log('\n🧠 Loading knowledge base...');
  const kb = loadKnowledgeBase(KNOWLEDGE_FILE);
  console.log(`  ✅ ${kb.totalDossiers} dossiers, ${Object.keys(kb.partyNameToDossiers).length} party names loaded`);
  console.log(`  Generated: ${kb.generatedAt}`);

  // Initialize Supabase for persistent storage
  console.log('\n💾 Connecting to Supabase...');
  const hasSupabase = initSupabase();
  if (hasSupabase) {
    console.log('  ✅ Supabase connected');
  }

  // Create the matching engine
  const engine = new MatchingEngine({
    knowledgeBase: kb,
    aiConfig: XAI_API_KEY ? {
      apiKey: XAI_API_KEY,
      apiUrl: XAI_API_URL,
      model: XAI_MODEL,
    } : undefined,
    supabaseClient: supabase || undefined,
  });

  // Load persistent state (sender history + conversation threads)
  if (hasSupabase) {
    await engine.loadState();
  }

  // Resolve mailbox owner → lawyer → their assigned dossiers
  const mailboxOwner = resolveMailboxOwner(targetMailbox, kb);
  if (mailboxOwner) {
    console.log(`  👤 Mailbox owner: ${mailboxOwner.lawyerName} (${mailboxOwner.dossiers.length} dossiers)`);
  } else {
    console.log(`  👤 Mailbox owner: Not resolved (shared mailbox — using all ${kb.totalDossiers} dossiers)`);
  }

  // Auth
  console.log('\n📡 Authenticating...');
  const graphToken = await getGraphToken();
  console.log('  ✅ Microsoft Graph');
  const kleosToken = await getKleosToken();
  console.log('  ✅ KLEOS API');

  // Create KLEOS search callback for the engine
  const kleosSearchFn = (query: string, max?: number) => searchKleos(kleosToken, query, max);

  // Fetch emails
  console.log(`\n📬 Fetching ${emailCount} emails from ${targetMailbox}...`);
  const emails = await fetchEmails(graphToken, targetMailbox, emailCount);
  console.log(`  ✅ Got ${emails.length} emails\n`);

  // Stats
  let totalEmails = 0;
  let totalSkipped = 0;
  let totalMatched = 0;
  let totalAutoFile = 0;
  let totalReview = 0;
  let totalNoMatch = 0;
  const sourceStats: Record<string, number> = {};
  const seenConversations = new Set<string>();
  const dbPromises: Promise<void>[] = [];

  // Process each email
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    const from = email.from?.emailAddress?.address || '?';
    const fromName = email.from?.emailAddress?.name || '';
    const date = email.receivedDateTime?.slice(0, 16) || '?';
    const subject = email.subject || '(no subject)';

    // Skip system/notification emails
    if (shouldSkipEmail(from, subject)) {
      totalSkipped++;
      console.log(`${'─'.repeat(80)}`);
      console.log(`⏭️  SKIP ${i + 1}/${emails.length}: ${subject.slice(0, 60)} [${from.split('@')[1]}]`);
      continue;
    }

    // Deduplicate by conversation (keep first of each thread)
    if (email.conversationId && seenConversations.has(email.conversationId)) {
      totalSkipped++;
      console.log(`${'─'.repeat(80)}`);
      console.log(`⏭️  DEDUP ${i + 1}/${emails.length}: ${subject.slice(0, 60)} [same thread]`);
      continue;
    }
    if (email.conversationId) seenConversations.add(email.conversationId);

    totalEmails++;

    const rawBody = email.body?.contentType === 'html'
      ? stripHtml(email.body.content)
      : (email.body?.content || email.bodyPreview || '');
    const bodyText = stripSignature(rawBody);
    const fullText = `${subject}\n${bodyText}`;

    // Extract signals using shared extractors
    const rgNumbers = extractRgNumbers(fullText);
    const dossierRefs = extractDossierRefs(fullText, kb);
    const entities = extractEntities(fullText);
    const { isReply, isForward, cleanSubject } = analyzeEmail(subject);
    const senderDomain = from.split('@')[1] || '';

    // Parse e-Barreau structured messages
    const eBarreau = parseEBarreau(subject, bodyText);
    if (eBarreau.isEBarreau) {
      const meaningfulParties = getMeaningfulEBarreauParties(eBarreau);
      if (meaningfulParties.length === 0 && eBarreau.rgNumbers.length === 0 && dossierRefs.length === 0) {
        totalSkipped++;
        console.log(`${'─'.repeat(80)}`);
        console.log(`⏭️  SKIP ${i + 1}/${emails.length}: ${subject.slice(0, 60)} [e-Barreau procedural]`);
        continue;
      }
      // Add e-Barreau parties as entities
      for (const party of meaningfulParties) {
        entities.push({ type: 'ORGANIZATION', value: party.toUpperCase() });
      }
      // Add e-Barreau RG numbers
      for (const rg of eBarreau.rgNumbers) {
        if (!rgNumbers.includes(rg)) rgNumbers.push(rg);
      }
    }

    // Extract "c/" party pattern from subject
    const cSlashMatch = cleanSubject.match(/([A-ZÉÈÊËÀÂÔÛÙÏÎÇ][A-Za-zéèêëàâôûùïîç\s\-&'.]+?)\s+[cC]\/\s+([A-ZÉÈÊËÀÂÔÛÙÏÎÇ][A-Za-zéèêëàâôûùïîç\s\-&'.]+?)(?:\s*[-–—]|$)/);
    if (cSlashMatch) {
      const [, partyA, partyB] = cSlashMatch;
      if (partyA.trim().length > 3) entities.push({ type: 'ORGANIZATION', value: partyA.trim().toUpperCase() });
      if (partyB.trim().length > 3) entities.push({ type: 'ORGANIZATION', value: partyB.trim().toUpperCase() });
    }

    console.log(`${'─'.repeat(80)}`);
    console.log(`📧 EMAIL ${i + 1}/${emails.length}`);
    console.log(`   Date:      ${date}`);
    console.log(`   From:      ${fromName} <${from}>`);
    console.log(`   Subject:   ${subject.slice(0, 75)}`);
    console.log(`   Attach:    ${email.hasAttachments ? 'Yes' : 'No'} | Reply: ${isReply} | Fwd: ${isForward}${eBarreau.isEBarreau ? ' | e-Barreau' : ''}`);

    if (rgNumbers.length > 0) console.log(`   🔢 RG:      ${rgNumbers.join(', ')}`);
    if (dossierRefs.length > 0) console.log(`   📁 Refs:    ${dossierRefs.join(', ')}`);
    if (entities.length > 0) console.log(`   👤 Entities: ${entities.map(e => e.value).slice(0, 5).join(', ')}`);
    if (eBarreau.parties.length > 0) console.log(`   ⚖️  e-Barreau parties: ${eBarreau.parties.join(' / ')}`);

    // Build match signals
    const signals: MatchSignals = {
      rgNumbers,
      dossierRefs,
      entities,
      senderEmail: from,
      senderName: fromName,
      senderDomain,
      cleanSubject,
      bodyText: bodyText.slice(0, 2000),
      conversationId: email.conversationId,
      toRecipients: [...(email.toRecipients || []), ...(email.ccRecipients || [])],
    };

    // Match using shared engine
    const matches = await engine.matchEmail(signals, mailboxOwner, kleosSearchFn);

    const hasSenderHistory = !!engine.getSenderHistory(from);

    if (matches.length === 0) {
      console.log(`   ❌ NO MATCH — manual review queue`);
      totalNoMatch++;
      dbPromises.push(saveMatchLog(targetMailbox, email, null, 'dry_run', eBarreau.isEBarreau, { hasSenderHistory }));
    } else {
      totalMatched++;
      // Update sender history + persist
      if (matches[0].confidence >= 0.60) {
        engine.updateSenderHistory(from, matches[0]);
        dbPromises.push(engine.persistMatch(matches[0], from, email.conversationId));
      }
      const topConf = matches[0].confidence;
      if (topConf >= 0.85) totalAutoFile++;
      else totalReview++;

      // Log match to Supabase
      dbPromises.push(saveMatchLog(targetMailbox, email, matches[0], 'dry_run', eBarreau.isEBarreau, { hasSenderHistory }));

      for (let j = 0; j < matches.length; j++) {
        const m = matches[j];
        sourceStats[m.source] = (sourceStats[m.source] || 0) + 1;
        console.log(`   ${j === 0 ? '📁' : '   '} Match ${j + 1}: ${confidenceBar(m.confidence)}`);
        console.log(`      Dossier: [${m.dossierRef}] ${m.dossierName.slice(0, 55)}`);
        console.log(`      Lawyer:  ${m.lawyer}`);
        console.log(`      Why:     ${m.reasons[0]}`);
        if (m.reasons.length > 1) {
          for (const r of m.reasons.slice(1)) {
            console.log(`               + ${r}`);
          }
        }
      }
    }
    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('  RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Fetched:                ${emails.length} emails`);
  console.log(`  Skipped (system/dedup): ${totalSkipped}`);
  console.log(`  Processed:              ${totalEmails}`);
  console.log(`  Matched:                ${totalMatched}/${totalEmails} (${totalEmails ? Math.round((totalMatched / totalEmails) * 100) : 0}%)`);
  console.log(`  Would auto-file (≥85%): ${totalAutoFile} 🟢`);
  console.log(`  Would need review:      ${totalReview} 🟡`);
  console.log(`  No match:               ${totalNoMatch} ❌`);

  if (Object.keys(sourceStats).length > 0) {
    console.log(`\n  Match sources:`);
    for (const [source, count] of Object.entries(sourceStats).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${source}: ${count} matches`);
    }
  }

  if (engine.conversationThreadCount > 0) {
    console.log(`\n  Threading: ${engine.conversationThreadCount} conversation threads tracked`);
  }

  // Await all DB writes before saving pipeline run summary
  if (dbPromises.length > 0) {
    const results = await Promise.allSettled(dbPromises);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.log(`  ⚠️  ${failed.length}/${dbPromises.length} DB writes failed`);
    }
  }

  // Save pipeline run to Supabase
  if (supabase) {
    const runId = await savePipelineRun(supabase, targetMailbox, {
      fetched: emails.length,
      skipped: totalSkipped,
      processed: totalEmails,
      matched: totalMatched,
      autoFile: totalAutoFile,
      review: totalReview,
      noMatch: totalNoMatch,
      sourceStats,
      errors: [],
    }, 'completed');
    if (runId) {
      console.log(`\n  💾 Pipeline run saved to Supabase (${runId.slice(0, 8)}...)`);
    }
  }

  console.log(`\n  ⚠️  DRY RUN — nothing was filed to KLEOS\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message || err);
  process.exit(1);
});
