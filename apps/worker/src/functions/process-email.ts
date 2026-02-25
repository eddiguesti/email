/**
 * Email Processing Worker (v2 — 8-Tier Shared Engine + Read-Only Mode)
 * Service Bus triggered function that processes emails through the pipeline.
 *
 * READ-ONLY MODE: Pipeline stops at MATCHED/READY_FOR_REVIEW.
 * No email filing, no draft generation. Only writes to Supabase match_logs.
 */

import { app, InvocationContext } from '@azure/functions';
import {
  GraphClient,
  createStorageClientFromEnv,
  createKleosClientFromEnv,
  detectMeetingIntent,
  stripHtml,
  type EmailProcessJob,
  type ProcessingRecord,
  type GraphMessage,
  type CreateCalendarSuggestionInput,
} from '@lb-bot/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { EmailFetcher, SignalExtractor, DossierMatcher } from '../pipeline/index.js';
import { getKnowledgeBase } from '../pipeline/knowledge-base-loader.js';

const MAX_RETRIES = 3;

// READ-ONLY MODE: When true, pipeline stops at MATCHED — no filing, no drafts.
const READ_ONLY_MODE = process.env.READ_ONLY_MODE !== 'false';

// Supabase client (lazy singleton)
let supabase: SupabaseClient | undefined;
function getSupabase(): SupabaseClient | undefined {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return undefined;
  supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabase;
}

// Shared matcher instance (lazy singleton — initialized once per worker cold start)
let sharedMatcher: DossierMatcher | undefined;
async function getMatcher(
  storageClient: ReturnType<typeof createStorageClientFromEnv>,
  kleosClient: ReturnType<typeof createKleosClientFromEnv>
): Promise<DossierMatcher> {
  if (sharedMatcher) return sharedMatcher;

  const kb = await getKnowledgeBase();
  const supabaseClient = getSupabase();

  const aiConfig = process.env.XAI_API_KEY ? {
    apiKey: process.env.XAI_API_KEY,
    apiUrl: process.env.XAI_API_URL || 'https://api.x.ai/v1/chat/completions',
    model: process.env.XAI_MODEL || 'grok-4-1-fast-reasoning',
  } : undefined;

  sharedMatcher = new DossierMatcher(storageClient, kleosClient, supabaseClient, kb, aiConfig);
  await sharedMatcher.initialize();
  return sharedMatcher;
}

/**
 * Send browser push notifications to the lawyer who owns the receiving mailbox.
 * Only fires when VAPID keys are configured.
 */
async function sendPushNotifications(
  db: SupabaseClient,
  context: InvocationContext,
  mailbox: string,
  senderName: string,
  dossierName: string | undefined,
  confidence: number
): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:cabinet@lbrosset.com';

  if (!publicKey || !privateKey) return;

  // Scope notifications to the lawyer who owns this mailbox
  const { data: lawyer } = await db
    .from('lawyers')
    .select('id')
    .eq('email', mailbox)
    .single();

  if (!lawyer) return;

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', lawyer.id);

  if (error || !subs?.length) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: 'LB-BOT — Email à valider',
    body: dossierName
      ? `${senderName} → ${dossierName} (${Math.round(confidence * 100)}%)`
      : `${senderName} — correspondance à confirmer`,
    url: '/dashboard/review/queue',
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      // Remove expired or invalid subscriptions automatically
      if ((err as { statusCode?: number }).statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        context.log(`Removed expired push subscription: ${sub.endpoint.slice(0, 60)}...`);
      } else {
        context.warn('Push notification failed:', err);
      }
    }
  }
}

/**
 * Detect meeting intent and persist a calendar suggestion (idempotent).
 * Privacy: only the first 1000 chars of plain-text body are passed to the detector.
 * Raw body is never stored; only the evidence snippet (≤ 500 chars) is persisted.
 */
