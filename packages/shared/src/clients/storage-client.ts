/**
 * Supabase Storage Client (Hybrid Setup)
 * Uses PostgreSQL for state management, Azure Blob for attachments
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import type {
  ProcessingRecord,
  ThreadMapping,
  AuditLogEntry,
  DraftInfo,
} from '../types/processing.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';

// Database types for Supabase
export interface DbProcessingRecord {
  id: string;
  message_id: string;
  mailbox: string;
  status: string;
  status_history: Array<{ status: string; timestamp: string }>;
  subject: string | null;
  sender: string | null;
  recipients: string[];
  received_at: string | null;
  thread_id: string | null;
  conversation_id: string | null;
  extracted_rg_numbers: string[];
  extracted_entities: Record<string, unknown>;
  match_result: Record<string, unknown> | null;
  matched_dossier_id: string | null;
  match_confidence: number | null;
  match_method: string | null;
  kleos_document_id: string | null;
  filed_at: string | null;
  idempotency_key: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbThreadMapping {
  id: string;
  thread_id: string;
  mailbox: string;
  dossier_id: string;
  dossier_name: string | null;
  confidence: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDraft {
  id: string;
  message_id: string;
  mailbox: string;
  template_type: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  language: string;
  dossier_id: string | null;
  dossier_name: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  auto_send_enabled: boolean;
  scheduled_send_at: string | null;
  send_job_id: string | null;
  safety_checks: Record<string, unknown>;
  confidence_score: number | null;
  graph_draft_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id: string | null;
  details: Record<string, unknown>;
  mailbox: string | null;
  dossier_id: string | null;
  created_at: string;
}

export interface DbAttachment {
  id: string;
  message_id: string;
  name: string;
  content_type: string | null;
  size_bytes: number | null;
  blob_url: string;
  blob_path: string;
  kleos_document_id: string | null;
  filed_at: string | null;
  content_hash: string | null;
  created_at: string;
}

export interface DbSenderHint {
  id: string;
  sender_email: string;
  sender_domain: string;
  dossier_id: string;
  dossier_name: string | null;
  hit_count: number;
  last_hit_at: string;
  created_at: string;
}

export interface DbUser {
  id: string;
  microsoft_id: string;
  email: string;
  display_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  is_active: boolean;
  last_login_at: string | null;
  graph_subscription_id: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

export interface StorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
  blobConnectionString?: string;
  blobContainerName?: string;
}

export class StorageClient {
  private supabase: SupabaseClient;
  private blobContainer: ContainerClient | null = null;

  constructor(config: StorageConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);

    if (config.blobConnectionString) {
      const blobService = BlobServiceClient.fromConnectionString(config.blobConnectionString);
      this.blobContainer = blobService.getContainerClient(
        config.blobContainerName || 'attachments'
      );
    }
  }

  /**
   * Initialize (create blob container if needed)
   */
  async initialize(): Promise<void> {
    if (this.blobContainer) {
      await this.blobContainer.createIfNotExists();
    }
  }

  // ============= Processing Records =============

  /**
   * Create or update a processing record
   */
  async upsertProcessingRecord(record: ProcessingRecord): Promise<void> {
    const dbRecord = this.recordToDb(record);

    const { error } = await this.supabase
      .from('processing_records')
      .upsert(dbRecord, { onConflict: 'message_id' });

    if (error) throw new Error(`Failed to upsert processing record: ${error.message}`);
  }

  /**
   * Get a processing record by message ID
   */
  async getProcessingRecord(
    mailbox: string,
    messageId: string
  ): Promise<ProcessingRecord | null> {
    const { data, error } = await this.supabase
      .from('processing_records')
      .select('*')
      .eq('message_id', messageId)
      .eq('mailbox', mailbox)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get processing record: ${error.message}`);
    }

    return this.dbToRecord(data as DbProcessingRecord);
  }

  /**
   * Get processing record by message ID only (any mailbox)
   */
  async getProcessingRecordByMessageId(messageId: string): Promise<ProcessingRecord | null> {
    const { data, error } = await this.supabase
      .from('processing_records')
      .select('*')
      .eq('message_id', messageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get processing record: ${error.message}`);
    }

    return this.dbToRecord(data as DbProcessingRecord);
  }

  /**
   * Check if a processing record exists (for idempotency)
   */
  async recordExists(mailbox: string, messageId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('processing_records')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId)
      .eq('mailbox', mailbox);

    if (error) throw new Error(`Failed to check record: ${error.message}`);
    return (count ?? 0) > 0;
  }

  /**
   * Update processing record status
   */
  async updateStatus(
    mailbox: string,
    messageId: string,
    status: ProcessingRecord['status'],
    additionalUpdates?: Partial<ProcessingRecord>
  ): Promise<void> {
    // Build status history entry
    const { data: existing } = await this.supabase
      .from('processing_records')
      .select('status_history')
      .eq('message_id', messageId)
      .eq('mailbox', mailbox)
      .single();

    const statusHistory = (existing?.status_history as Array<{ status: string; timestamp: string }>) || [];
    statusHistory.push({ status, timestamp: new Date().toISOString() });

    const updates: Record<string, unknown> = {
      status,
      status_history: statusHistory,
      updated_at: new Date().toISOString(),
    };

    // Map additional updates
    if (additionalUpdates) {
      if (additionalUpdates.matchResults) {
        updates.match_result = additionalUpdates.matchResults[0] || null;
        updates.match_confidence = additionalUpdates.matchResults[0]?.confidence;
        updates.match_method = additionalUpdates.matchResults[0]?.source;
      }
      if (additionalUpdates.chosenDossierId) {
        updates.matched_dossier_id = additionalUpdates.chosenDossierId;
      }
      if (additionalUpdates.extractedSignals) {
        updates.extracted_rg_numbers = additionalUpdates.extractedSignals.rgNumbers || [];
        updates.extracted_entities = additionalUpdates.extractedSignals;
      }
      if (additionalUpdates.retryCount !== undefined) {
        updates.retry_count = additionalUpdates.retryCount;
      }
    }

    const { error } = await this.supabase
      .from('processing_records')
      .update(updates)
      .eq('message_id', messageId)
      .eq('mailbox', mailbox);

    if (error) throw new Error(`Failed to update status: ${error.message}`);
  }

  /**
   * Get records by status
   */
  async getRecordsByStatus(
    status: ProcessingRecord['status'],
    mailbox?: string,
    limit = 100
  ): Promise<ProcessingRecord[]> {
    let query = this.supabase
      .from('processing_records')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (mailbox) {
      query = query.eq('mailbox', mailbox);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get records by status: ${error.message}`);
    return (data as DbProcessingRecord[]).map((r) => this.dbToRecord(r));
  }

  /**
   * Get records pending review (for add-in)
   */
  async getRecordsPendingReview(mailbox: string, limit = 50): Promise<ProcessingRecord[]> {
    const { data, error } = await this.supabase
      .from('processing_records')
      .select('*')
      .eq('mailbox', mailbox)
      .in('status', ['READY_FOR_REVIEW', 'MATCHED', 'EXTRACTED'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get pending records: ${error.message}`);
    return (data as DbProcessingRecord[]).map((r) => this.dbToRecord(r));
  }

  /**
   * Search processing records (for chat)
   */
  async searchRecords(
    mailbox: string,
    query: string,
    limit = 20
  ): Promise<ProcessingRecord[]> {
    const { data, error } = await this.supabase
      .from('processing_records')
      .select('*')
      .eq('mailbox', mailbox)
      .or(`subject.ilike.%${query}%,sender.ilike.%${query}%`)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to search records: ${error.message}`);
    return (data as DbProcessingRecord[]).map((r) => this.dbToRecord(r));
  }

  // ============= Thread Mappings =============

  /**
   * Get thread mapping for a conversation
   */
  async getThreadMapping(
    mailbox: string,
    threadId: string
  ): Promise<ThreadMapping | null> {
    const { data, error } = await this.supabase
      .from('thread_mappings')
      .select('*')
      .eq('thread_id', threadId)
      .eq('mailbox', mailbox)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get thread mapping: ${error.message}`);
    }

    return this.dbToThreadMapping(data as DbThreadMapping);
  }

  /**
   * Save or update thread mapping
   */
  async saveThreadMapping(mapping: ThreadMapping): Promise<void> {
    const dbMapping = {
      thread_id: mapping.conversationId,
      mailbox: mapping.mailbox,
      dossier_id: mapping.dossierId,
      dossier_name: mapping.dossierName,
      confidence: mapping.confidence,
      source: mapping.validatedBy,
    };

    const { error } = await this.supabase
      .from('thread_mappings')
      .upsert(dbMapping, { onConflict: 'thread_id,mailbox' });

    if (error) throw new Error(`Failed to save thread mapping: ${error.message}`);
  }

  /**
   * Get all mappings for a dossier (for sender hints)
   */
  async getMappingsByDossier(dossierId: string): Promise<ThreadMapping[]> {
    const { data, error } = await this.supabase
      .from('thread_mappings')
      .select('*')
      .eq('dossier_id', dossierId);

    if (error) throw new Error(`Failed to get mappings by dossier: ${error.message}`);
    return (data as DbThreadMapping[]).map((m) => this.dbToThreadMapping(m));
  }

  // ============= Sender Hints =============

  /**
   * Get sender hints by email or domain
   */
  async getSenderHints(senderEmail: string): Promise<Array<{ dossierId: string; dossierName: string; hitCount: number }>> {
    const domain = senderEmail.split('@')[1];

    const { data, error } = await this.supabase
      .from('sender_hints')
      .select('*')
      .or(`sender_email.eq.${senderEmail},sender_domain.eq.${domain}`)
      .order('hit_count', { ascending: false })
      .limit(10);

    if (error) throw new Error(`Failed to get sender hints: ${error.message}`);

    return (data as DbSenderHint[]).map((h) => ({
      dossierId: h.dossier_id,
      dossierName: h.dossier_name || '',
      hitCount: h.hit_count,
    }));
  }

  /**
   * Record a sender → dossier association
   */
  async recordSenderHint(
    senderEmail: string,
    dossierId: string,
    dossierName: string
  ): Promise<void> {
    const domain = senderEmail.split('@')[1];

    // Try to increment existing or insert new
    const { data: existing } = await this.supabase
      .from('sender_hints')
      .select('id, hit_count')
      .eq('sender_email', senderEmail)
      .eq('dossier_id', dossierId)
      .single();

    if (existing) {
      await this.supabase
        .from('sender_hints')
        .update({
          hit_count: existing.hit_count + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await this.supabase.from('sender_hints').insert({
        sender_email: senderEmail,
        sender_domain: domain,
        dossier_id: dossierId,
        dossier_name: dossierName,
      });
    }
  }

  // ============= Audit Log =============

  /**
   * Write an audit log entry
   */
  async writeAuditLog(entry: Omit<AuditLogEntry, 'partitionKey' | 'rowKey'>): Promise<void> {
    const dbEntry = {
      action: entry.action,
      entity_type: entry.messageId ? 'email' : 'system',
      entity_id: entry.messageId || entry.conversationId || 'unknown',
      actor_type: entry.actor,
      actor_id: entry.actorId,
      details: entry.details,
      mailbox: entry.mailbox,
      dossier_id: entry.dossierId,
    };

    const { error } = await this.supabase.from('audit_logs').insert(dbEntry);
    if (error) throw new Error(`Failed to write audit log: ${error.message}`);
  }

  /**
   * Query audit logs by date range
   */
  async queryAuditLogs(
    startDate: string,
    endDate: string,
    filters?: { messageId?: string; action?: string; actor?: string }
  ): Promise<AuditLogEntry[]> {
    let query = this.supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (filters?.messageId) {
      query = query.eq('entity_id', filters.messageId);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.actor) {
      query = query.eq('actor_type', filters.actor);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to query audit logs: ${error.message}`);

    return (data as DbAuditLog[]).map((log) => ({
      partitionKey: log.created_at.split('T')[0],
      rowKey: log.id,
      timestamp: log.created_at,
      action: log.action,
      actor: log.actor_type as 'system' | 'user',
      actorId: log.actor_id || undefined,
      messageId: log.entity_type === 'email' ? log.entity_id : undefined,
      conversationId: undefined,
      dossierId: log.dossier_id || undefined,
      mailbox: log.mailbox || undefined,
      details: log.details,
      success: true,
      errorMessage: undefined,
    }));
  }

  // ============= Drafts =============

  /**
   * Save a draft
   */
  async saveDraft(messageId: string, draft: DraftInfo, mailbox: string): Promise<void> {
    const dbDraft = {
      message_id: messageId,
      mailbox,
      template_type: draft.type,
      subject: draft.subject,
      body_html: draft.body,
      body_text: draft.body.replace(/<[^>]*>/g, ''), // Strip HTML
      language: 'fr',
      status: 'pending',
    };

    const { error } = await this.supabase.from('drafts').insert(dbDraft);
    if (error) throw new Error(`Failed to save draft: ${error.message}`);
  }

  /**
   * Get drafts for a message
   */
  async getDrafts(messageId: string): Promise<DraftInfo[]> {
    const { data, error } = await this.supabase
      .from('drafts')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get drafts: ${error.message}`);

    return (data as DbDraft[]).map((d) => ({
      id: d.id,
      type: d.template_type as DraftInfo['type'],
      subject: d.subject,
      body: d.body_html,
      to: [], // Would need to be stored separately
      cc: [],
      createdAt: d.created_at,
      insertedAt: d.graph_draft_id ? d.updated_at : undefined,
      sentAt: d.sent_at || undefined,
    }));
  }

  /**
   * Update draft status
   */
  async updateDraft(
    messageId: string,
    draftId: string,
    updates: Partial<DraftInfo>
  ): Promise<void> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.sentAt) {
      dbUpdates.sent_at = updates.sentAt;
      dbUpdates.status = 'sent';
    }
    if (updates.insertedAt) {
      dbUpdates.graph_draft_id = 'inserted';
    }

    const { error } = await this.supabase
      .from('drafts')
      .update(dbUpdates)
      .eq('id', draftId);

    if (error) throw new Error(`Failed to update draft: ${error.message}`);
  }

  /**
   * Get drafts pending auto-send
   */
  async getDraftsPendingAutoSend(): Promise<DbDraft[]> {
    const { data, error } = await this.supabase
      .from('drafts')
      .select('*')
      .eq('auto_send_enabled', true)
      .eq('status', 'pending')
      .lte('scheduled_send_at', new Date().toISOString());

    if (error) throw new Error(`Failed to get pending auto-send drafts: ${error.message}`);
    return data as DbDraft[];
  }

  /**
   * Schedule a draft for auto-send
   */
  async scheduleDraftAutoSend(
    draftId: string,
    scheduledAt: Date,
    jobId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('drafts')
      .update({
        auto_send_enabled: true,
        scheduled_send_at: scheduledAt.toISOString(),
        send_job_id: jobId,
      })
      .eq('id', draftId);

    if (error) throw new Error(`Failed to schedule auto-send: ${error.message}`);
  }

  /**
   * Cancel auto-send for a draft
   */
  async cancelDraftAutoSend(draftId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('drafts')
      .select('send_job_id')
      .eq('id', draftId)
      .single();

    const jobId = data?.send_job_id;

    await this.supabase
      .from('drafts')
      .update({
        auto_send_enabled: false,
        scheduled_send_at: null,
        send_job_id: null,
      })
      .eq('id', draftId);

    return jobId || null;
  }

  // ============= Attachments =============

  /**
   * Save attachment metadata
   */
  async saveAttachmentMetadata(
    messageId: string,
    attachment: {
      name: string;
      contentType: string;
      sizeBytes: number;
      blobUrl: string;
      blobPath: string;
      contentHash?: string;
    }
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('attachments')
      .insert({
        message_id: messageId,
        name: attachment.name,
        content_type: attachment.contentType,
        size_bytes: attachment.sizeBytes,
        blob_url: attachment.blobUrl,
        blob_path: attachment.blobPath,
        content_hash: attachment.contentHash,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to save attachment metadata: ${error.message}`);
    return data.id;
  }

  /**
   * Get attachments for a message
   */
  async getAttachments(messageId: string): Promise<DbAttachment[]> {
    const { data, error } = await this.supabase
      .from('attachments')
      .select('*')
      .eq('message_id', messageId);

    if (error) throw new Error(`Failed to get attachments: ${error.message}`);
    return data as DbAttachment[];
  }

  /**
   * Check if attachment exists by content hash (deduplication)
   */
  async getAttachmentByHash(contentHash: string): Promise<DbAttachment | null> {
    const { data, error } = await this.supabase
      .from('attachments')
      .select('*')
      .eq('content_hash', contentHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to check attachment hash: ${error.message}`);
    }
    return data as DbAttachment;
  }

  // ============= Blob Storage =============

  /**
   * Upload attachment to blob storage
   */
  async uploadAttachment(
    messageId: string,
    attachmentId: string,
    content: Buffer,
    contentType: string
  ): Promise<string> {
    if (!this.blobContainer) {
      throw new Error('Blob storage not configured');
    }

    const blobName = `${messageId}/${attachmentId}`;
    const blockBlob = this.blobContainer.getBlockBlobClient(blobName);

    await blockBlob.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    return blockBlob.url;
  }

  /**
   * Download attachment from blob storage
   */
  async downloadAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    if (!this.blobContainer) {
      throw new Error('Blob storage not configured');
    }

    const blobName = `${messageId}/${attachmentId}`;
    const blockBlob = this.blobContainer.getBlockBlobClient(blobName);

    const response = await blockBlob.download();
    const chunks: Buffer[] = [];

    for await (const chunk of response.readableStreamBody!) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Check if attachment exists in blob storage
   */
  async attachmentExists(messageId: string, attachmentId: string): Promise<boolean> {
    if (!this.blobContainer) return false;

    const blobName = `${messageId}/${attachmentId}`;
    const blockBlob = this.blobContainer.getBlockBlobClient(blobName);
    return blockBlob.exists();
  }

  /**
   * Upload email as .eml file
   */
  async uploadEmailEml(
    messageId: string,
    emlContent: string
  ): Promise<string> {
    if (!this.blobContainer) {
      throw new Error('Blob storage not configured');
    }

    const blobName = `emails/${messageId}.eml`;
    const blockBlob = this.blobContainer.getBlockBlobClient(blobName);
    const buffer = Buffer.from(emlContent, 'utf-8');

    await blockBlob.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: 'message/rfc822' },
    });

    return blockBlob.url;
  }

  // ============= Lawyers (OAuth) =============

  /**
   * Get user by Microsoft ID
   */
  async getUserByMicrosoftId(microsoftId: string): Promise<DbUser | null> {
    const { data, error } = await this.supabase
      .from('lawyers')
      .select('*')
      .eq('microsoft_id', microsoftId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data as DbUser;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<DbUser | null> {
    const { data, error } = await this.supabase
      .from('lawyers')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data as DbUser;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<DbUser | null> {
    const { data, error } = await this.supabase
      .from('lawyers')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data as DbUser;
  }

  /**
   * Create or update a user with OAuth tokens
   */
  async upsertUser(
    microsoftId: string,
    email: string,
    displayName: string,
    tokens: UserTokens
  ): Promise<DbUser> {
    // Encrypt tokens before storing (if encryption is enabled)
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    const { data, error } = await this.supabase
      .from('lawyers')
      .upsert(
        {
          microsoft_id: microsoftId,
          email: email.toLowerCase(),
          display_name: displayName,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          scopes: tokens.scopes,
          is_active: true,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'microsoft_id' }
      )
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert user: ${error.message}`);
    return data as DbUser;
  }

  /**
   * Update user tokens (after refresh)
   */
  async updateUserTokens(userId: string, tokens: UserTokens): Promise<void> {
    // Encrypt tokens before storing (if encryption is enabled)
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    const { error } = await this.supabase
      .from('lawyers')
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt.toISOString(),
        scopes: tokens.scopes,
      })
      .eq('id', userId);

    if (error) throw new Error(`Failed to update user tokens: ${error.message}`);
  }

  /**
   * Update user's Graph subscription
   */
  async updateUserSubscription(
    userId: string,
    subscriptionId: string,
    expiresAt: Date
  ): Promise<void> {
    const { error } = await this.supabase
      .from('lawyers')
      .update({
        graph_subscription_id: subscriptionId,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);

    if (error) throw new Error(`Failed to update subscription: ${error.message}`);
  }

  /**
   * Clear user's Graph subscription
   */
  async clearUserSubscription(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lawyers')
      .update({
        graph_subscription_id: null,
        subscription_expires_at: null,
      })
      .eq('id', userId);

    if (error) throw new Error(`Failed to clear subscription: ${error.message}`);
  }

  /**
   * Get all active users
   */
  async getActiveUsers(): Promise<DbUser[]> {
    const { data, error } = await this.supabase
      .from('lawyers')
      .select('*')
      .eq('is_active', true);

    if (error) throw new Error(`Failed to get active users: ${error.message}`);
    return data as DbUser[];
  }

  /**
   * Get users with expiring subscriptions (for renewal)
   */
  async getUsersWithExpiringSubscriptions(withinMinutes: number): Promise<DbUser[]> {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() + withinMinutes);

    const { data, error } = await this.supabase
      .from('lawyers')
      .select('*')
      .eq('is_active', true)
      .not('graph_subscription_id', 'is', null)
      .lte('subscription_expires_at', threshold.toISOString());

    if (error) throw new Error(`Failed to get expiring subscriptions: ${error.message}`);
    return data as DbUser[];
  }

  /**
   * Get users with expiring tokens (for proactive refresh)
   */
  async getUsersWithExpiringTokens(withinMinutes: number): Promise<DbUser[]> {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() + withinMinutes);

    const { data, error } = await this.supabase
      .from('lawyers')
      .select('*')
      .eq('is_active', true)
      .not('refresh_token', 'is', null)
      .lte('token_expires_at', threshold.toISOString());

    if (error) throw new Error(`Failed to get expiring tokens: ${error.message}`);
    return data as DbUser[];
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lawyers')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        graph_subscription_id: null,
        subscription_expires_at: null,
      })
      .eq('id', userId);

    if (error) throw new Error(`Failed to deactivate user: ${error.message}`);
  }

  // ============= Helpers =============

  private recordToDb(record: ProcessingRecord): Record<string, unknown> {
    return {
      message_id: record.messageId,
      mailbox: record.mailbox,
      status: record.status,
      status_history: [{ status: record.status, timestamp: new Date().toISOString() }],
      subject: record.extractedSignals?.subject || null,
      sender: record.extractedSignals?.senderEmail || null,
      recipients: record.extractedSignals?.recipientEmails || [],
      received_at: record.timestamps?.received || null,
      thread_id: record.conversationId,
      conversation_id: record.conversationId,
      extracted_rg_numbers: record.extractedSignals?.rgNumbers || [],
      extracted_entities: record.extractedSignals || {},
      match_result: record.matchResults?.[0] || null,
      matched_dossier_id: record.chosenDossierId || null,
      match_confidence: record.matchResults?.[0]?.confidence || null,
      match_method: record.matchResults?.[0]?.source || null,
      idempotency_key: record.idempotencyKey,
      retry_count: record.retryCount || 0,
    };
  }

  private dbToRecord(db: DbProcessingRecord): ProcessingRecord {
    return {
      partitionKey: db.mailbox,
      rowKey: db.message_id,
      messageId: db.message_id,
      internetMessageId: db.message_id,
      conversationId: db.conversation_id || db.thread_id || '',
      mailbox: db.mailbox,
      tenantId: '',
      status: db.status as ProcessingRecord['status'],
      retryCount: db.retry_count,
      maxRetries: 3,
      extractedSignals: db.extracted_entities
        ? {
            subject: db.subject || '',
            senderEmail: db.sender || '',
            senderDomain: (db.sender || '').split('@')[1] || '',
            recipientEmails: (db.recipients as string[]) || [],
            rgNumbers: db.extracted_rg_numbers || [],
            entities: [],
            dates: [],
            bodyPreview: '',
            bodyHash: '',
            hasAttachments: false,
            attachmentCount: 0,
            isReply: false,
            isForward: false,
            threadPosition: 0,
            language: 'fr',
          }
        : undefined,
      attachments: [],
      matchResults: db.match_result
        ? [
            {
              dossierId: db.matched_dossier_id || '',
              dossierName: '',
              dossierRef: '',
              confidence: db.match_confidence || 0,
              source: db.match_method as 'thread_memory' | 'rg_match' | 'sender_hint' | 'entity_overlap',
              reasons: [],
            },
          ]
        : [],
      chosenDossierId: db.matched_dossier_id || undefined,
      chosenDossierName: undefined,
      userApproved: false,
      actions: {
        filedEmail: false,
        filedAttachments: [],
        draftsCreated: [],
        autoSent: false,
        errors: [],
      },
      timestamps: {
        received: db.received_at || db.created_at,
        lastUpdated: db.updated_at,
      },
      idempotencyKey: db.idempotency_key || db.message_id,
      auditTrail: [],
    };
  }

  private dbToThreadMapping(db: DbThreadMapping): ThreadMapping {
    return {
      partitionKey: db.mailbox,
      rowKey: db.thread_id,
      conversationId: db.thread_id,
      mailbox: db.mailbox,
      dossierId: db.dossier_id,
      dossierName: db.dossier_name || '',
      dossierRef: '',
      validatedBy: (db.source as 'user' | 'system') || 'system',
      validatedAt: db.created_at,
      confidence: db.confidence,
      emailCount: 1,
      lastEmailAt: db.updated_at,
    };
  }
}

/**
 * Create storage client from environment variables
 */
export function createStorageClientFromEnv(): StorageClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required');
  }

  return new StorageClient({
    supabaseUrl,
    supabaseKey,
    blobConnectionString: process.env.AZURE_BLOB_CONNECTION_STRING,
    blobContainerName: process.env.AZURE_BLOB_CONTAINER,
  });
}
