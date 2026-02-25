/**
 * OAuth Callback - Handle Microsoft redirect
 * Exchanges authorization code for tokens and creates/updates user
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createHmac } from 'node:crypto';
import { createStorageClientFromEnv, type UserTokens } from '@lb-bot/shared';

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const REDIRECT_URI = process.env.AUTH_REDIRECT_URI || 'http://localhost:7071/api/auth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

/**
 * Handle OAuth callback from Microsoft
 * GET /api/auth/callback
 */
export async function authCallback(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const code = request.query.get('code');
  const state = request.query.get('state');
  const error = request.query.get('error');
  const errorDescription = request.query.get('error_description');

  // Handle OAuth errors
  if (error) {
    context.error(`OAuth error: ${error} - ${errorDescription}`);
    return redirectWithError('access_denied', errorDescription || error);
  }

  if (!code) {
    return redirectWithError('missing_code', 'Authorization code not provided');
  }

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    context.error('Missing Azure AD configuration');
    return redirectWithError('server_error', 'Server configuration error');
  }

  // Parse state for redirect URL — only allow relative paths to prevent open redirect
  let postLoginRedirect = '/';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      const raw = decoded.redirect || '/';
      if (raw.startsWith('/') && !raw.startsWith('//')) {
        postLoginRedirect = raw;
      }
    } catch {
      context.warn('Failed to decode state parameter');
    }
  }

  try {
    // Exchange code for tokens
    const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      context.error('Token exchange failed:', errorText);
      return redirectWithError('token_error', 'Failed to exchange authorization code');
    }

    const tokenData = await tokenResponse.json() as TokenResponse;

    // Get user profile from Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!graphResponse.ok) {
      context.error('Failed to fetch user profile');
      return redirectWithError('profile_error', 'Failed to fetch user profile');
    }

    const graphUser = await graphResponse.json() as GraphUser;

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Prepare tokens for storage
    const tokens: UserTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scopes: tokenData.scope.split(' '),
    };

    // Store user and tokens
    const storageClient = createStorageClientFromEnv();
    const user = await storageClient.upsertUser(
      graphUser.id,
      graphUser.mail || graphUser.userPrincipalName,
      graphUser.displayName,
      tokens
    );

    context.log(`User logged in: ${user.email} (${user.id})`);

    // Create HMAC-signed session token
    // Format: base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      context.error('SESSION_SECRET not configured');
      return redirectWithError('server_error', 'Server configuration error');
    }

    const payload = Buffer.from(
      JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.display_name,
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
    ).toString('base64url');

    const sig = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
    const sessionToken = `${payload}.${sig}`;

    // Redirect to frontend — token delivered via HttpOnly cookie only (not URL)
    const redirectUrl = new URL(postLoginRedirect, FRONTEND_URL);

    return {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
        'Cache-Control': 'no-store',
        'Set-Cookie': `lb_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      },
    };
  } catch (error) {
    context.error('OAuth callback error:', error);
    return redirectWithError('server_error', 'Internal server error');
  }
}

function redirectWithError(error: string, description: string): HttpResponseInit {
  const errorUrl = new URL('/auth/error', process.env.FRONTEND_URL || 'http://localhost:3000');
  errorUrl.searchParams.set('error', error);
  errorUrl.searchParams.set('description', description);

  return {
    status: 302,
    headers: {
      Location: errorUrl.toString(),
      'Cache-Control': 'no-store',
    },
  };
}

app.http('auth-callback', {
  methods: ['GET'],
  authLevel: 'anonymous', // Public endpoint
  route: 'auth/callback',
  handler: authCallback,
});
