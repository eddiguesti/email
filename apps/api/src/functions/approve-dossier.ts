/**
 * Approve Dossier Selection
 * User approves the selected dossier for an email
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';
import {
  createStorageClientFromEnv,
  type ApproveDossierRequest,
  type ApproveDossierResponse,
  type ThreadMapping,
} from '@lb-bot/shared';

const RequestSchema = z.object({
  messageId: z.string().min(1),
  mailbox: z.string().email(),
  dossierId: z.string().min(1),
  dossierName: z.string().min(1),
  dossierRef: z.string().min(1),
  saveAsThreadDefault: z.boolean().default(true),
  userId: z.string().optional(),
});

/**
 * Approve dossier for an email
 * POST /api/approve
 */
export async function approveDossier(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { success: false, error: 'Non authentifié' } };
  }

  let body: ApproveDossierRequest;

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as ApproveDossierRequest;
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { success: false, error: 'Invalid request body' },
    };
  }

  // Ownership check — users may only approve emails in their own mailbox
  if (body.mailbox !== session.email) {
    return { status: 403, jsonBody: { success: false, error: 'Accès interdit' } };
  }

  try {
    const storageClient = createStorageClientFromEnv();

    // Get the processing record
    const record = await storageClient.getProcessingRecord(body.mailbox, body.messageId);

    if (!record) {
      return {
        status: 404,
        jsonBody: { success: false, error: 'Processing record not found' },
      };
    }

    // Update the record with the chosen dossier
    const now = new Date().toISOString();

    record.chosenDossierId = body.dossierId;
    record.chosenDossierName = body.dossierName;
    record.userApproved = true;
    record.userApprovedAt = now;
    record.userApprovedBy = session.userId;
    record.status = 'READY_TO_FILE';
    record.timestamps.lastUpdated = now;

    // Add to audit trail
    record.auditTrail.push({
      action: 'DOSSIER_APPROVED',
      timestamp: now,
      success: true,
      details: {
        dossierId: body.dossierId,
        dossierName: body.dossierName,
        userId: session.userId,
      },
    });

    await storageClient.upsertProcessingRecord(record);

    // Save thread mapping if requested
    let threadMappingSaved = false;

    if (body.saveAsThreadDefault && record.conversationId) {
      const mapping: ThreadMapping = {
        partitionKey: body.mailbox,
        rowKey: record.conversationId,
        conversationId: record.conversationId,
        mailbox: body.mailbox,
        dossierId: body.dossierId,
        dossierName: body.dossierName,
        dossierRef: body.dossierRef,
        validatedBy: 'user',
        validatedAt: now,
        validatedByUser: session.userId,
        confidence: 1.0,
        emailCount: 1,
        lastEmailAt: now,
      };

      await storageClient.saveThreadMapping(mapping);
      threadMappingSaved = true;

      context.log(`Thread mapping saved for conversation ${record.conversationId}`);
    }

    // Write audit log
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'DOSSIER_APPROVED',
      actor: 'user',
      actorId: session.userId,
      messageId: body.messageId,
      conversationId: record.conversationId,
      dossierId: body.dossierId,
      mailbox: body.mailbox,
      details: {
        dossierName: body.dossierName,
        dossierRef: body.dossierRef,
        threadMappingSaved,
      },
      success: true,
    });

    const response: ApproveDossierResponse = {
      success: true,
      record,
      threadMappingSaved,
    };

    return { status: 200, jsonBody: response };
  } catch (error) {
    context.error('Error approving dossier:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' },
    };
  }
}

app.http('approve-dossier', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'approve',
  handler: approveDossier,
});
