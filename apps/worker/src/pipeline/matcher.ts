/**
 * Dossier Matcher (v2 — Shared 8-Tier Engine)
 * Wraps the shared MatchingEngine for the Azure Functions worker pipeline.
 * Replaces the old 4-level matcher with the full 8-tier matching engine.
 */

import {
  StorageClient,
  KleosClient,
  type ProcessingRecord,
  type MatchResult,
} from '@lb-bot/shared';
import {
  MatchingEngine,
  shouldSkipEmail,
  resolveMailboxOwner,
  extractRgNumbers,
  extractDossierRefs,
  extractEntities,
  analyzeEmail,
  stripHtml,
  stripSignature,
  parseEBarreau,
  getMeaningfulEBarreauParties,
  saveMatchLog,
  hashSubject,
  type KnowledgeBase,
  type MatchSignals,
  type PipelineMatchResult,
  type AIClassifierConfig,
} from '@lb-bot/shared/matching';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MatchingResult {
  success: boolean;
  results: MatchResult[];
  autoApproved: boolean;
  skipped?: boolean;
  error?: string;
}

const AUTO_APPROVE_THRESHOLD = 0.85;
const REVIEW_THRESHOLD = 0.50;

export class DossierMatcher {
  private engine: MatchingEngine;
  private kb: KnowledgeBase;
  private engineReady = false;

  constructor(
    private storageClient: StorageClient,
    private kleosClient: KleosClient,
    private supabase: SupabaseClient | undefined,
    kb: KnowledgeBase,
    aiConfig?: AIClassifierConfig
  ) {
    this.kb = kb;
    this.engine = new MatchingEngine({
      knowledgeBase: kb,
      aiConfig,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabaseClient: supabase as any,
    });
  }

  /**
   * Load persistent state (sender history + conversation threads).
   * Call once at worker startup.
   */
  async initialize(): Promise<void> {
    if (this.engineReady) return;
    await this.engine.loadState();
    this.engineReady = true;
  }

