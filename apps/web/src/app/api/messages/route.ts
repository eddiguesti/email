/**
 * GET /api/messages?id={messageId}&mailbox={addr}          → fetch single email body + headers
 * GET /api/messages?conversationId={convId}&mailbox={addr} → fetch all emails in thread
 *
 * Uses app-level Graph credentials (client_credentials) so shared mailboxes are accessible.
 * Falls back to the logged-in user's delegated token if no mailbox param is given.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';

const GRAPH    = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

// Module-level token cache so we don't hit the token endpoint on every request
let cachedAppToken: string | null = null;
let cachedAppTokenExpiry = 0;

async function getAppToken(): Promise<string | null> {
  if (cachedAppToken && Date.now() < cachedAppTokenExpiry) return cachedAppToken;

  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId     = process.env.AZURE_TENANT_ID;
  if (!clientId || !clientSecret || !tenantId) return null;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'https://graph.microsoft.com/.default',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  cachedAppToken       = data.access_token;
  cachedAppTokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return cachedAppToken;
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const messageId      = searchParams.get('id');
  const conversationId = searchParams.get('conversationId');
  const mailbox        = searchParams.get('mailbox');

  // App token lets us read any mailbox in the tenant (shared mailboxes included)
  const accessToken = await getAppToken();
  if (!accessToken) return NextResponse.json({ error: 'Token introuvable' }, { status: 401 });

  // Non-admin lawyers may only request their own mailbox
  if (mailbox && !user.isAdmin && mailbox.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Route to the specific mailbox; fall back to /me if no mailbox supplied
  const mailboxBase = mailbox
    ? `${GRAPH}/users/${encodeURIComponent(mailbox)}`
    : `${GRAPH}/me`;

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };

  try {
    // ── Single message ────────────────────────────────────────────────────
    if (messageId) {
      const select = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,hasAttachments,conversationId,isRead,importance,internetMessageId';
      const url    = `${mailboxBase}/messages/${encodeURIComponent(messageId)}?$select=${select}`;
      const res    = await fetch(url, { headers, cache: 'no-store' });

      if (!res.ok) {
        // Message may have been moved/deleted — return empty gracefully
        return NextResponse.json({ message: null, notFound: true }, { status: 200 });
      }

      const message = await res.json();
      return NextResponse.json({ message });
    }

    // ── Thread (by conversationId) ────────────────────────────────────────
    if (conversationId) {
      // Sanitise: Graph conversation IDs are base64url strings — reject anything else
      if (!/^[A-Za-z0-9+/=_-]{1,500}$/.test(conversationId)) {
        return NextResponse.json({ error: 'conversationId invalide' }, { status: 400 });
      }
      const url = new URL(`${mailboxBase}/messages`);
      url.searchParams.set('$filter', `conversationId eq '${conversationId}'`);
      url.searchParams.set('$select', 'id,subject,from,receivedDateTime,bodyPreview,isRead,importance');
      url.searchParams.set('$orderby', 'receivedDateTime asc');
      url.searchParams.set('$top', '20');

      const res = await fetch(url.toString(), { headers, cache: 'no-store' });
      if (!res.ok) return NextResponse.json({ thread: [] });

      const data = await res.json() as { value?: unknown[] };
      return NextResponse.json({ thread: data.value || [] });
    }

    return NextResponse.json({ error: 'id ou conversationId requis' }, { status: 400 });
  } catch (err) {
    console.error('[/api/messages]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
