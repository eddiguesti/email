/**
 * File to Kleos
 * Files email and/or attachments to a Kleos dossier
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';
import {
  createStorageClientFromEnv,
  createKleosClientFromEnv,
  GraphClient,
  generateAttachmentHash,
  generateDocumentName,
  type FileToKleosRequest,
  type FileToKleosResponse,
  type KleosDocumentType,
} from '@lb-bot/shared';
import { sendNotification } from './notifications-sse.js';

const RequestSchema = z.object({
  messageId: z.string().min(1),
  mailbox: z.string().email(),
  dossierId: z.string().min(1),
  fileEmail: z.boolean().default(true),
  fileAttachments: z.array(z.string()).default([]),
  folderId: z.string().optional(),
  generateDrafts: z.boolean().default(false),
});

/**
 * File email/attachments to Kleos
 * POST /api/file
 */
export async function fileToKleos(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { success: false, errors: ['Non authentifié'] } };
  }

  let body: FileToKleosRequest;

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as FileToKleosRequest;
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { success: false, errors: ['Invalid request body'] },
    };
  }

  // Ownership check — users may only file emails from their own mailbox
  if (body.mailbox !== session.email) {
    return { status: 403, jsonBody: { success: false, errors: ['Accès interdit'] } };
  }

  try {
    const storageClient = createStorageClientFromEnv();
    const kleosClient = createKleosClientFromEnv();

    // Get the processing record
    const record = await storageClient.getProcessingRecord(body.mailbox, body.messageId);

    if (!record) {
      return {
        status: 404,
        jsonBody: { success: false, errors: ['Processing record not found'] },
      };
    }

    // Initialize Graph client
    const graphClient = new GraphClient({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    });

    const errors: string[] = [];
    const now = new Date().toISOString();
    let emailDocumentId: string | undefined;
    const attachmentDocumentIds: Record<string, string> = {};

    // Update status to filing
    record.status = 'FILING';
    record.timestamps.lastUpdated = now;
    await storageClient.upsertProcessingRecord(record);

    // Get dossier info for naming
    const dossierResult = await kleosClient.getDossier(body.dossierId);
    const dossierRef = dossierResult.data?.reference || body.dossierId;
    const dossierName = dossierResult.data?.name || '';

    // File the email itself
    if (body.fileEmail && !record.actions.filedEmail) {
      try {
        // Get raw email as .eml
        const emlContent = await graphClient.getMessageRaw(body.mailbox, body.messageId);
        const contentHash = generateAttachmentHash(emlContent);

        // Generate document name
        const docName = generateDocumentName({
          dossierRef,
          date: record.timestamps.received,
          documentType: 'Email',
          sender: record.extractedSignals?.senderEmail,
          subject: record.extractedSignals?.subject || 'No Subject',
        });

        // Create document in Kleos
        const result = await kleosClient.createDocument({
          dossierId: body.dossierId,
          name: docName,
          description: `Email from ${record.extractedSignals?.senderEmail}`,
          documentType: 'email' as KleosDocumentType,
          folderId: body.folderId,
          file: {
            content: emlContent,
            mimeType: 'message/rfc822',
            originalName: `${docName}.eml`,
          },
          sourceType: 'email',
          sourceMessageId: body.messageId,
          sourceEmailSubject: record.extractedSignals?.subject,
          sourceEmailDate: record.timestamps.received,
          sourceEmailSender: record.extractedSignals?.senderEmail,
          contentHash,
          idempotencyKey: `${body.messageId}-email`,
        });

        if (result.success && result.data?.document) {
          emailDocumentId = result.data.document.id;
          record.actions.filedEmail = true;
          record.actions.filedEmailAt = now;
          record.actions.kleosEmailDocId = emailDocumentId;

          context.log(`Filed email ${body.messageId} as document ${emailDocumentId}`);
        } else if (result.data?.alreadyExists) {
          emailDocumentId = result.data.existingDocumentId;
          record.actions.filedEmail = true;
          context.log(`Email ${body.messageId} already filed as ${emailDocumentId}`);
        } else {
          errors.push(`Failed to file email: ${result.data?.error || 'Unknown error'}`);
        }
      } catch (error) {
        context.error('Error filing email:', error);
        errors.push(`Error filing email: ${String(error)}`);
      }
    }

    // File attachments
    for (const attachmentId of body.fileAttachments) {
      // Find attachment info
      const attachmentInfo = record.attachments.find(a => a.id === attachmentId);

      if (!attachmentInfo) {
        errors.push(`Attachment ${attachmentId} not found in record`);
        continue;
      }

      if (attachmentInfo.filed) {
        attachmentDocumentIds[attachmentId] = attachmentInfo.kleosDocumentId || '';
        context.log(`Attachment ${attachmentId} already filed`);
        continue;
      }

      try {
        // Download attachment content
        const { buffer, contentType, name } = await graphClient.getAttachmentContent(
          body.mailbox,
          body.messageId,
          attachmentId
        );

        const contentHash = generateAttachmentHash(buffer);

        // Generate document name
        const docName = generateDocumentName({
          dossierRef,
          date: record.timestamps.received,
          documentType: 'Attachment',
          sender: record.extractedSignals?.senderEmail,
          subject: name,
        });

        // Determine document type
        let documentType: KleosDocumentType = 'email_attachment';
        if (contentType === 'application/pdf') {
          documentType = 'correspondence_in';
        }

        // Create document in Kleos
        const result = await kleosClient.createDocument({
          dossierId: body.dossierId,
          name: docName,
          description: `Attachment: ${name}`,
          documentType,
          folderId: body.folderId,
          file: {
            content: buffer,
            mimeType: contentType,
            originalName: name,
          },
          sourceType: 'attachment',
          sourceMessageId: body.messageId,
          sourceEmailSubject: record.extractedSignals?.subject,
          sourceEmailDate: record.timestamps.received,
          sourceEmailSender: record.extractedSignals?.senderEmail,
          contentHash,
          idempotencyKey: `${body.messageId}-${attachmentId}`,
        });

        if (result.success && result.data?.document) {
          attachmentDocumentIds[attachmentId] = result.data.document.id;
          attachmentInfo.filed = true;
          attachmentInfo.filedAt = now;
          attachmentInfo.kleosDocumentId = result.data.document.id;
          record.actions.filedAttachments.push(attachmentId);

          context.log(`Filed attachment ${attachmentId} as document ${result.data.document.id}`);
        } else if (result.data?.alreadyExists) {
          attachmentDocumentIds[attachmentId] = result.data.existingDocumentId || '';
          attachmentInfo.filed = true;
          attachmentInfo.kleosDocumentId = result.data.existingDocumentId;
          context.log(`Attachment ${attachmentId} already filed`);
        } else {
          errors.push(`Failed to file attachment ${name}: ${result.data?.error || 'Unknown error'}`);
        }
      } catch (error) {
        context.error(`Error filing attachment ${attachmentId}:`, error);
        errors.push(`Error filing attachment ${attachmentId}: ${String(error)}`);
      }
    }

    // Update record status
    if (errors.length === 0) {
      record.status = 'FILED';
      record.timestamps.filed = now;
      record.chosenDossierId = body.dossierId;
    } else {
      record.status = 'ERROR_RETRYABLE';
      record.actions.errors.push({
        action: 'FILE_TO_KLEOS',
        timestamp: now,
        success: false,
        error: errors.join('; '),
      });
    }

    record.timestamps.lastUpdated = now;

    // Add to audit trail
    record.auditTrail.push({
      action: 'FILED_TO_KLEOS',
      timestamp: now,
      success: errors.length === 0,
      details: {
        dossierId: body.dossierId,
        emailDocumentId,
        attachmentDocumentIds,
        errors,
      },
    });

    await storageClient.upsertProcessingRecord(record);

    // Send real-time notification
    try {
      sendNotification(body.mailbox, {
        type: errors.length === 0 ? 'email_processed' : 'system',
        data: {
          id: body.messageId,
          title: errors.length === 0 ? 'Email classé dans Kleos' : 'Erreur de classement Kleos',
          message: errors.length === 0
            ? `Email classé dans le dossier ${dossierRef} ${dossierName ? '- ' + dossierName : ''}`
            : `Erreur lors du classement: ${errors[0]}`,
          timestamp: now,
          metadata: { dossierId: body.dossierId, dossierRef, emailDocumentId },
        },
      });
    } catch {
      // Notification failure should not block filing response
    }

    // Write audit log
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'FILED_TO_KLEOS',
      actor: 'user',
      messageId: body.messageId,
      conversationId: record.conversationId,
      dossierId: body.dossierId,
      mailbox: body.mailbox,
      details: {
        emailDocumentId,
        attachmentDocumentIds,
        errors,
      },
      success: errors.length === 0,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    });

    const response: FileToKleosResponse = {
      success: errors.length === 0,
      emailDocumentId,
      attachmentDocumentIds,
      errors: errors.length > 0 ? errors : undefined,
    };

    return { status: errors.length === 0 ? 200 : 207, jsonBody: response };
  } catch (error) {
    context.error('Error filing to Kleos:', error);
    return {
      status: 500,
      jsonBody: { success: false, errors: ['Internal server error'] },
    };
  }
}

app.http('file-to-kleos', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'file',
  handler: fileToKleos,
});
