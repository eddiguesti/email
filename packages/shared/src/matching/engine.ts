/**
 * Matching Engine
 * 8-tier email-to-dossier matching pipeline — the core of LB-BOT.
 *
 * Tiers (in descending reliability):
 *   0. Conversation threading (98%)
 *   1. Exact dossier reference (95%)
 *   2. RG number via KLEOS search (90%)
 *   3. Sender history (70-90%)
 *   4. Grok AI classifier — scoped then global (85-92%)
 *   5. Knowledge base party name matching (75-85%)
 *   6. Dossier name keyword match (60%)
 *   7. Fallback KLEOS search (40%)
 *   + Recipient boost, Lawyer boost, Firm admin dossier filter
 */

import type {
  MatchingEngineConfig,
  PipelineMatchResult,
  MatchSignals,
  MailboxOwner,
  KnowledgeBase,
  DossierKnowledge,
  AIClassifierConfig,
  KleosSearchFn,
  SenderHistoryEntry,
} from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalize, isBlockedName, fuzzyNameMatch } from './name-matching.js';
import { classifyWithAI } from './ai-classifier.js';
import { buildDossierIndex, resolveRecipientDossiers, getLawyer } from './knowledge-base.js';
import { KEYWORD_NOISE, COMMON_WORDS, FIRM_ADMIN_DOSSIER_REF } from './constants.js';
import {
  loadSenderHistoryFromDB,
  loadConversationThreadsFromDB,
  persistSenderHistory,
  persistConversationThread,
} from './supabase-persistence.js';

export class MatchingEngine {
  private kb: KnowledgeBase;
  private dossierById: Map<number, DossierKnowledge>;
  private aiConfig?: AIClassifierConfig;
  private supabase?: SupabaseClient;

  // In-memory state
  private conversationMatches = new Map<string, PipelineMatchResult>();
  private senderDossierHistory = new Map<string, SenderHistoryEntry[]>();

  constructor(config: MatchingEngineConfig) {
    this.kb = config.knowledgeBase;
    this.dossierById = buildDossierIndex(config.knowledgeBase);
    this.aiConfig = config.aiConfig;
    this.supabase = config.supabaseClient;
  }

  /**
   * Load persistent state from Supabase (sender history + conversation threads).
   * Call once at startup before processing emails.
   */
  async loadState(): Promise<void> {
    if (!this.supabase) return;

    const [senderMap, threadMap] = await Promise.all([
      loadSenderHistoryFromDB(this.supabase),
      loadConversationThreadsFromDB(this.supabase),
    ]);

    // Merge DB sender history into in-memory map
    for (const [email, entries] of senderMap) {
      this.senderDossierHistory.set(email, entries);
    }

    // Merge DB conversation threads into in-memory map
    for (const [convId, match] of threadMap) {
      this.conversationMatches.set(convId, match);
    }

    console.log(`  📦 Loaded ${senderMap.size} sender histories, ${threadMap.size} conversation threads from DB`);
  }

  /**
   * Update in-memory sender history after a successful match.
   */
  updateSenderHistory(senderEmail: string, match: PipelineMatchResult): void {
    const email = senderEmail.toLowerCase();
    if (!this.senderDossierHistory.has(email)) {
      this.senderDossierHistory.set(email, []);
    }
    const history = this.senderDossierHistory.get(email)!;
    const existing = history.find(h => h.dossierId === match.dossierId);
    if (existing) {
      existing.count++;
    } else {
      history.push({
        dossierId: match.dossierId,
        dossierRef: match.dossierRef,
        dossierName: match.dossierName,
        count: 1,
      });
    }
  }

  /**
   * Get sender history sorted by match count.
   */
  getSenderHistory(senderEmail: string): SenderHistoryEntry[] | null {
    const email = senderEmail.toLowerCase();
    const history = this.senderDossierHistory.get(email);
    if (!history || history.length === 0) return null;
    return [...history].sort((a, b) => b.count - a.count);
  }

  /**
   * Get the number of tracked conversation threads.
   */
  get conversationThreadCount(): number {
    return this.conversationMatches.size;
  }

  /**
   * Persist a match result to Supabase (sender history + conversation thread).
   */
  async persistMatch(
    match: PipelineMatchResult,
    senderEmail: string,
    conversationId?: string
  ): Promise<void> {
    if (!this.supabase) return;
    await persistSenderHistory(this.supabase, senderEmail, match);
    if (conversationId) {
      await persistConversationThread(this.supabase, conversationId, match);
    }
  }

