import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Client } from '@microsoft/microsoft-graph-client';
import { authenticateRequest, errorResponse, checkRateLimit } from '../utils/auth.js';

interface EmailMessage {
  id: string;
  subject: string;
  from: { name: string; email: string };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  preview: string;
  flag: { flagStatus: string };
}

async function getEmails(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`emails:${clientIp}`, 60, 60000)) {
    return errorResponse(429, 'Trop de requêtes, veuillez réessayer plus tard');
  }

  // Authenticate — HMAC-verified session, auto-refreshes and decrypts token
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  const rawFolderId = request.query.get('folderId') || 'inbox';
  // Allowlist folderId to prevent path injection into Graph API URL
  const folderId = rawFolderId === 'inbox' || /^[A-Za-z0-9_=+/\-]{1,300}$/.test(rawFolderId)
    ? rawFolderId
    : 'inbox';
  const skip = Math.max(0, parseInt(request.query.get('skip') || '0', 10));
  const top = Math.min(100, Math.max(1, parseInt(request.query.get('top') || '25', 10)));

  try {
    const graphClient = Client.init({
      authProvider: (done) => done(null, auth.user.accessToken),
    });

    const apiPath = folderId === 'inbox'
      ? '/me/mailFolders/inbox/messages'
      : `/me/mailFolders/${folderId}/messages`;

    const messagesResponse = await graphClient
      .api(apiPath)
      .select('id,subject,from,receivedDateTime,isRead,hasAttachments,importance,bodyPreview,flag')
      .orderby('receivedDateTime desc')
      .skip(skip)
      .top(top)
      .get();

    const emails: EmailMessage[] = messagesResponse.value.map((msg: any) => ({
      id: msg.id,
      subject: msg.subject || '(Sans objet)',
      from: {
        name: msg.from?.emailAddress?.name || 'Inconnu',
        email: msg.from?.emailAddress?.address || '',
      },
      receivedDateTime: msg.receivedDateTime,
      isRead: msg.isRead || false,
      hasAttachments: msg.hasAttachments || false,
      importance: msg.importance || 'normal',
      preview: msg.bodyPreview || '',
      flag: { flagStatus: msg.flag?.flagStatus || 'notFlagged' },
    }));

    const countResponse = await graphClient.api(apiPath).count(true).top(0).get();
    context.log(`Fetched ${emails.length} emails for ${auth.user.email}`);

    return {
      status: 200,
      jsonBody: { emails, total: countResponse['@odata.count'] || emails.length, skip, top },
    };
  } catch (error: any) {
    context.error('Error fetching emails:', error);
    if (error?.statusCode === 401) return errorResponse(401, 'Token invalide, veuillez vous reconnecter');
    return errorResponse(500, 'Erreur lors de la récupération des emails');
  }
}

app.http('get-emails', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'emails',
  handler: getEmails,
});