async function createCalendarSuggestionIfNeeded(
  db: SupabaseClient,
  context: InvocationContext,
  message: GraphMessage,
  mailbox: string,
  userId: string,
): Promise<void> {
  try {
    const from = message.from?.emailAddress?.address || message.sender?.emailAddress?.address || '';
    const subject = message.subject || '';

    // Extract body snippet (plain text, max 1000 chars)
    const rawBody = message.body?.content || '';
    const plainBody = message.body?.contentType === 'html' ? stripHtml(rawBody) : rawBody;
    const bodySnippet = plainBody.slice(0, 1000);

    const intent = detectMeetingIntent(from, subject, bodySnippet);
    if (!intent) return;

    // Sender display name
    const senderName = message.from?.emailAddress?.name || from.split('@')[0];

    const input: CreateCalendarSuggestionInput = {
      user_id: userId,
      mailbox,
      email_id: message.id,
      sender_email: from || undefined,
      sender_name: senderName || undefined,
      email_subject_preview: subject.slice(0, 100) || undefined,
      title: intent.title,
      description: intent.evidence?.slice(0, 500) || undefined,
      start_at: intent.startAt.toISOString(),
      end_at: intent.endAt?.toISOString(),
      location: intent.location || undefined,
      attendees: [],
      confidence: intent.confidence,
      evidence: intent.evidence,
      detected_patterns: intent.detectedPatterns,
    };

    // Upsert — unique on (email_id, mailbox) prevents duplicates
    const { error } = await db
      .from('calendar_suggestions')
      .upsert(input, { onConflict: 'email_id,mailbox', ignoreDuplicates: true });

    if (error) {
      context.warn('Failed to persist calendar suggestion:', error.message);
    } else {
      context.log(`Calendar suggestion created: "${intent.title}" @ ${intent.startAt.toISOString()} (confidence ${Math.round(intent.confidence * 100)}%)`);
      // Send notification about the new calendar suggestion
      await sendCalendarSuggestionNotification(db, context, mailbox, intent.title);
    }
  } catch (err) {
    // Non-fatal: meeting detection failures must not block email processing
    context.warn('Meeting detection error (non-fatal):', err);
  }
}

/**
 * Send push notification when a calendar suggestion is created.
 */
async function sendCalendarSuggestionNotification(
  db: SupabaseClient,
  context: InvocationContext,
  mailbox: string,
  eventTitle: string,
): Promise<void> {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT || 'mailto:cabinet@lbrosset.com';
  if (!publicKey || !privateKey) return;

  const { data: lawyer } = await db.from('lawyers').select('id').eq('email', mailbox).single();
  if (!lawyer) return;

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', lawyer.id);
  if (error || !subs?.length) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: 'LB-BOT — Suggestion agenda',
    body: `"${eventTitle.slice(0, 60)}" — à confirmer dans le calendrier`,
    url: '/dashboard/calendar',
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }
}

/**
 * Process an email through the full pipeline
 */