  /**
   * THE CORE — 8-tier matching pipeline.
   * Returns top 3 matches sorted by confidence (descending).
   */
  async matchEmail(
    signals: MatchSignals,
    mailboxOwner: MailboxOwner | null,
    kleosSearchFn?: KleosSearchFn
  ): Promise<PipelineMatchResult[]> {
    const results: PipelineMatchResult[] = [];
    const seenIds = new Set<number>();
    const kb = this.kb;
    const dossierById = this.dossierById;

    const addResult = (r: PipelineMatchResult) => {
      if (seenIds.has(r.dossierId)) {
        const existing = results.find(x => x.dossierId === r.dossierId)!;
        existing.confidence = Math.min(existing.confidence + 0.05, 0.98);
        for (const reason of r.reasons) {
          if (existing.reasons.length < 3 && !existing.reasons.includes(reason)) {
            existing.reasons.push(reason);
          }
        }
        return;
      }
      seenIds.add(r.dossierId);
      results.push(r);
    };

    const resolveLawyer = (dossierId: number) => getLawyer(dossierId, dossierById);

    // Combine body text + attachment text for deeper matching
    const fullText = signals.attachmentText
      ? signals.bodyText + '\n' + signals.attachmentText
      : signals.bodyText;

    // ── TIER 0: Conversation threading — reuse previous match for same thread (98%) ──
    if (signals.conversationId && this.conversationMatches.has(signals.conversationId)) {
      const prev = this.conversationMatches.get(signals.conversationId)!;
      addResult({
        dossierId: prev.dossierId,
        dossierName: prev.dossierName,
        dossierRef: prev.dossierRef,
        confidence: 0.98,
        reasons: ['Same conversation thread → inherits match'],
        source: 'conversation_thread',
        lawyer: prev.lawyer,
      });
      // High confidence — return immediately
      return results;
    }

    // ── TIER 1: Exact dossier reference match (95%) ──
    for (const ref of signals.dossierRefs) {
      const match = kb.referenceToDossier[ref];
      if (match) {
        addResult({
          dossierId: match.dossierId,
          dossierName: match.dossierName,
          dossierRef: ref,
          confidence: 0.95,
          reasons: [`Dossier reference "${ref}" found in email`],
          source: 'reference_exact',
          lawyer: resolveLawyer(match.dossierId),
        });
      }
    }

    // ── TIER 2: RG number match via KLEOS API search (90%) ──
    if (kleosSearchFn) {
      for (const rg of signals.rgNumbers) {
        const cases = await kleosSearchFn(rg, 2);
        for (const c of cases) {
          addResult({
            dossierId: c.id,
            dossierName: c.name,
            dossierRef: c.reference,
            confidence: 0.90,
            reasons: [`RG number "${rg}" matches dossier`],
            source: 'rg_match',
            lawyer: resolveLawyer(c.id),
          });
        }
      }
    }

    // ── Early return if tiers 1-2 found a high-confidence match ──
    if (results.length > 0 && results[0].confidence >= 0.90) {
      if (signals.conversationId) this.conversationMatches.set(signals.conversationId, results[0]);
      results.sort((a, b) => b.confidence - a.confidence);
      return results.slice(0, 3);
    }

    // ── TIER 3: Sender history — repeat senders matched to same dossier (88%) ──
    const senderHist = this.getSenderHistory(signals.senderEmail);
    if (senderHist && senderHist[0].count >= 2) {
      const best = senderHist[0];
      const d = dossierById.get(best.dossierId);
      if (d) {
        addResult({
          dossierId: best.dossierId,
          dossierName: best.dossierName,
          dossierRef: best.dossierRef,
          confidence: Math.min(0.70 + best.count * 0.05, 0.84),
          reasons: [`Sender previously matched to this dossier (${best.count}x)`],
          source: 'sender_history',
          lawyer: resolveLawyer(best.dossierId),
        });
      }
    }

    // ── TIER 4: Grok PRIMARY classifier — picks from lawyer's dossier list (85%) ──
    const currentTopConf = results.length > 0 ? results[0].confidence : 0;
    if (currentTopConf < 0.85 && this.aiConfig?.apiKey) {
      // Scope to lawyer's dossiers when possible (much more accurate), fallback to top 300
      const isScoped = !!mailboxOwner;
      const candidateDossiers = mailboxOwner?.dossiers || kb.dossiers.slice(0, 300);

      // Use fullText (body + attachments) for AI classification, capped at 1500 chars
      const bodySnippet = fullText.slice(0, 1500);

      let classification = await classifyWithAI(
        signals.cleanSubject,
        signals.senderName,
        signals.senderEmail,
        bodySnippet,
        candidateDossiers,
        this.aiConfig,
        kb
      );

      // If scoped Grok found nothing, retry with ALL dossiers (email might belong to another lawyer's dossier)
      if (isScoped && (!classification || !classification.dossierRef)) {
        console.log('   🤖 Grok (scoped): no match — trying global fallback...');
        classification = await classifyWithAI(
          signals.cleanSubject,
          signals.senderName,
          signals.senderEmail,
          bodySnippet,
          kb.dossiers.slice(0, 300),
          this.aiConfig,
          kb
        );
      }

      if (classification && classification.dossierRef) {
        const match = kb.referenceToDossier[classification.dossierRef];
        if (match) {
          const scopeBoost = isScoped && mailboxOwner!.dossierIds.has(match.dossierId) ? 0.05 : 0;
          const aiConf = Math.min(classification.confidence + scopeBoost, 0.92);
          addResult({
            dossierId: match.dossierId,
            dossierName: match.dossierName,
            dossierRef: classification.dossierRef,
            confidence: aiConf,
            reasons: [`Grok: ${classification.reasoning}`],
            source: isScoped && mailboxOwner!.dossierIds.has(match.dossierId)
              ? 'ai_classifier_scoped'
              : 'ai_classifier_global',
            lawyer: resolveLawyer(match.dossierId),
          });
          console.log(`   🤖 Grok → [${classification.dossierRef}] (${(aiConf * 100).toFixed(0)}%) ${classification.reasoning.slice(0, 60)}`);
        }
      } else if (classification) {
        if (classification.error) {
          console.log(`   🤖 Grok: classifier error — ${classification.reasoning}`);
        } else {
          console.log(`   🤖 Grok: no match — ${classification.reasoning.slice(0, 60)}`);
        }
      }
    }

    // ── TIER 5: Known party name match from knowledge base (75-85%) ──
    // Check sender name, extracted entities, AND subject words against known parties
    const namesToCheck = [
      signals.senderName,
      ...signals.entities.filter(e => e.type === 'PERSON').map(e => e.value),
      ...signals.entities.filter(e => e.type === 'ORGANIZATION').map(e => e.value),
    ].filter(n => n && n.length > 2 && !isBlockedName(n));

    // Also extract potential party names from subject (words split by / - and spaces)
    const subjectParts = signals.cleanSubject
      .split(/[\/\-–—]/)
      .map(s => s.replace(/^\d+\s*/, '').trim())
      .filter(s => s.length > 3 && s.length < 60 && !/^\d+$/.test(s));
    for (const part of subjectParts) {
      if (!isBlockedName(part) && part.length < 50) {
        namesToCheck.push(part);
      }
      // Only extract individual words if the part looks like a party listing (not a sentence)
      if (part.split(/\s+/).length <= 6) {
        const words = part.split(/\s+/).filter(w => w.length > 4 && /^[A-ZÉÈÊËÀÂÔÛÙÏÎÇ]/.test(w));
        for (const w of words) {
          if (!isBlockedName(w)) namesToCheck.push(w);
        }
      }
    }

    // Extract company name from sender domain
    if (signals.senderDomain && !signals.senderDomain.endsWith('lbrosset.com') && !signals.senderDomain.endsWith('avocat-conseil.fr')) {
      const domainBase = signals.senderDomain.split('.')[0].toUpperCase();
      if (domainBase.length > 3 && !COMMON_WORDS.has(domainBase) && !isBlockedName(domainBase)) {
        namesToCheck.push(domainBase);
      }
    }

    // Deduplicate names
    const uniqueNames = [...new Set(namesToCheck.map(n => normalize(n)))];

    for (const normalized of uniqueNames) {
      // Exact match in knowledge base
      if (kb.partyNameToDossiers[normalized]) {
        const dossierList = kb.partyNameToDossiers[normalized];
        const isCommonParty = dossierList.length > 20;
        const commonDiscount = isCommonParty ? 0.5 : 1.0;

        for (const entry of dossierList.slice(0, isCommonParty ? 1 : 3)) {
          const d = dossierById.get(entry.dossierId);
          if (!d) continue;
          addResult({
            dossierId: entry.dossierId,
            dossierName: d.name,
            dossierRef: d.reference,
            confidence: entry.confidence * commonDiscount,
            reasons: [`Party "${normalized}" is a known party (${dossierList.length} dossiers)${isCommonParty ? ' — too common for reliable match' : ''}`],
            source: isCommonParty ? 'kb_party_common' : 'kb_party_exact',
            lawyer: resolveLawyer(entry.dossierId),
          });
        }
        continue; // Skip fuzzy if exact match found
      }

      // Fuzzy match — check against all party names
      const fuzzyMatches: Array<{ name: string; dossierId: number; dossierRef: string; confidence: number }> = [];
      for (const [partyName, dossierList] of Object.entries(kb.partyNameToDossiers)) {
        if (fuzzyNameMatch(normalized, partyName)) {
          for (const entry of dossierList.slice(0, 2)) {
            fuzzyMatches.push({
              name: partyName,
              dossierId: entry.dossierId,
              dossierRef: entry.dossierRef,
              confidence: entry.confidence * 0.85,
            });
          }
        }
        if (fuzzyMatches.length >= 5) break;
      }

      for (const fm of fuzzyMatches.slice(0, 3)) {
        const d = dossierById.get(fm.dossierId);
        if (!d) continue;
        addResult({
          dossierId: fm.dossierId,
          dossierName: d.name,
          dossierRef: d.reference,
          confidence: fm.confidence,
          reasons: [`"${normalized}" fuzzy-matches party "${fm.name}"`],
          source: 'kb_party_fuzzy',
          lawyer: resolveLawyer(fm.dossierId),
        });
      }
    }

    // ── TIER 6: Dossier name keyword match from subject (60%) ──
    // Only triggers when no results from previous tiers
    if (results.length === 0) {
      const subjectWords = normalize(signals.cleanSubject)
        .split(/\s+/)
        .filter(w => w.length > 5 && !KEYWORD_NOISE.has(w));
      for (const d of kb.dossiers) {
        const dossierWords = new Set(d.keywords);
        const overlap = subjectWords.filter(w => dossierWords.has(w));
        if (overlap.length >= 2) {
          addResult({
            dossierId: d.id,
            dossierName: d.name,
            dossierRef: d.reference,
            confidence: Math.min(0.3 + overlap.length * 0.15, 0.7),
            reasons: [`Keywords "${overlap.join(', ')}" match dossier name`],
            source: 'kb_keyword',
            lawyer: resolveLawyer(d.id),
          });
        }
        if (results.length >= 3) break;
      }
    }

    // ── TIER 7: Fallback KLEOS API search (40%) ──
    if (results.length === 0 && signals.cleanSubject.length > 10 && kleosSearchFn) {
      const skipWords = new Set(['objet', 'urgent', 'votre', 'notre', 'nous', 'vous', 'pour', 'avec', 'dans', 'les', 'des', 'une', 'par', 'bonjour', 'cordialement']);
      const words = signals.cleanSubject.split(/\s+/)
        .filter(w => w.length > 3 && !skipWords.has(w.toLowerCase()))
        .slice(0, 3);
      if (words.length > 0) {
        const cases = await kleosSearchFn(words.join(' '), 3);
        for (const c of cases) {
          addResult({
            dossierId: c.id,
            dossierName: c.name,
            dossierRef: c.reference,
            confidence: 0.4,
            reasons: [`Subject search "${words.join(' ')}" returned this dossier`],
            source: 'kleos_search',
            lawyer: resolveLawyer(c.id),
          });
        }
      }
    }

    // ── Recipient boost: if matched dossier belongs to a TO/CC lawyer ──
    if (signals.toRecipients && signals.toRecipients.length > 0) {
      const recipientDossiers = resolveRecipientDossiers(signals.toRecipients, kb);
      if (recipientDossiers.size > 0) {
        for (const r of results) {
          if (recipientDossiers.has(r.dossierId)) {
            r.confidence = Math.min(r.confidence + 0.05, 0.98);
            if (r.reasons.length < 3) r.reasons.push('Dossier matches a TO/CC lawyer');
          }
        }
      }
    }

    // ── Lawyer boost: if matched dossier is assigned to the mailbox owner ──
    if (mailboxOwner) {
      for (const r of results) {
        if (mailboxOwner.dossierIds.has(r.dossierId)) {
          r.confidence = Math.min(r.confidence + 0.05, 0.98);
          if (r.reasons.length < 3) r.reasons.push(`Dossier assigned to ${mailboxOwner.lawyerName}`);
        }
      }
    }

    // ── Filter out firm's own administrative dossier [202257] SELARL BROSSET TECHER ──
    const hasFirmRef = signals.dossierRefs.includes(FIRM_ADMIN_DOSSIER_REF);
    if (!hasFirmRef) {
      const nonFirmResults = results.filter(r => r.dossierRef !== FIRM_ADMIN_DOSSIER_REF);
      if (nonFirmResults.length > 0) {
        results.length = 0;
        results.push(...nonFirmResults);
      } else {
        // Firm dossier is the only match — cap confidence to prevent auto-filing
        for (const r of results) {
          if (r.dossierRef === FIRM_ADMIN_DOSSIER_REF) {
            r.confidence = Math.min(r.confidence, 0.50);
          }
        }
      }
    }

    // Store conversation match for threading future emails in same thread
    if (signals.conversationId && results.length > 0 && results[0].confidence >= 0.60) {
      this.conversationMatches.set(signals.conversationId, results[0]);
    }

    // Sort and return top 3
    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, 3);
  }
}
