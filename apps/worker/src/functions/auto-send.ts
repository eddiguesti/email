/**
 * Auto-Send Worker
 * Service Bus triggered function that handles scheduled auto-sends
 * with strict safety checks and prompt-injection prevention
 */

import { app, InvocationContext } from '@azure/functions';
import {
  GraphClient,
  createStorageClientFromEnv,
  containsPromptInjection,
  type AutoSendJob,
  type AutoSendPolicy,
} from '@lb-bot/shared';

const AUTO_SEND_POLICY: AutoSendPolicy = {
  enabled: process.env.AUTO_SEND_ENABLED === 'true',
  allowedDraftTypes: ['fee_reminder_1', 'fee_reminder_2', 'fee_reminder_final', 'leave_acknowledgement', 'client_transmittal'],
  requireKnownThread: true,
  requirePreviousReply: true,
  minConfidence: parseFloat(process.env.AUTO_APPROVE_CONFIDENCE_THRESHOLD || '0.85'),
  delayMinutes: parseInt(process.env.AUTO_SEND_DELAY_MINUTES || '5', 10),
  blockedDomains: (process.env.AUTO_SEND_BLOCKED_DOMAINS || '').split(',').filter(d => d),
};

/**
 * Process an auto-send job
 */
export async function autoSend(
  message: AutoSendJob,
  context: InvocationContext
): Promise<void> {
  context.log(`Auto-send job: ${message.draftId} for ${message.mailbox}`);

  const storageClient = createStorageClientFromEnv();
  const now = new Date().toISOString();

  // Get processing record
  const record = await storageClient.getProcessingRecord(message.mailbox, message.messageId);

  if (!record) {
    context.warn(`Processing record not found for ${message.messageId}`);
    return;
  }

  // Check if auto-send was cancelled
  if (record.actions.autoSendCancelledAt) {
    context.log(`Auto-send was cancelled for ${message.messageId}`);

    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'AUTO_SEND_SKIPPED',
      actor: 'system',
      messageId: message.messageId,
      mailbox: message.mailbox,
      details: {
        reason: 'Cancelled by user',
        cancelledAt: record.actions.autoSendCancelledAt,
      },
      success: true,
    });

    return;
  }

  // Get the draft
  const drafts = await storageClient.getDrafts(message.messageId);
  const draft = drafts.find(d => d.id === message.draftId);

  if (!draft) {
    context.warn(`Draft ${message.draftId} not found`);
    return;
  }

  // ============= SAFETY CHECKS =============

  const blockReasons: string[] = [];

  // Check 1: Is auto-send enabled?
  if (!AUTO_SEND_POLICY.enabled) {
    blockReasons.push('Auto-send is globally disabled');
  }

  // Check 2: Is this draft type allowed for auto-send?
  if (!AUTO_SEND_POLICY.allowedDraftTypes.includes(draft.type)) {
    blockReasons.push(`Draft type "${draft.type}" is not allowed for auto-send`);
  }

  // Check 3: Check for prompt injection in draft content
  if (containsPromptInjection(draft.body)) {
    blockReasons.push('Draft content contains suspicious patterns');
    context.warn('Prompt injection detected in draft content!');
  }

  // Check 4: First-contact check - never auto-reply to first contact
  if (draft.type === 'reply') {
    const signals = record.extractedSignals;
    if (signals && signals.threadPosition === 0 && !signals.isReply) {
      blockReasons.push('Cannot auto-reply to first-contact email');
    }
  }

  // Check 5: Known thread requirement
  if (AUTO_SEND_POLICY.requireKnownThread) {
    const threadMapping = await storageClient.getThreadMapping(
      message.mailbox,
      record.conversationId
    );
    if (!threadMapping && draft.type === 'reply') {
      blockReasons.push('Thread is not validated - requires manual approval');
    }
  }

  // Check 6: Blocked domains
  for (const email of draft.to) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (AUTO_SEND_POLICY.blockedDomains.includes(domain)) {
      blockReasons.push(`Recipient domain "${domain}" is blocked`);
      break;
    }
  }

  // Check 7: Confidence threshold (for replies)
  if (draft.type === 'reply' && record.matchResults[0]) {
    if (record.matchResults[0].confidence < AUTO_SEND_POLICY.minConfidence) {
      blockReasons.push(`Confidence ${record.matchResults[0].confidence} below threshold ${AUTO_SEND_POLICY.minConfidence}`);
    }
  }

  // ============= EXECUTE OR BLOCK =============

  if (blockReasons.length > 0) {
    context.log(`Auto-send BLOCKED for ${message.draftId}: ${blockReasons.join('; ')}`);

    // Update record
    record.actions.autoSent = false;
    record.timestamps.lastUpdated = now;
    record.auditTrail.push({
      action: 'AUTO_SEND_BLOCKED',
      timestamp: now,
      success: false,
      details: {
        draftId: message.draftId,
        draftType: draft.type,
        reasons: blockReasons,
      },
    });

    await storageClient.upsertProcessingRecord(record);

    // Log the block
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'AUTO_SEND_BLOCKED',
      actor: 'system',
      messageId: message.messageId,
      mailbox: message.mailbox,
      details: {
        draftId: message.draftId,
        draftType: draft.type,
        reasons: blockReasons,
      },
      success: false,
      errorMessage: blockReasons.join('; '),
    });

    return;
  }

  // All checks passed - proceed with send
  try {
    const graphClient = new GraphClient({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    });

    // Create and send the message
    context.log(`Sending draft ${message.draftId}...`);

    // First create the draft in Outlook
    let outlookDraft;

    if (draft.type === 'reply') {
      outlookDraft = await graphClient.createReplyDraft(
        message.mailbox,
        message.messageId,
        {
          body: draft.body,
          contentType: 'html',
        }
      );
    } else {
      outlookDraft = await graphClient.createDraft(message.mailbox, {
        subject: draft.subject,
        body: {
          contentType: 'html',
          content: draft.body,
        },
        toRecipients: draft.to.map(email => ({
          emailAddress: { address: email, name: '' },
        })),
        ccRecipients: draft.cc?.map(email => ({
          emailAddress: { address: email, name: '' },
        })),
      });
    }

    // Send the draft
    await graphClient.sendDraft(message.mailbox, outlookDraft.id);

    context.log(`Successfully sent draft ${message.draftId}`);

    // Update records
    record.actions.autoSent = true;
    record.actions.autoSentAt = now;
    record.timestamps.lastUpdated = now;
    record.auditTrail.push({
      action: 'AUTO_SEND_COMPLETED',
      timestamp: now,
      success: true,
      details: {
        draftId: message.draftId,
        draftType: draft.type,
        recipients: draft.to,
        outlookMessageId: outlookDraft.id,
      },
    });

    await storageClient.upsertProcessingRecord(record);

    // Update draft status
    await storageClient.updateDraft(message.messageId, message.draftId, {
      sentAt: now,
    });

    // Log success
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'AUTO_SEND_COMPLETED',
      actor: 'system',
      messageId: message.messageId,
      mailbox: message.mailbox,
      details: {
        draftId: message.draftId,
        draftType: draft.type,
        recipients: draft.to,
        reason: message.reason,
      },
      success: true,
    });

  } catch (error) {
    context.error(`Error sending draft ${message.draftId}:`, error);

    // Update record with error
    record.actions.errors.push({
      action: 'AUTO_SEND_FAILED',
      timestamp: now,
      success: false,
      error: String(error),
    });
    record.timestamps.lastUpdated = now;

    await storageClient.upsertProcessingRecord(record);

    // Log failure
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'AUTO_SEND_FAILED',
      actor: 'system',
      messageId: message.messageId,
      mailbox: message.mailbox,
      details: {
        draftId: message.draftId,
        draftType: draft.type,
      },
      success: false,
      errorMessage: String(error),
    });

    throw error;
  }
}

// Register the Service Bus triggered function
app.serviceBusQueue('auto-send', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.AUTO_SEND_QUEUE_NAME || 'auto-send',
  handler: autoSend,
});
