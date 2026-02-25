/**
 * Insert Draft
 * Inserts a generated draft into Outlook
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import {
  createStorageClientFromEnv,
  GraphClient,
  type InsertDraftRequest,
  type InsertDraftResponse,
} from '@lb-bot/shared';

const RequestSchema = z.object({
  messageId: z.string().min(1),
  mailbox: z.string().email(),
  draftId: z.string().min(1),
});

/**
 * Insert draft into Outlook
 * POST /api/drafts/insert
 */
export async function insertDraft(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: InsertDraftRequest;

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as InsertDraftRequest;
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { success: false, error: 'Invalid request body' },
    };
  }

  try {
    const storageClient = createStorageClientFromEnv();

    // Get the draft
    const drafts = await storageClient.getDrafts(body.messageId);
    const draft = drafts.find(d => d.id === body.draftId);

    if (!draft) {
      return {
        status: 404,
        jsonBody: { success: false, error: 'Draft not found' },
      };
    }

    // Initialize Graph client
    const graphClient = new GraphClient({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    });

    // Get the processing record for context
    const record = await storageClient.getProcessingRecord(body.mailbox, body.messageId);

    let outlookDraftId: string;
    const now = new Date().toISOString();

    // Create the draft in Outlook
    if (draft.type === 'reply' && record) {
      // Create as reply to the original message
      const replyDraft = await graphClient.createReplyDraft(
        body.mailbox,
        body.messageId,
        {
          body: draft.body,
          contentType: 'html',
        }
      );
      outlookDraftId = replyDraft.id;
    } else {
      // Create as new message
      const newDraft = await graphClient.createDraft(body.mailbox, {
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
      outlookDraftId = newDraft.id;
    }

    // Update draft status
    await storageClient.updateDraft(body.messageId, body.draftId, {
      insertedAt: now,
    });

    // Update processing record
    if (record) {
      record.timestamps.lastUpdated = now;
      record.auditTrail.push({
        action: 'DRAFT_INSERTED',
        timestamp: now,
        success: true,
        details: {
          draftId: body.draftId,
          draftType: draft.type,
          outlookDraftId,
        },
      });
      await storageClient.upsertProcessingRecord(record);
    }

    // Write audit log
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'DRAFT_INSERTED',
      actor: 'user',
      messageId: body.messageId,
      mailbox: body.mailbox,
      details: {
        draftId: body.draftId,
        draftType: draft.type,
        outlookDraftId,
      },
      success: true,
    });

    context.log(`Inserted draft ${body.draftId} as Outlook draft ${outlookDraftId}`);

    const response: InsertDraftResponse = {
      success: true,
      outlookDraftId,
    };

    return { status: 200, jsonBody: response };
  } catch (error) {
    context.error('Error inserting draft:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' },
    };
  }
}

app.http('insert-draft', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'drafts/insert',
  handler: insertDraft,
});