export async function processEmail(
  message: EmailProcessJob,
  context: InvocationContext
): Promise<void> {
  context.log(`Processing email: ${message.messageId} for ${message.mailbox}`);
  if (READ_ONLY_MODE) {
    context.log('READ-ONLY MODE — pipeline will stop at MATCHED/READY_FOR_REVIEW');
  }

  const storageClient = createStorageClientFromEnv();
  const kleosClient = createKleosClientFromEnv();
  const graphClient = new GraphClient({
    tenantId: process.env.AZURE_TENANT_ID!,
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  });

  const now = new Date().toISOString();

  try {
    // Check if record already exists (idempotency)
    let record = await storageClient.getProcessingRecord(message.mailbox, message.messageId);

    if (record) {
      if (['DONE', 'FILED', 'ERROR_FATAL', 'SKIPPED'].includes(record.status)) {
        context.log(`Message ${message.messageId} already in terminal state: ${record.status}`);
        return;
      }
      context.log(`Resuming processing from state: ${record.status}`);
    } else {
      record = {
        partitionKey: message.mailbox,
        rowKey: message.messageId,
        messageId: message.messageId,
        internetMessageId: '',
        conversationId: '',
        mailbox: message.mailbox,
        tenantId: message.tenantId,
        status: 'RECEIVED',
        retryCount: message.retryCount || 0,
        maxRetries: MAX_RETRIES,
        attachments: [],
        matchResults: [],
        userApproved: false,
        actions: {
          filedEmail: false,
          filedAttachments: [],
          draftsCreated: [],
          autoSent: false,
          errors: [],
        },
        timestamps: {
          received: message.receivedAt || now,
          lastUpdated: now,
        },
        idempotencyKey: message.idempotencyKey,
        auditTrail: [{
          action: 'PROCESSING_STARTED',
          timestamp: now,
          success: true,
          details: { tenantId: message.tenantId, readOnlyMode: READ_ONLY_MODE },
        }],
      };

      await storageClient.upsertProcessingRecord(record);
      context.log(`Created new processing record for ${message.messageId}`);
    }

    // Initialize pipeline components
    const fetcher = new EmailFetcher(graphClient, storageClient);
    const extractor = new SignalExtractor(storageClient);
    const matcher = await getMatcher(storageClient, kleosClient);

    // Cache the fetched message so meeting detection can use it after matching
    let cachedMessage: GraphMessage | undefined;

    // Step 1: Fetch email and attachments
    if (['RECEIVED', 'FETCHING'].includes(record.status)) {
      context.log('Step 1: Fetching email...');
      const fetchResult = await fetcher.fetch(record);

      if (!fetchResult.success) {
        if (record.retryCount >= MAX_RETRIES) {
          record.status = 'ERROR_FATAL';
          record.timestamps.lastUpdated = new Date().toISOString();
          await storageClient.upsertProcessingRecord(record);
          throw new Error(`Fetch failed after ${MAX_RETRIES} retries: ${fetchResult.error}`);
        }
        throw new Error(`Fetch failed: ${fetchResult.error}`);
      }

      record = (await storageClient.getProcessingRecord(message.mailbox, message.messageId))!;

      // Step 2: Extract signals
      if (fetchResult.message) {
        cachedMessage = fetchResult.message;
        context.log('Step 2: Extracting signals...');
        const extractResult = await extractor.extract(record, fetchResult.message);
        if (!extractResult.success) {
          throw new Error(`Extraction failed: ${extractResult.error}`);
        }
      }
    }

    record = (await storageClient.getProcessingRecord(message.mailbox, message.messageId))!;

    // Step 3: Match to dossiers (using 8-tier shared engine)
    let needsReview = false;
    let emailWasSkipped = false;
    let topMatch: { dossierName?: string; confidence: number } | undefined;

    if (['EXTRACTED', 'MATCHING'].includes(record.status)) {
      context.log('Step 3: Matching dossiers (8-tier engine)...');
      const matchResult = await matcher.match(record);

      if (matchResult.skipped) {
        emailWasSkipped = true;
        context.log('Email skipped (spam/newsletter filter)');
        return;
      }

      if (!matchResult.success) {
        throw new Error(`Matching failed: ${matchResult.error}`);
      }

      context.log(`Found ${matchResult.results.length} potential dossier matches`);
      if (matchResult.autoApproved) {
        context.log(`Auto-approved match: ${matchResult.results[0]?.dossierName}`);
      }

      // Check if top result needs human review (confidence 60–84.9%)
      const top = matchResult.results[0];
      if (top && top.confidence >= 0.60 && top.confidence < 0.85) {
        needsReview = true;
        topMatch = top;
      }
    }

    record = (await storageClient.getProcessingRecord(message.mailbox, message.messageId))!;

    // READ-ONLY MODE: Stop here — do NOT generate drafts or file to KLEOS
    if (READ_ONLY_MODE) {
      context.log(`READ-ONLY: Processing completed at ${record.status}`);
    }

    // Step 4: Meeting intent detection — only for non-skipped emails
    // This runs asynchronously and is non-fatal; it must not block email processing.
    if (!emailWasSkipped && cachedMessage) {
      const db = getSupabase();
      if (db) {
        // Resolve user_id: look up lawyer by mailbox
        const { data: lawyer } = await db
          .from('lawyers')
          .select('microsoft_id')
          .eq('email', message.mailbox)
          .single();
        const userId = lawyer?.microsoft_id || message.mailbox;
        await createCalendarSuggestionIfNeeded(db, context, cachedMessage, message.mailbox, userId);
      }
    }

    // Send push notification if this email needs review
    if (needsReview && topMatch) {
      const db = getSupabase();
      if (db) {
        const senderName = record.extractedSignals?.senderEmail?.split('@')[0] || record.mailbox.split('@')[0];
        await sendPushNotifications(db, context, message.mailbox, senderName, topMatch.dossierName, topMatch.confidence);
        context.log('Push notification sent for review-needed match');
      }
    }

    // Log completion
    await storageClient.writeAuditLog({
      timestamp: new Date().toISOString(),
      action: 'PROCESSING_COMPLETED',
      actor: 'system',
      messageId: message.messageId,
      conversationId: record.conversationId,
      dossierId: record.chosenDossierId,
      mailbox: message.mailbox,
      details: {
        finalStatus: record.status,
        matchCount: record.matchResults.length,
        topConfidence: record.matchResults[0]?.confidence,
        readOnlyMode: READ_ONLY_MODE,
      },
      success: true,
    });

    context.log(`Processing completed for ${message.messageId}, status: ${record.status}`);
  } catch (error) {
    context.error(`Error processing email ${message.messageId}:`, error);

    await storageClient.writeAuditLog({
      timestamp: new Date().toISOString(),
      action: 'PROCESSING_FAILED',
      actor: 'system',
      messageId: message.messageId,
      mailbox: message.mailbox,
      details: {
        retryCount: message.retryCount || 0,
        maxRetries: MAX_RETRIES,
      },
      success: false,
      errorMessage: String(error),
    });

    throw error;
  }
}

// Register the Service Bus triggered function
app.serviceBusQueue('process-email', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.EMAIL_PROCESS_QUEUE_NAME || 'email-process',
  handler: processEmail,
});
