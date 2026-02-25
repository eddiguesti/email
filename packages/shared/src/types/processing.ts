/**
 * Processing Types - Core state machine and data models
 */

export type ProcessingStatus =
  | 'RECEIVED'
  | 'FETCHING'
  | 'FETCHED'
  | 'EXTRACTING'
  | 'EXTRACTED'
  | 'MATCHING'
  | 'MATCHED'
  | 'SKIPPED'
  | 'READY_FOR_REVIEW'
  | 'READY_TO_FILE'
  | 'FILING'
  | 'FILED'
  | 'DONE'
  | 'ERROR_RETRYABLE'
  | 'ERROR_FATAL';

export type MatchSource =
  | 'thread_memory'
  | 'rg_match'
  | 'sender_hint'
  | 'entity_overlap'
  | 'conversation_thread'
  | 'reference_exact'
  | 'sender_history'
  | 'ai_classifier_scoped'
  | 'ai_classifier_global'
  | 'kb_party_exact'
  | 'kb_party_common'
  | 'kb_party_fuzzy'
  | 'kb_keyword'
  | 'kleos_search';

export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'JURISDICTION'
  | 'DATE'
  | 'MONEY'
  | 'RG_NUMBER'
  | 'CASE_NUMBER'
  | 'CLIENT_NAME'
  | 'EXPERT_NAME';

export interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
  position?: { start: number; end: number };
}

export interface ExtractedSignals {
  rgNumbers: string[];
  entities: Entity[];
  dates: string[];
  senderDomain: string;
  senderEmail: string;
  recipientEmails: string[];
  subject: string;
  bodyPreview: string;
  bodyHash: string;
  hasAttachments: boolean;
  attachmentCount: number;
  isReply: boolean;
  isForward: boolean;
  threadPosition: number;
  language?: string;
  attachmentText?: string;
}

export interface MatchResult {
  dossierId: string;
  dossierName: string;
  dossierRef: string;
  confidence: number;
  reasons: string[];
  source: MatchSource;
  lawyer?: string;
}

export interface AttachmentInfo {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentHash?: string;
  extractedText?: string;
  needsOcr: boolean;
  filed: boolean;
  filedAt?: string;
  kleosDocumentId?: string;
}

export interface DraftInfo {
  id: string;
  type: 'reply' | 'client_transmittal' | 'fee_reminder_1' | 'fee_reminder_2' | 'fee_reminder_final' | 'leave_acknowledgement';
  subject: string;
  body: string;
  to: string[];
  cc?: string[];
  createdAt: string;
  insertedAt?: string;
  sentAt?: string;
}

export interface ActionLog {
  action: string;
  timestamp: string;
  success: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export interface ProcessingActions {
  filedEmail: boolean;
  filedEmailAt?: string;
  kleosEmailDocId?: string;
  filedAttachments: string[];
  draftsCreated: string[];
  autoSendScheduled?: string;
  autoSendCancelledAt?: string;
  autoSent: boolean;
  autoSentAt?: string;
  errors: ActionLog[];
}

export interface ProcessingTimestamps {
  received: string;
  fetched?: string;
  extracted?: string;
  matched?: string;
  filed?: string;
  completed?: string;
  lastUpdated: string;
}

export interface ProcessingRecord {
  // Azure Table keys
  partitionKey: string; // mailbox
  rowKey: string; // messageId

  // Core identifiers
  messageId: string;
  internetMessageId: string;
  conversationId: string;
  mailbox: string;
  tenantId: string;

  // State
  status: ProcessingStatus;
  retryCount: number;
  maxRetries: number;

  // Extracted data
  extractedSignals?: ExtractedSignals;
  attachments: AttachmentInfo[];

  // Matching
  matchResults: MatchResult[];
  chosenDossierId?: string;
  chosenDossierName?: string;
  userApproved: boolean;
  userApprovedAt?: string;
  userApprovedBy?: string;

  // Actions
  actions: ProcessingActions;

  // Timestamps
  timestamps: ProcessingTimestamps;

  // Idempotency
  idempotencyKey: string;

  // Audit
  auditTrail: ActionLog[];
}

export interface ThreadMapping {
  partitionKey: string; // mailbox
  rowKey: string; // conversationId

  conversationId: string;
  mailbox: string;
  dossierId: string;
  dossierName: string;
  dossierRef: string;

  validatedBy: 'user' | 'system';
  validatedAt: string;
  validatedByUser?: string;

  confidence: number;
  emailCount: number;
  lastEmailAt: string;
}

export interface AuditLogEntry {
  partitionKey: string; // YYYY-MM-DD
  rowKey: string; // timestamp-uuid

  timestamp: string;
  action: string;
  actor: 'system' | 'user';
  actorId?: string;

  messageId?: string;
  conversationId?: string;
  dossierId?: string;
  mailbox?: string;

  details: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

// Queue message types
export interface EmailProcessJob {
  tenantId: string;
  mailbox: string;
  messageId: string;
  subscriptionId: string;
  receivedAt: string;
  idempotencyKey: string;
  retryCount?: number;
}

export interface AutoSendJob {
  messageId: string;
  mailbox: string;
  draftId: string;
  draftType: DraftInfo['type'];
  scheduledFor: string;
  cancellable: boolean;
  reason: string;
  idempotencyKey: string;
}

// Policy configuration
export interface AutoSendPolicy {
  enabled: boolean;
  allowedDraftTypes: DraftInfo['type'][];
  requireKnownThread: boolean;
  requirePreviousReply: boolean;
  minConfidence: number;
  delayMinutes: number;
  blockedDomains: string[];
  allowedDomains?: string[];
}

export interface MatchingPolicy {
  autoApproveThreshold: number;
  requireReviewThreshold: number;
  useThreadMemory: boolean;
  useSenderHints: boolean;
  useEntityOverlap: boolean;
}
