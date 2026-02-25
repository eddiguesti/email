/**
 * Kleos API Types
 *
 * NOTE: These types are based on general document management patterns.
 * TODO: Update with actual Kleos API schema once documentation is available.
 */

export interface KleosDossier {
  id: string;
  reference: string; // RG number or internal reference
  name: string;
  description?: string;
  clientId: string;
  clientName: string;
  status: 'active' | 'archived' | 'closed';
  createdAt: string;
  updatedAt: string;

  // Belgian-specific fields
  jurisdiction?: string;
  courtReference?: string;
  opposingParty?: string;
  expertName?: string;

  // Contacts
  responsibleLawyer?: string;
  teamMembers?: string[];

  // Metadata
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface KleosDocument {
  id: string;
  dossierId: string;
  name: string;
  description?: string;
  documentType: KleosDocumentType;
  mimeType: string;
  size: number;

  // Source tracking
  sourceType: 'email' | 'attachment' | 'manual' | 'generated';
  sourceMessageId?: string;
  sourceEmailSubject?: string;
  sourceEmailDate?: string;
  sourceEmailSender?: string;

  // Storage
  storagePath?: string;
  contentHash: string;

  // Metadata
  createdAt: string;
  createdBy: string;
  tags?: string[];

  // Version control
  version: number;
  previousVersionId?: string;
}

export type KleosDocumentType =
  | 'email'
  | 'email_attachment'
  | 'correspondence_in'
  | 'correspondence_out'
  | 'court_document'
  | 'expert_report'
  | 'invoice'
  | 'contract'
  | 'memo'
  | 'other';

export interface KleosFolder {
  id: string;
  dossierId: string;
  name: string;
  parentFolderId?: string;
  path: string;
  documentCount: number;
  createdAt: string;
}

export interface KleosSearchQuery {
  query?: string;
  reference?: string;
  clientName?: string;
  status?: KleosDossier['status'];
  jurisdiction?: string;
  responsibleLawyer?: string;
  createdAfter?: string;
  createdBefore?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface KleosSearchResult {
  dossiers: KleosDossier[];
  total: number;
  hasMore: boolean;
}

export interface KleosCreateDocumentRequest {
  dossierId: string;
  name: string;
  description?: string;
  documentType: KleosDocumentType;
  folderId?: string;

  // File data
  file: {
    content: Buffer | string; // Buffer or base64
    mimeType: string;
    originalName: string;
  };

  // Source tracking
  sourceType: KleosDocument['sourceType'];
  sourceMessageId?: string;
  sourceEmailSubject?: string;
  sourceEmailDate?: string;
  sourceEmailSender?: string;

  // Idempotency
  contentHash: string;
  idempotencyKey: string;

  // Metadata
  tags?: string[];
}

export interface KleosCreateDocumentResponse {
  success: boolean;
  document?: KleosDocument;
  error?: string;
  alreadyExists?: boolean;
  existingDocumentId?: string;
}

export interface KleosCreateFolderRequest {
  dossierId: string;
  name: string;
  parentFolderId?: string;
}

export interface KleosClientConfig {
  baseUrl?: string;       // unused — API base is fixed to Wolters Kluwer cloud
  clientId?: string;      // KLEOS_CLIENT_ID (OAuth2 client credentials)
  clientSecret?: string;  // KLEOS_CLIENT_SECRET
  apiKey?: string;        // kept for backwards compatibility, not used
  authToken?: string;     // kept for backwards compatibility, not used
  timeout?: number;
  retryCount?: number;
}

// API response wrappers
export interface KleosApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Naming convention helper
export interface DocumentNamingParams {
  rgNumber?: string;
  dossierRef: string;
  date: string;
  documentType: string;
  sender?: string;
  subject: string;
}

/**
 * Generate Kleos-compliant document name
 * Format: [RG or dossierRef] - [YYYY-MM-DD] - [Type] - [Sender] - [SubjectShort]
 */
export function generateDocumentName(params: DocumentNamingParams): string {
  const ref = params.rgNumber || params.dossierRef;
  const date = params.date.split('T')[0]; // YYYY-MM-DD
  const sender = params.sender ? sanitizeFilename(params.sender).slice(0, 30) : '';
  const subject = sanitizeFilename(params.subject).slice(0, 50);

  const parts = [ref, date, params.documentType];
  if (sender) parts.push(sender);
  parts.push(subject);

  return parts.join(' - ') + getExtension(params.documentType);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExtension(docType: string): string {
  if (docType === 'email') return '.eml';
  return '';
}
