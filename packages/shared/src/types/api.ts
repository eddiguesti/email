/**
 * API Types - Request/Response types for the REST API
 */

import type { ProcessingRecord, MatchResult, DraftInfo, AttachmentInfo, ThreadMapping } from './processing.js';
import type { KleosDossier } from './kleos.js';

// ============= Status Endpoint =============

export interface GetStatusRequest {
  messageId: string;
  mailbox: string;
}

export interface GetStatusResponse {
  found: boolean;
  record?: ProcessingRecord;
  suggestedDossier?: MatchResult;
  alternativeDossiers?: MatchResult[];
  attachments?: AttachmentInfo[];
  drafts?: DraftInfo[];
  canAutoFile: boolean;
  canAutoSend: boolean;
  autoSendBlocked?: string;
}

// ============= Approve Endpoint =============

export interface ApproveDossierRequest {
  messageId: string;
  mailbox: string;
  dossierId: string;
  dossierName: string;
  dossierRef: string;
  saveAsThreadDefault: boolean;
  userId?: string;
}

export interface ApproveDossierResponse {
  success: boolean;
  record?: ProcessingRecord;
  threadMappingSaved?: boolean;
  error?: string;
}

// ============= File Endpoint =============

export interface FileToKleosRequest {
  messageId: string;
  mailbox: string;
  dossierId: string;
  fileEmail: boolean;
  fileAttachments: string[]; // attachment IDs
  folderId?: string;
  generateDrafts?: boolean;
}

export interface FileToKleosResponse {
  success: boolean;
  emailDocumentId?: string;
  attachmentDocumentIds?: Record<string, string>;
  errors?: string[];
  draftsGenerated?: string[];
}

// ============= Draft Endpoints =============

export interface GenerateDraftsRequest {
  messageId: string;
  mailbox: string;
  draftTypes: DraftInfo['type'][];
  dossierId?: string;
  // Context supplied by the caller (from Kleos dossier / authenticated session)
  lawyerName?: string;
  clientName?: string;
  clientEmail?: string;
  invoiceNumber?: string;
  invoiceAmount?: string;
  invoiceDate?: string;
  dueDate?: string;
  daysPastDue?: number;
}

export interface GenerateDraftsResponse {
  success: boolean;
  drafts: DraftInfo[];
  errors?: string[];
}

export interface InsertDraftRequest {
  messageId: string;
  mailbox: string;
  draftId: string;
}

export interface InsertDraftResponse {
  success: boolean;
  outlookDraftId?: string;
  error?: string;
}

// ============= Search Endpoint =============

export interface SearchRequest {
  query: string;
  mailbox?: string;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    sender?: string;
    hasAttachments?: boolean;
    dossierId?: string;
    status?: ProcessingRecord['status'];
  };
  limit?: number;
  offset?: number;
}

export interface SearchResultItem {
  messageId: string;
  subject: string;
  sender: string;
  receivedAt: string;
  bodyPreview: string;
  attachmentNames: string[];
  dossierId?: string;
  dossierName?: string;
  confidence?: number;
  matchedOn: string[];
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  hasMore: boolean;
  query: string;
}

// ============= Chat Endpoint =============

export interface ChatRequest {
  query: string;
  mailbox: string;
  conversationId?: string;
  context?: {
    currentMessageId?: string;
    currentDossierId?: string;
  };
}

export interface ChatCitation {
  messageId: string;
  subject: string;
  sender: string;
  date: string;
  excerpt: string;
  attachmentName?: string;
  relevanceScore: number;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  hasResults: boolean;
  followUpQuestions?: string[];
  actions?: ChatAction[];
}

export interface ChatAction {
  type: 'view_email' | 'file_to_kleos' | 'generate_draft' | 'open_dossier';
  label: string;
  params: Record<string, string>;
}

// ============= Dossier Search =============

export interface DossierSearchRequest {
  query: string;
  limit?: number;
}

export interface DossierSearchResponse {
  dossiers: KleosDossier[];
  total: number;
}

// ============= Thread Mapping =============

export interface GetThreadMappingRequest {
  conversationId: string;
  mailbox: string;
}

export interface GetThreadMappingResponse {
  found: boolean;
  mapping?: ThreadMapping;
}

export interface SaveThreadMappingRequest {
  conversationId: string;
  mailbox: string;
  dossierId: string;
  dossierName: string;
  dossierRef: string;
  userId?: string;
}

// ============= Auto-Send Management =============

export interface CancelAutoSendRequest {
  messageId: string;
  mailbox: string;
  draftId: string;
  reason: string;
}

export interface CancelAutoSendResponse {
  success: boolean;
  wasPending: boolean;
  error?: string;
}

// ============= Webhook Types =============

export interface WebhookValidationRequest {
  validationToken: string;
}

export interface WebhookNotificationResponse {
  processed: number;
  errors: number;
  details?: string[];
}

// ============= Health & Admin =============

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  components: {
    graph: 'ok' | 'error';
    kleos: 'ok' | 'error';
    storage: 'ok' | 'error';
    queue: 'ok' | 'error';
  };
}

export interface SubscriptionStatus {
  id: string;
  resource: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'unknown';
}

export interface SubscriptionManageRequest {
  action: 'create' | 'renew' | 'delete' | 'list';
  mailbox?: string;
  subscriptionId?: string;
}

export interface SubscriptionManageResponse {
  success: boolean;
  subscription?: SubscriptionStatus;
  error?: string;
}
