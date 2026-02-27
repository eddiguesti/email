/**
 * Microsoft Graph Webhook Handler
 * Receives notifications for new emails and enqueues processing jobs
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  createQueueClientFromEnv,
  createStorageClientFromEnv,
  generateIdempotencyKey,
  type GraphWebhookNotification,
  type EmailProcessJob,
} from '@lb-bot/shared';
import { broadcastNotification } from './notifications-sse.js';

const WEBHOOK_CLIENT_STATE = process.env.WEBHOOK_CLIENT_STATE || '';
const MONITORED_MAILBOXES = (process.env.MONITORED_MAILBOXES || '').split(',').map(m => m.trim().toLowerCase());

/**
 * Graph webhook handler
 * POST /api/webhook/graph
 */
export async function webhookGraph(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Graph webhook received');

  // Guard: refuse to operate without a configured client state secret.
  // Without this check, an empty WEBHOOK_CLIENT_STATE would cause every
  // incoming notification to pass validation ('' === '').
  if (!WEBHOOK_CLIENT_STATE) {
    context.error('WEBHOOK_CLIENT_STATE is not configured — refusing to process webhook');
    return { status: 500, jsonBody: { error: 'Webhook client state secret is not configured' } };
  }

  // Handle validation request (subscription creation)
  const validationToken = request.query.get('validationToken');
  if (validationToken) {
    context.log('Webhook validation request received');
    return {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: validationToken,
    };
  }

  // Parse notification payload
  let notification: GraphWebhookNotification;
  try {
    notification = await request.json() as GraphWebhookNotification;
  } catch (error) {
    context.error('Failed to parse webhook payload:', error);
    return { status: 400, body: 'Invalid JSON payload' };
  }

  // Validate client state for security
  const invalidNotifications = notification.value?.filter(
    item => item.clientState !== WEBHOOK_CLIENT_STATE
  );

  if (invalidNotifications?.length) {
    context.warn('Invalid client state in webhook notification');
    // Still return 200 to prevent retry spam, but log the issue
  }

  // Process valid notifications
  const validNotifications = notification.value?.filter(
    item => item.clientState === WEBHOOK_CLIENT_STATE
  ) || [];

  if (validNotifications.length === 0) {
    context.log('No valid notifications to process');
    return { status: 200, body: 'OK' };
  }

  // Initialize clients
  const queueClient = createQueueClientFromEnv();
  const storageClient = createStorageClientFromEnv();

  const jobs: EmailProcessJob[] = [];
  const errors: string[] = [];

  for (const item of validNotifications) {
    try {
      // Extract mailbox from resource path
      // Resource format: /users/{user-id-or-email}/mailFolders('Inbox')/messages
      const resourceParts = item.resource.match(/\/users\/([^\/]+)\//);
      const mailbox = resourceParts?.[1] || '';

      if (!mailbox) {
        context.warn('Could not extract mailbox from resource:', item.resource);
        continue;
      }

      // Check if this mailbox is monitored
      if (MONITORED_MAILBOXES.length > 0 && !MONITORED_MAILBOXES.includes(mailbox.toLowerCase())) {
        context.log(`Mailbox ${mailbox} is not monitored, skipping`);
        continue;
      }

      const messageId = item.resourceData.id;

      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey({
        tenantId: item.tenantId,
        mailbox,
        messageId,
      });

      // Check if already processed (idempotency)
      const exists = await storageClient.recordExists(mailbox, messageId);
      if (exists) {
        context.log(`Message ${messageId} already exists, skipping`);
        continue;
      }

      // Create job
      const job: EmailProcessJob = {
        tenantId: item.tenantId,
        mailbox,
        messageId,
        subscriptionId: item.subscriptionId,
        receivedAt: new Date().toISOString(),
        idempotencyKey,
      };

      jobs.push(job);
    } catch (error) {
      context.error('Error processing notification item:', error);
      errors.push(String(error));
    }
  }

  // Enqueue jobs
  if (jobs.length > 0) {
    try {
      await queueClient.enqueueEmailProcessBatch(jobs);
      context.log(`Enqueued ${jobs.length} email processing jobs`);

      // Notify connected users about new emails
      for (const job of jobs) {
        broadcastNotification({
          type: 'email_received',
          data: {
            id: job.messageId,
            title: 'Nouvel email reçu',
            message: `Nouveau message dans ${job.mailbox}`,
            timestamp: job.receivedAt,
            metadata: { mailbox: job.mailbox, messageId: job.messageId },
          },
        });
      }

      // Write audit log entries
      for (const job of jobs) {
        await storageClient.writeAuditLog({
          timestamp: new Date().toISOString(),
          action: 'EMAIL_RECEIVED',
          actor: 'system',
          messageId: job.messageId,
          mailbox: job.mailbox,
          details: {
            tenantId: job.tenantId,
            subscriptionId: job.subscriptionId,
          },
          success: true,
        });
      }
    } catch (error) {
      context.error('Failed to enqueue jobs:', error);
      errors.push(String(error));
    }
  }

  // Return 200 quickly to acknowledge receipt
  // Graph will retry if we don't respond within 3 seconds
  return {
    status: 200,
    jsonBody: {
      processed: jobs.length,
      errors: errors.length,
      details: errors.length > 0 ? errors : undefined,
    },
  };
}

app.http('webhook-graph', {
  methods: ['POST'],
  authLevel: 'anonymous', // Graph needs to call this without auth
  route: 'webhook/graph',
  handler: webhookGraph,
});
