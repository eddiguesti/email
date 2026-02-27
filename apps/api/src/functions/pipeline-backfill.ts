/**
 * Pipeline Backfill - Fetch recent emails from Graph and enqueue for processing
 * POST /api/pipeline/backfill
 *
 * Query params:
 *   mailbox  - email address to backfill (required)
 *   count    - number of recent emails to fetch (default 25, max 100)
 *   since    - ISO date to fetch emails from (optional)
 *
 * Secured with function key
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { timingSafeEqual } from 'crypto';
import {
  GraphClient,
  createQueueClientFromEnv,
  createStorageClientFromEnv,
  generateIdempotencyKey,
  type EmailProcessJob,
} from '@lb-bot/shared';

const TENANT_ID = process.env.AZURE_TENANT_ID || '';
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const API_KEY = process.env.API_FUNCTION_KEY || '';

async function pipelineBackfill(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // API key auth — header only; query string is intentionally not accepted
  // because query parameters appear in access logs and browser history.
  const authHeader = request.headers.get('x-api-key') || '';
  if (
    !API_KEY ||
    authHeader.length !== API_KEY.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(API_KEY))
  ) {
    return { status: 401, jsonBody: { error: 'Unauthorized' } };
  }

  const mailbox = request.query.get('mailbox');
  if (!mailbox) {
    return { status: 400, jsonBody: { error: 'mailbox parameter is required' } };
  }

  const count = Math.min(parseInt(request.query.get('count') || '25'), 100);
  const since = request.query.get('since') || undefined;

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return { status: 500, jsonBody: { error: 'Missing Azure AD configuration' } };
  }

  context.log(`Backfill requested: mailbox=${mailbox}, count=${count}, since=${since || 'none'}`);

  try {
    // Create Graph client with app credentials
    const graphClient = new GraphClient({
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    // Fetch recent inbox messages
    const { messages } = await graphClient.listInboxMessages(mailbox, {
      top: count,
      since,
    });

    context.log(`Fetched ${messages.length} messages from ${mailbox}`);

    if (messages.length === 0) {
      return {
        status: 200,
        jsonBody: { enqueued: 0, skipped: 0, message: 'No messages found' },
      };
    }

    // Check which messages are already processed
    const storageClient = createStorageClientFromEnv();
    const queueClient = createQueueClientFromEnv();

    const jobs: EmailProcessJob[] = [];
    let skipped = 0;

    for (const msg of messages) {
      // Skip drafts
      if (msg.isDraft) {
        skipped++;
        continue;
      }

      const messageId = msg.id;

      // Check idempotency
      const exists = await storageClient.recordExists(mailbox, messageId);
      if (exists) {
        skipped++;
        continue;
      }

      const idempotencyKey = generateIdempotencyKey({
        tenantId: TENANT_ID,
        mailbox,
        messageId,
      });

      jobs.push({
        tenantId: TENANT_ID,
        mailbox,
        messageId,
        subscriptionId: 'backfill',
        receivedAt: msg.receivedDateTime || new Date().toISOString(),
        idempotencyKey,
      });
    }

    // Enqueue in batches
    if (jobs.length > 0) {
      await queueClient.enqueueEmailProcessBatch(jobs);
      context.log(`Enqueued ${jobs.length} jobs for processing`);

      // Write audit log
      await storageClient.writeAuditLog({
        timestamp: new Date().toISOString(),
        action: 'PIPELINE_BACKFILL',
        actor: 'system',
        mailbox,
        details: {
          count: jobs.length,
          skipped,
          since,
        },
        success: true,
      });
    }

    await queueClient.close();

    return {
      status: 200,
      jsonBody: {
        enqueued: jobs.length,
        skipped,
        total: messages.length,
        mailbox,
        message: `${jobs.length} emails enqueued for processing, ${skipped} skipped (already processed or drafts)`,
      },
    };
  } catch (error) {
    context.error('Backfill error:', error);
    return {
      status: 500,
      jsonBody: { error: `Backfill failed: ${(error as Error).message}` },
    };
  }
}

app.http('pipeline-backfill', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'pipeline/backfill',
  handler: pipelineBackfill,
});
