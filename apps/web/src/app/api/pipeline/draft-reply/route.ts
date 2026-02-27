import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';
import {
  fetchSentEmails,
  extractStyleProfile,
  generateDraftReply,
  type StyleProfile,
  type AIConfig,
} from '@lb-bot/shared/drafting';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_MODEL = 'grok-3-latest';

/**
 * Acquire a Graph API token using client_credentials flow.
 */
async function getGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)');
  }

  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to get Graph token: ${resp.status}`);
  }

  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Load or create a style profile for the given lawyer email.
 */
async function getOrCreateStyleProfile(
  lawyerEmail: string,
  displayName: string,
  aiConfig: AIConfig
): Promise<StyleProfile> {
  // Check cache
  const { data: cached } = await supabaseAdmin
    .from('lawyer_style_profiles')
    .select('*')
    .eq('email', lawyerEmail)
    .single();

  if (cached && cached.expires_at && new Date(cached.expires_at) > new Date()) {
    return {
      email: cached.email,
      displayName: cached.display_name || displayName,
      styleSummary: cached.style_summary,
      sampleGreetings: cached.sample_greetings || [],
      sampleSignoffs: cached.sample_signoffs || [],
      formalityLevel: cached.formality_level || 'formal',
      avgReplyLength: cached.avg_reply_length || 150,
      rawSamples: cached.raw_samples || [],
      expiresAt: cached.expires_at,
    };
  }

  // Fetch sent emails from Graph API and extract style
  const graphToken = await getGraphToken();
  const sentEmails = await fetchSentEmails(graphToken, lawyerEmail, 20);
  const profile = await extractStyleProfile(sentEmails, lawyerEmail, displayName, aiConfig);

  // Cache in Supabase
  await supabaseAdmin.from('lawyer_style_profiles').upsert(
    {
      email: profile.email,
      display_name: profile.displayName,
      style_summary: profile.styleSummary,
      sample_greetings: profile.sampleGreetings,
      sample_signoffs: profile.sampleSignoffs,
      formality_level: profile.formalityLevel,
      avg_reply_length: profile.avgReplyLength,
      raw_samples: profile.rawSamples,
      expires_at: profile.expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );

  return profile;
}

export async function POST(req: NextRequest) {
  // Auth check FIRST
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { matchId } = body as { matchId: string };

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    // 1. Fetch match_log
    const { data: match, error: matchErr } = await supabaseAdmin
      .from('match_logs')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // 2. Verify the match belongs to the authenticated user's mailbox (admins bypass this)
    // Require mailbox to be set and matching — a null mailbox is NOT a pass
    if (!user.isAdmin && match.mailbox !== user.email) {
      return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
    }

    // 3. AI config
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 500 });
    }

    const aiConfig: AIConfig = {
      apiKey,
      apiUrl: process.env.XAI_API_URL || XAI_API_URL,
      model: process.env.XAI_MODEL || XAI_MODEL,
    };

    // 4. Fetch the actual email body so the AI can reply to what was written
    let emailSubject: string | undefined;
    let emailBody: string | undefined;
    if (match.email_id && match.mailbox) {
      try {
        const graphToken = await getGraphToken();
        const GRAPH = 'https://graph.microsoft.com/v1.0';
        const msgUrl = `${GRAPH}/users/${encodeURIComponent(match.mailbox)}/messages/${encodeURIComponent(match.email_id)}?$select=subject,body,bodyPreview`;
        const msgRes = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${graphToken}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (msgRes.ok) {
          const msg = await msgRes.json() as {
            subject?: string;
            bodyPreview?: string;
            body?: { contentType?: string; content?: string };
          };
          emailSubject = msg.subject || undefined;
          const rawBody = msg.body?.contentType === 'html'
            ? msg.body.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : msg.body?.content || msg.bodyPreview || '';
          emailBody = rawBody ? rawBody.slice(0, 2500) : undefined;
        }
      } catch {
        // Non-fatal — generate without email body
      }
    }

    // 5. Get or create style profile for the lawyer
    const lawyerEmail = match.mailbox || match.lawyer || '';
    const displayName = match.lawyer || lawyerEmail.split('@')[0];
    const style = await getOrCreateStyleProfile(lawyerEmail, displayName, aiConfig);

    // 6. Generate draft reply
    const result = await generateDraftReply(style, {
      senderName: match.sender_name || '',
      senderEmail: match.sender_email || '',
      subject: emailSubject,
      emailBody,
      dossierRef: match.dossier_ref || null,
      dossierName: match.dossier_name || null,
      matchReasons: match.match_reasons || [],
      matchSource: match.match_source || null,
      isEBarreau: match.is_ebarreau || false,
      lawyerEmail,
    }, aiConfig);

    // Log user activity
    supabaseAdmin.from('activity_logs').insert({
      user_id: user.userId,
      user_email: user.email,
      user_name: user.name,
      action: 'draft_generated',
      details: {
        dossier_ref: match.dossier_ref,
        sender_email: match.sender_email,
        confidence: result.confidence,
      },
      resource_type: 'match_log',
      resource_id: matchId,
    }).then(() => {});

    return NextResponse.json(result);
  } catch (err) {
    console.error('Draft reply error:', err);
    return NextResponse.json(
      { error: 'Impossible de générer le brouillon' },
      { status: 500 }
    );
  }
}
