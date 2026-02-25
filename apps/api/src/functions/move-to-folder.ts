/**
 * Move Email to Outlook Folder
 * Moves a message to a named folder, creating it first if it doesn't exist.
 * Supports both well-known folders (Junk) and custom LB folders.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';
import { GraphClient } from '@lb-bot/shared';

// Well-known Graph folder names (case-insensitive match on incoming folderName)
const WELL_KNOWN: Record<string, string> = {
  junk: 'junkemail',
  spam: 'junkemail',
  inbox: 'inbox',
  deleted: 'deleteditems',
  sent: 'sentitems',
  drafts: 'drafts',
};

const RequestSchema = z.object({
  mailbox: z.string().email(),
  messageId: z.string().min(1),
  folderName: z.string().min(1),
});

/**
 * Move an email to a folder (creates the folder if it doesn't exist)
 * POST /api/move-to-folder
 */
async function moveToFolder(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { success: false, error: 'Non authentifié' } };
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody);
  } catch {
    return { status: 400, jsonBody: { success: false, error: 'Invalid request body' } };
  }

  // Ownership check — users may only move emails in their own mailbox
  if (body.mailbox !== session.email) {
    return { status: 403, jsonBody: { success: false, error: 'Accès interdit' } };
  }

  try {
    const graphClient = new GraphClient({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    });

    // Resolve destination — well-known folder name or find/create custom folder
    const wellKnownKey = body.folderName.toLowerCase().replace(/[^a-z]/g, '');
    const destinationId = WELL_KNOWN[wellKnownKey]
      ?? await graphClient.findOrCreateFolder(body.mailbox, body.folderName);

    await graphClient.moveMessage(body.mailbox, body.messageId, destinationId);

    context.log(`Moved ${body.messageId} → "${body.folderName}" (${destinationId}) for ${body.mailbox}`);

    return { status: 200, jsonBody: { success: true, folderName: body.folderName, destinationId } };
  } catch (error) {
    context.error('Error moving email to folder:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to move email' } };
  }
}

app.http('move-to-folder', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'move-to-folder',
  handler: moveToFolder,
});
