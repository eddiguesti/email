/**
 * POST /api/pipeline/send-reply
 *
 * Sends a reply to an email using Microsoft Graph API.
 * Flow:
 *   1. createReply  – Graph creates a draft reply that already includes the
 *                     user's Outlook signature and the quoted original message.
 *   2. GET draft    – Fetch the draft to retrieve its pre-built body HTML.
 *   3. PATCH draft  – Prepend the user's edited reply text to the draft body.
 *   4. send         – POST to /send to dispatch the message.
 *
 * The signature is preserved because Outlook embeds it in the draft body
 * when createReply is called (honouring the user's "add signature to replies"
 * setting). We prepend text rather than replacing the whole body, so the
 * signature block and quoted message are never touched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-server';

const GRAPH    = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

// Shared token cache (same pattern as /api/messages)
let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

async function getAppToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const { AZURE_CLIENT_ID: clientId, AZURE_CLIENT_SECRET: clientSecret, AZURE_TENANT_ID: tenantId } = process.env;
  if (!clientId || !clientSecret || !tenantId) throw new Error('Azure credentials not configured');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);

  const data = await res.json() as { access_token: string; expires_in?: number };
  cachedToken       = data.access_token;
  cachedTokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return cachedToken;
}

/** Convert plain-text reply to simple Outlook-compatible HTML paragraphs. */
function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim() === '' ? '<div><br></div>' : `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`)
    .join('');
}

/**
 * Strip outer <html><head>...</head><body> ... </body></html> wrapper and
 * return just the inner body HTML so we can prepend our text to it.
 */
function extractBodyHtml(fullHtml: string): string {
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : fullHtml;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { matchId?: string; emailId?: string; mailbox?: string; replyText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { matchId, emailId, mailbox, replyText } = body;

  if (!emailId || !mailbox || !replyText?.trim()) {
    return NextResponse.json({ error: 'emailId, mailbox et replyText sont requis' }, { status: 400 });
  }

  // 2. Ownership check — non-admins can only send from their own mailbox
  if (!user.isAdmin && mailbox.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  try {
    const token   = await getAppToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const userBase = `${GRAPH}/users/${encodeURIComponent(mailbox)}`;

    // 3. Create the reply draft — Outlook fills in the signature + quoted message
    const createRes = await fetch(`${userBase}/messages/${encodeURIComponent(emailId)}/createReply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      console.error('[send-reply] createReply failed:', err);
      return NextResponse.json({ error: 'Impossible de créer le brouillon de réponse' }, { status: 502 });
    }
    const draft = await createRes.json() as { id: string; body?: { content?: string } };
    const draftId   = draft.id;
    const draftHtml = draft.body?.content ?? '';

    // 4. Build new body: user's text → existing draft body (signature + quoted message)
    const replyHtml  = textToHtml(replyText.trim());
    const existingInner = extractBodyHtml(draftHtml);
    const newBodyHtml = `<html><body>${replyHtml}<div><br></div>${existingInner}</body></html>`;

    // 5. PATCH the draft with the combined body
    const patchRes = await fetch(`${userBase}/messages/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body: { contentType: 'html', content: newBodyHtml } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error('[send-reply] PATCH draft failed:', err);
      return NextResponse.json({ error: 'Impossible de mettre à jour le brouillon' }, { status: 502 });
    }

    // 6. Send
    const sendRes = await fetch(`${userBase}/messages/${encodeURIComponent(draftId)}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error('[send-reply] send failed:', err);
      return NextResponse.json({ error: "Impossible d'envoyer l'email" }, { status: 502 });
    }

    // 7. Update match_log if matchId provided
    if (matchId) {
      await supabaseAdmin
        .from('match_logs')
        .update({ reply_sent: true, reply_sent_at: new Date().toISOString() })
        .eq('id', matchId);
    }

    // 8. Audit log (non-blocking)
    supabaseAdmin.from('activity_logs').insert({
      user_id:   user.userId,
      user_email: user.email,
      user_name:  user.name,
      action:    'reply_sent',
      resource_type: 'match_log',
      resource_id: matchId ?? null,
    }).then(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-reply]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
