/**
 * Get Processing Status
 * Returns the current status of an email being processed
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';
import {
  createStorageClientFromEnv,
  type GetStatusResponse,
  type AutoSendPolicy,
} from '@lb-bot/shared';

const AUTO_SEND_POLICY: AutoSendPolicy = {
  enabled: process.env.AUTO_SEND_ENABLED === 'true',
  allowedDraftTypes: ['fee_reminder_1', 'fee_reminder_2', 'fee_reminder_final', 'leave_acknowledgement', 'client_transmittal'],
  requireKnownThread: true,
  requirePreviousReply: true,
  minConfidence: parseFloat(process.env.AUTO_APPROVE_CONFIDENCE_THRESHOLD || '0.85'),
  delayMinutes: parseInt(process.env.AUTO_SEND_DELAY_MINUTES || '5', 10),
  blockedDomains: [],
};

/**
 * Get email processing status
 * GET /api/status/{mailbox}/{messageId}
 */
export async function getStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  const mailbox = request.params.mailbox;
  const messageId = request.params.messageId;

  if (!mailbox || !messageId) {
    return {
      status: 400,
      jsonBody: { error: 'mailbox and messageId are required' },
    };
  }

  // Ownership check — users may only check status for their own mailbox
  if (mailbox !== session.email) {
    return { status: 403, jsonBody: { error: 'Accès interdit' } };
  }

  try {
    const storageClient = createStorageClientFromEnv();

    // Get the processing record
    const record = await storageClient.getProcessingRecord(mailbox, messageId);

    if (!record) {
      const response: GetStatusResponse = {
        found: false,
        canAutoFile: false,
        canAutoSend: false,
      };
      return { status: 404, jsonBody: response };
    }

    // Get drafts for this message
    const drafts = await storageClient.getDrafts(messageId);

    // Determine if auto-file is possible
    const canAutoFile =
      record.matchResults.length > 0 &&
      record.matchResults[0].confidence >= AUTO_SEND_POLICY.minConfidence;

    // Determine if auto-send is allowed
    let canAutoSend = false;
    let autoSendBlocked: string | undefined;

    if (!AUTO_SEND_POLICY.enabled) {
      autoSendBlocked = 'Auto-send is disabled';
    } else if (record.extractedSignals?.threadPosition === 0 && AUTO_SEND_POLICY.requirePreviousReply) {
      autoSendBlocked = 'Cannot auto-send: no previous reply in thread';
    } else if (record.matchResults.length === 0) {
      autoSendBlocked = 'Cannot auto-send: no dossier match';
    } else if (record.matchResults[0].confidence < AUTO_SEND_POLICY.minConfidence) {
      autoSendBlocked = `Cannot auto-send: confidence ${record.matchResults[0].confidence} below threshold ${AUTO_SEND_POLICY.minConfidence}`;
    } else {
      canAutoSend = true;
    }

    const response: GetStatusResponse = {
      found: true,
      record,
      suggestedDossier: record.matchResults[0],
      alternativeDossiers: record.matchResults.slice(1, 3),
      attachments: record.attachments,
      drafts,
      canAutoFile,
      canAutoSend,
      autoSendBlocked,
    };

    return { status: 200, jsonBody: response };
  } catch (error) {
    context.error('Error getting status:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('get-status', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'status/{mailbox}/{messageId}',
  handler: getStatus,
});
