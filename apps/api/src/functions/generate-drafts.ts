/**
 * Generate Drafts
 * Creates draft emails from templates
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import {
  createStorageClientFromEnv,
  generateReplyTemplate,
  generateClientTransmittal,
  generateFeeReminder,
  generateLeaveAcknowledgement,
  generateDraftId,
  type GenerateDraftsRequest,
  type GenerateDraftsResponse,
  type DraftInfo,
} from '@lb-bot/shared';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';

const FIRM_CONFIG = {
  firmName: process.env.FIRM_NAME || 'SELARL Brosset-Techer',
  firmAddress: process.env.FIRM_ADDRESS || '50 rue de Berri, 75008 Paris',
  firmPhone: process.env.FIRM_PHONE || '+33 (0)1 43 80 07 07',
  firmEmail: process.env.FIRM_EMAIL || 'cabinet@lbrosset.com',
};

const RequestSchema = z.object({
  messageId: z.string().min(1),
  mailbox: z.string().email(),
  draftTypes: z.array(z.enum([
    'reply',
    'client_transmittal',
    'fee_reminder_1',
    'fee_reminder_2',
    'fee_reminder_final',
    'leave_acknowledgement',
  ])),
  dossierId: z.string().optional(),
  // Context provided by the caller (from Kleos dossier / authenticated session)
  lawyerName: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  invoiceNumber: z.string().optional(),
  invoiceAmount: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  daysPastDue: z.number().optional(),
});

/**
 * Generate drafts from templates
 * POST /api/drafts/generate
 */