  /**
   * Match email to dossiers using the 8-tier shared engine.
   */
  async match(record: ProcessingRecord): Promise<MatchingResult> {
    try {
      // Ensure engine is initialized
      await this.initialize();

      // Update status
      record.status = 'MATCHING';
      record.timestamps.lastUpdated = new Date().toISOString();
      await this.storageClient.upsertProcessingRecord(record);

      const signals = record.extractedSignals;
      if (!signals) {
        throw new Error('No extracted signals available');
      }

      // Check if email should be skipped (spam, newsletters, system notifications)
      if (shouldSkipEmail(signals.senderEmail, signals.subject)) {
        record.status = 'SKIPPED';
        record.timestamps.lastUpdated = new Date().toISOString();
        record.auditTrail.push({
          action: 'EMAIL_SKIPPED',
          timestamp: new Date().toISOString(),
          success: true,
          details: { reason: 'Skip filter: spam/newsletter/system' },
        });
        await this.storageClient.upsertProcessingRecord(record);
        return { success: true, results: [], autoApproved: false, skipped: true };
      }

      // Resolve mailbox owner for lawyer scoping
      const mailboxOwner = resolveMailboxOwner(record.mailbox, this.kb);

      // Build MatchSignals from the worker's ExtractedSignals
      const bodyText = signals.bodyPreview || '';
      const fullText = `${signals.subject}\n${bodyText}`;

      // Use the shared extractors for richer extraction
      const rgNumbers = [
        ...signals.rgNumbers,
        ...extractRgNumbers(fullText).filter(rg => !signals.rgNumbers.includes(rg)),
      ];
      const dossierRefs = extractDossierRefs(fullText, this.kb);
      const entities = extractEntities(fullText);
      const { cleanSubject } = analyzeEmail(signals.subject);

      // Aggregate attachment text
      let attachmentText = '';
      for (const att of record.attachments) {
        if (att.extractedText) {
          attachmentText += `\n--- ${att.name} ---\n${att.extractedText}`;
        }
      }

      const matchSignals: MatchSignals = {
        rgNumbers,
        dossierRefs,
        entities: [
          ...entities,
          ...signals.entities
            .filter(e => ['PERSON', 'ORGANIZATION'].includes(e.type))
            .map(e => ({ type: e.type, value: e.value })),
        ],
        senderEmail: signals.senderEmail,
        senderName: '', // Worker doesn't always have sender name — engine handles empty
        senderDomain: signals.senderDomain,
        cleanSubject,
        bodyText: bodyText.slice(0, 2000),
        attachmentText: attachmentText.slice(0, 5000) || undefined,
        conversationId: record.conversationId || undefined,
      };

      // Create KLEOS search callback
      const kleosSearchFn = async (query: string, max = 3) => {
        try {
          const result = await this.kleosClient.searchDossiers({ query, limit: max });
          if (result.success && result.data?.dossiers) {
            return result.data.dossiers.map(d => ({
              id: typeof d.id === 'number' ? d.id : parseInt(d.id, 10),
              name: d.name,
              reference: d.reference,
            }));
          }
        } catch { /* silent */ }
        return [];
      };

      // Run the 8-tier matching engine
      const pipelineResults = await this.engine.matchEmail(matchSignals, mailboxOwner, kleosSearchFn);

      // Guard against AI returning a ref that was not in the candidate list passed to it.
      // The hallucination check in ai-classifier.ts validates against the full KB, so a ref that
      // exists in the KB but was outside the candidate window (e.g. another lawyer's dossier when
      // scoped) would pass that check but is still an invalid result here.
      const candidateDossiers = mailboxOwner?.dossiers || this.kb.dossiers.slice(0, 300);
      const candidateRefSet = new Set(candidateDossiers.map(d => d.reference));
      const validatedPipelineResults = pipelineResults.filter(pr => {
        const isAiSource = pr.source === 'ai_classifier_scoped' || pr.source === 'ai_classifier_global';
        if (isAiSource && pr.dossierRef && !candidateRefSet.has(pr.dossierRef)) {
          console.warn(`[matcher] AI returned ref "${pr.dossierRef}" not in candidate list — discarded`);
          return false;
        }
        return true;
      });

      // Convert PipelineMatchResult (dossierId: number) to MatchResult (dossierId: string)
      const results: MatchResult[] = validatedPipelineResults.map(pr => ({
        dossierId: String(pr.dossierId),
        dossierName: pr.dossierName,
        dossierRef: pr.dossierRef,
        confidence: pr.confidence,
        reasons: pr.reasons,
        source: pr.source as MatchResult['source'],
        lawyer: pr.lawyer,
      }));

      // Persist match results (use the validated list so a discarded AI result is not persisted)
      if (validatedPipelineResults.length > 0 && validatedPipelineResults[0].confidence >= 0.60) {
        this.engine.updateSenderHistory(signals.senderEmail, validatedPipelineResults[0]);
        await this.engine.persistMatch(
          validatedPipelineResults[0],
          signals.senderEmail,
          record.conversationId || undefined
        );
      }

      // Determine auto-approval
      const autoApproved = results.length > 0 && results[0].confidence >= AUTO_APPROVE_THRESHOLD;

      // Determine next status — READ-ONLY: stop at MATCHED or READY_FOR_REVIEW
      let nextStatus: ProcessingRecord['status'];
      if (results.length === 0) {
        nextStatus = 'READY_FOR_REVIEW';
      } else if (autoApproved) {
        nextStatus = 'MATCHED'; // READ-ONLY: don't advance to READY_TO_FILE
      } else {
        nextStatus = 'READY_FOR_REVIEW';
      }

      // Update record
      record.matchResults = results;
      record.status = nextStatus;
      record.timestamps.matched = new Date().toISOString();
      record.timestamps.lastUpdated = new Date().toISOString();

      if (autoApproved && results[0]) {
        record.chosenDossierId = results[0].dossierId;
        record.chosenDossierName = results[0].dossierName;
      }

      record.auditTrail.push({
        action: 'DOSSIERS_MATCHED',
        timestamp: new Date().toISOString(),
        success: true,
        details: {
          matchCount: results.length,
          topConfidence: results[0]?.confidence,
          autoApproved,
          sources: [...new Set(results.map(r => r.source))],
          engineVersion: 'v2-shared-8tier',
        },
      });

      await this.storageClient.upsertProcessingRecord(record);

      return { success: true, results, autoApproved };
    } catch (error) {
      console.error('Error matching dossiers:', error);

      record.status = 'ERROR_RETRYABLE';
      record.retryCount++;
      record.timestamps.lastUpdated = new Date().toISOString();
      record.auditTrail.push({
        action: 'DOSSIER_MATCHING_FAILED',
        timestamp: new Date().toISOString(),
        success: false,
        error: String(error),
      });

      await this.storageClient.upsertProcessingRecord(record);

      return { success: false, results: [], autoApproved: false, error: String(error) };
    }
  }
}
