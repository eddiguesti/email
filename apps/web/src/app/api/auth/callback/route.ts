import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-server';
import { encryptToken } from '@lb-bot/shared';

function signSessionToken(payload: object): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var is not set');
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const REDIRECT_URI = process.env.AUTH_REDIRECT_URI;
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.laurencebrosset-avocats.fr';
const isDev = process.env.NODE_ENV !== 'production';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');
  const errorDescription = req.nextUrl.searchParams.get('error_description');

  if (error) {
    const errorUrl = new URL('/login', FRONTEND_URL);
    errorUrl.searchParams.set('error', errorDescription || error);
    return NextResponse.redirect(errorUrl.toString());
  }

  if (!code || !TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    const errorUrl = new URL('/login', FRONTEND_URL);
    errorUrl.searchParams.set('error', 'Configuration manquante');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Parse state for post-login redirect — only allow relative paths
  let postLoginRedirect = '/dashboard';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      const raw = decoded.redirect || '/dashboard/review';
      // Reject absolute URLs and protocol-relative URLs to prevent open redirect
      if (raw.startsWith('/') && !raw.startsWith('//')) {
        postLoginRedirect = raw;
      }
    } catch {
      // ignore malformed state
    }
  }

  try {
    if (isDev) console.log('[auth-callback] Starting token exchange, redirect_uri:', REDIRECT_URI);

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenResponse.ok) {
      if (isDev) {
        const errBody = await tokenResponse.text();
        console.error('[auth-callback] Token exchange failed:', tokenResponse.status, errBody);
      } else {
        console.error('[auth-callback] Token exchange failed:', tokenResponse.status);
      }
      const errorUrl = new URL('/login', FRONTEND_URL);
      errorUrl.searchParams.set('error', `Échec de l'authentification (${tokenResponse.status})`);
      return NextResponse.redirect(errorUrl.toString());
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    // Get user profile from Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!graphResponse.ok) {
      const errorUrl = new URL('/login', FRONTEND_URL);
      errorUrl.searchParams.set('error', 'Impossible de récupérer le profil');
      return NextResponse.redirect(errorUrl.toString());
    }

    const graphUser = (await graphResponse.json()) as GraphUser;
    const email = graphUser.mail || graphUser.userPrincipalName;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Upsert user in Supabase
    await supabaseAdmin.from('lawyers').upsert(
      {
        microsoft_id: graphUser.id,
        email,
        display_name: graphUser.displayName,
        access_token: encryptToken(tokenData.access_token),
        refresh_token: encryptToken(tokenData.refresh_token),
        token_expires_at: expiresAt,
        scopes: tokenData.scope.split(' '),
        is_active: true,
        last_login_at: new Date().toISOString(),
      },
      { onConflict: 'microsoft_id' }
    );

    // Always use microsoft_id as the session userId — consistent with all table schemas
    // (lawyers.microsoft_id, calendar_suggestions.user_id, etc.)
    const userId = graphUser.id;

    // Create HMAC-signed session token
    const sessionToken = signSessionToken({
      userId,
      email,
      name: graphUser.displayName,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    if (isDev) console.log('[auth-callback] Success! User:', email, 'Redirecting to:', postLoginRedirect);
    const redirectUrl = new URL(postLoginRedirect, FRONTEND_URL);
    const response = NextResponse.redirect(redirectUrl.toString());
    response.cookies.set('lb_session', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400,
      secure: process.env.NODE_ENV === 'production',
    });

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      user_email: email,
      user_name: graphUser.displayName,
      action: 'login',
      details: { method: 'microsoft_oauth' },
    });

    // Auto-create Graph subscription for email monitoring (if not already active)
    const { data: lawyer } = await supabaseAdmin
      .from('lawyers')
      .select('graph_subscription_id, subscription_expires_at')
      .eq('microsoft_id', graphUser.id)
      .single();

    const subscriptionExpired = !lawyer?.subscription_expires_at ||
      new Date(lawyer.subscription_expires_at) < new Date();

    if (!lawyer?.graph_subscription_id || subscriptionExpired) {
      try {
        // AZURE_API_URL already includes the /api route prefix
        // e.g. https://lb-bot-api.azurewebsites.net/api
        // so we append the function route directly (no extra /api/)
        const AZURE_API_URL = process.env.AZURE_API_URL;
        const API_KEY = process.env.AZURE_FUNCTIONS_KEY || '';
        if (AZURE_API_URL) {
          const subResponse = await fetch(
            `${AZURE_API_URL}/subscriptions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-functions-key': API_KEY,
              },
              body: JSON.stringify({ action: 'create', mailbox: email }),
            }
          );
          if (subResponse.ok) {
            const subData = await subResponse.json() as { subscription?: { id: string; expiresAt: string } };
            if (subData.subscription) {
              await supabaseAdmin.from('lawyers').update({
                graph_subscription_id: subData.subscription.id,
                subscription_expires_at: subData.subscription.expiresAt,
              }).eq('microsoft_id', graphUser.id);
            }
          }
        }
      } catch {
        // Non-blocking — subscription can be created manually later
      }
    }

    return response;
  } catch (err) {
    console.error('[auth-callback] Unhandled error during login', isDev ? err : '');
    const errorUrl = new URL('/login', FRONTEND_URL);
    errorUrl.searchParams.set('error', 'Une erreur est survenue. Veuillez réessayer.');
    return NextResponse.redirect(errorUrl.toString());
  }
}