export async function generateDrafts(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { success: false, errors: ['Non authentifié'] } };
  }

  let body: GenerateDraftsRequest;

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as GenerateDraftsRequest;
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { success: false, errors: ['Invalid request body'] },
    };
  }

  // Always scope to the authenticated user's mailbox
  body = { ...body, mailbox: session.email };

  try {
    const storageClient = createStorageClientFromEnv();

    // Get the processing record
    const record = await storageClient.getProcessingRecord(body.mailbox, body.messageId);

    if (!record) {
      return {
        status: 404,
        jsonBody: { success: false, errors: ['Processing record not found'] },
      };
    }

    const drafts: DraftInfo[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const draftType of body.draftTypes) {
      try {
        let draft: DraftInfo | null = null;

        // Resolve lawyer name: use caller-supplied value, fall back to mailbox local-part
        const resolvedLawyerName = body.lawyerName || body.mailbox.split('@')[0];

        switch (draftType) {
          case 'reply': {
            const template = generateReplyTemplate({
              originalSender: record.extractedSignals?.senderEmail || '',
              originalSubject: record.extractedSignals?.subject || 'No Subject',
              dossierRef: record.chosenDossierId,
              dossierName: record.chosenDossierName,
              lawyerName: resolvedLawyerName,
              firmName: FIRM_CONFIG.firmName,
              firmAddress: FIRM_CONFIG.firmAddress,
              firmPhone: FIRM_CONFIG.firmPhone,
              firmEmail: FIRM_CONFIG.firmEmail,
            });

            draft = {
              id: generateDraftId(body.messageId, 'reply'),
              type: 'reply',
              subject: template.subject,
              body: template.bodyHtml,
              to: [record.extractedSignals?.senderEmail || ''],
              createdAt: now,
            };
            break;
          }

          case 'client_transmittal': {
            const template = generateClientTransmittal({
              clientName: body.clientName || record.chosenDossierName || 'Client',
              clientEmail: body.clientEmail || '',
              dossierRef: record.chosenDossierId || '',
              dossierName: record.chosenDossierName || '',
              documentDescription: record.extractedSignals?.subject || 'Documents',
              attachmentNames: record.attachments.map(a => a.name),
              lawyerName: resolvedLawyerName,
              firmName: FIRM_CONFIG.firmName,
              firmPhone: FIRM_CONFIG.firmPhone,
              firmEmail: FIRM_CONFIG.firmEmail,
            });

            draft = {
              id: generateDraftId(body.messageId, 'client_transmittal'),
              type: 'client_transmittal',
              subject: template.subject,
              body: template.bodyHtml,
              to: template.to,
              createdAt: now,
            };
            break;
          }

          case 'fee_reminder_1':
          case 'fee_reminder_2':
          case 'fee_reminder_final': {
            const level = draftType === 'fee_reminder_1' ? 'first' :
                         draftType === 'fee_reminder_2' ? 'second' : 'final';

            const template = generateFeeReminder({
              clientName: body.clientName || record.chosenDossierName || '',
              clientEmail: body.clientEmail || '',
              invoiceNumber: body.invoiceNumber || '',
              invoiceDate: body.invoiceDate || now.split('T')[0],
              invoiceAmount: body.invoiceAmount || '',
              dueDate: body.dueDate || now.split('T')[0],
              daysPastDue: body.daysPastDue || 0,
              dossierRef: record.chosenDossierId,
              dossierName: record.chosenDossierName,
              lawyerName: resolvedLawyerName,
              firmName: FIRM_CONFIG.firmName,
              firmPhone: FIRM_CONFIG.firmPhone,
            }, level);

            draft = {
              id: generateDraftId(body.messageId, draftType),
              type: draftType,
              subject: template.subject,
              body: template.bodyHtml,
              to: template.to,
              createdAt: now,
            };
            break;
          }

          case 'leave_acknowledgement': {
            const template = generateLeaveAcknowledgement({
              senderName: record.extractedSignals?.senderEmail?.split('@')[0] || '',
              senderEmail: record.extractedSignals?.senderEmail || '',
              leaveType: 'other',
              originalSubject: record.extractedSignals?.subject || '',
              acknowledgerName: resolvedLawyerName,
              firmName: FIRM_CONFIG.firmName,
            });

            draft = {
              id: generateDraftId(body.messageId, 'leave_acknowledgement'),
              type: 'leave_acknowledgement',
              subject: template.subject,
              body: template.bodyHtml,
              to: template.to,
              createdAt: now,
            };
            break;
          }
        }

        if (draft) {
          // Save draft to storage
          await storageClient.saveDraft(body.messageId, draft, body.mailbox);
          drafts.push(draft);

          // Update record
          if (!record.actions.draftsCreated.includes(draft.id)) {
            record.actions.draftsCreated.push(draft.id);
          }

          context.log(`Generated ${draftType} draft for message ${body.messageId}`);
        }
      } catch (error) {
        context.error(`Error generating ${draftType} draft:`, error);
        errors.push(`Failed to generate ${draftType}: ${String(error)}`);
      }
    }

    // Update record
    record.timestamps.lastUpdated = now;
    record.auditTrail.push({
      action: 'DRAFTS_GENERATED',
      timestamp: now,
      success: errors.length === 0,
      details: {
        draftTypes: body.draftTypes,
        generatedCount: drafts.length,
        errors,
      },
    });

    await storageClient.upsertProcessingRecord(record);

    // Write audit log
    await storageClient.writeAuditLog({
      timestamp: now,
      action: 'DRAFTS_GENERATED',
      actor: 'user',
      messageId: body.messageId,
      mailbox: body.mailbox,
      dossierId: body.dossierId || record.chosenDossierId,
      details: {
        draftTypes: body.draftTypes,
        draftIds: drafts.map(d => d.id),
      },
      success: true,
    });

    const response: GenerateDraftsResponse = {
      success: errors.length === 0,
      drafts,
      errors: errors.length > 0 ? errors : undefined,
    };

    return { status: 200, jsonBody: response };
  } catch (error) {
    context.error('Error generating drafts:', error);
    return {
      status: 500,
      jsonBody: { success: false, errors: ['Internal server error'] },
    };
  }
}

app.http('generate-drafts', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'drafts/generate',
  handler: generateDrafts,
});
