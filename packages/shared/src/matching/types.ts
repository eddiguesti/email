/**
 * Matching Engine Types
 * Types for the 8-tier email-to-dossier matching pipeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============= Knowledge Base =============

export interface DossierKnowledge {
  id: number;
  reference: string;
  name: string;
  type: string;
  parties: Array<{ role: string; roleLabel: string; name: string; identityId: number }>;
  lawyers: Array<{ role: string; roleLabel: string; name: string; memberId: number }>;
  keywords: string[];
}

export interface KnowledgeBase {
  generatedAt: string;
  totalDossiers: number;
  dossiers: DossierKnowledge[];
  partyNameToDossiers: Record<string, Array<{ dossierId: number; dossierRef: string; confidence: number }>>;
  referenceToDossier: Record<string, { dossierId: number; dossierName: string }>;
  lawyerToDossiers: Record<string, number[]>;
}

// ============= Matching =============

export interface PipelineMatchResult {
  dossierId: number;
  dossierName: string;
  dossierRef: string;
  confidence: number;
  reasons: string[];
  source: string;
  lawyer: string;
}

export interface MailboxOwner {
  lawyerName: string;
  dossierIds: Set<number>;
  dossiers: DossierKnowledge[];
}

export interface MatchSignals {
  rgNumbers: string[];
  dossierRefs: string[];
  entities: Array<{ type: string; value: string }>;
  senderEmail: string;
  senderName: string;
  senderDomain: string;
  cleanSubject: string;
  bodyText: string;
  attachmentText?: string;
  conversationId?: string;
  toRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
}

// ============= e-Barreau =============

export interface EBarreauData {
  isEBarreau: boolean;
  parties: string[];
  rgNumbers: string[];
  messageType: string;
}

// ============= AI Classifier =============

export interface AIClassifierConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

export interface AIClassification {
  dossierRef: string | null;
  confidence: number;
  reasoning: string;
}

export interface AIExtraction {
  parties: string[];
  caseType: string;
  addresses: string[];
  suggestedDossierRef: string | null;
  confidence: number;
}

// ============= Engine Configuration =============

export interface MatchingEngineConfig {
  knowledgeBase: KnowledgeBase;
  aiConfig?: AIClassifierConfig;
  supabaseClient?: SupabaseClient;
}

export type KleosSearchFn = (query: string, max?: number) => Promise<Array<{ id: number; name: string; reference: string }>>;

// ============= Supabase Persistence =============

export interface GraphEmailData {
  id: string;
  subject: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  bodyPreview: string;
  from: { emailAddress: { name: string; address: string } };
  conversationId?: string;
}

export interface PipelineRunStats {
  fetched: number;
  skipped: number;
  processed: number;
  matched: number;
  autoFile: number;
  review: number;
  noMatch: number;
  sourceStats: Record<string, number>;
  errors: string[];
}

export interface SenderHistoryEntry {
  dossierId: number;
  dossierRef: string;
  dossierName: string;
  count: number;
}
