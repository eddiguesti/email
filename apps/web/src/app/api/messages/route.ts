/**
 * GET /api/messages?id={messageId}             → fetch single email body + headers
 * GET /api/messages?conversationId={convId}    → fetch all emails in thread
 *
 * Uses the authenticated user's decrypted MS Graph token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { decryptToken } from '@lb-bot/shared';

const GRAPH = 'https://graph.microsoft.com/v1.0';

async function getAccessToken(microsoftId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('lawyers')
    .select('access_token')
    .eq('microsoft_id', microsoftId)
    .single();
  if (!data?.access_token) return null;
  return decryptToken(data.access_token);
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const accessToken = await getAccessToken(user.userId);
  if (!accessToken) return NextResponse.json({ error: 'Token introuvable' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const messageId     = searchParams.get('id');
  const conversationId = searchParams.get('conversationId');

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };

  try {
    // ── Single message ────────────────────────────────────────────────────
    if (messageId) {
      const select = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,hasAttachments,conversationId,isRead,importance,internetMessageId';
      const url    = `${GRAPH}/me/messages/${encodeURIComponent(messageId)}?$select=${select}`;
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
      const url = new URL(`${GRAPH}/me/messages`);
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
