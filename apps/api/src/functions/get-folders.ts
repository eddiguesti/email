import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Client } from '@microsoft/microsoft-graph-client';
import { authenticateRequest, errorResponse } from '../utils/auth.js';

interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

async function getFolders(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Authenticate — HMAC-verified session, auto-refreshes and decrypts token
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const graphClient = Client.init({
      authProvider: (done) => done(null, auth.user.accessToken),
    });

    // Fetch mail folders
    const foldersResponse = await graphClient
      .api('/me/mailFolders')
      .select('id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount')
      .top(50)
      .get();

    const folders: MailFolder[] = foldersResponse.value.map((folder: any) => ({
      id: folder.id,
      displayName: folder.displayName,
      parentFolderId: folder.parentFolderId || null,
      childFolderCount: folder.childFolderCount || 0,
      unreadItemCount: folder.unreadItemCount || 0,
      totalItemCount: folder.totalItemCount || 0,
    }));

    // Also fetch child folders for common folders like Inbox
    const inboxFolder = folders.find(f => f.displayName === 'Inbox' || f.displayName === 'Boîte de réception');
    if (inboxFolder && inboxFolder.childFolderCount > 0) {
      const childFoldersResponse = await graphClient
        .api(`/me/mailFolders/${inboxFolder.id}/childFolders`)
        .select('id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount')
        .top(50)
        .get();

      const childFolders: MailFolder[] = childFoldersResponse.value.map((folder: any) => ({
        id: folder.id,
        displayName: folder.displayName,
        parentFolderId: folder.parentFolderId || inboxFolder.id,
        childFolderCount: folder.childFolderCount || 0,
        unreadItemCount: folder.unreadItemCount || 0,
        totalItemCount: folder.totalItemCount || 0,
      }));

      folders.push(...childFolders);
    }

    context.log(`Fetched ${folders.length} folders for user ${auth.user.email}`);

    return {
      status: 200,
      jsonBody: { folders },
    };
  } catch (error) {
    context.error('Error fetching folders:', error);

    if ((error as any).statusCode === 401) {
      return {
        status: 401,
        jsonBody: { error: 'Token invalide, veuillez vous reconnecter' },
      };
    }

    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des dossiers' },
    };
  }
}

app.http('get-folders', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'folders',
  handler: getFolders,
});
