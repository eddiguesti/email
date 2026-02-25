/**
 * OAuth Login - Redirect to Microsoft
 * Initiates the OAuth2 authorization code flow
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomBytes } from 'crypto';
import { checkRateLimit, errorResponse } from '../utils/auth.js';

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const REDIRECT_URI = process.env.AUTH_REDIRECT_URI || 'http://localhost:7071/api/auth/callback';

// Scopes needed for per-user delegated access
const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.Read',
  'Calendars.ReadWrite',
].join(' ');

/**
 * Initiate OAuth login
 * GET /api/auth/login
 *
 * Query params:
 * - redirect: URL to redirect to after successful login (optional)
 */
export async function authLogin(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Rate limit: max 10 login initiations per IP per minute
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`auth-login:${clientIp}`, 10, 60000)) {
    return errorResponse(429, 'Trop de tentatives, réessayez dans 1 minute');
  }

  if (!TENANT_ID || !CLIENT_ID) {
    context.error('Missing Azure AD configuration');
    return {
      status: 500,
      jsonBody: { error: 'Server configuration error' },
    };
  }

  // Get optional redirect URL from query
  const postLoginRedirect = request.query.get('redirect') || '/';

  // Generate state parameter for CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      nonce: randomBytes(16).toString('hex'),
      redirect: postLoginRedirect,
    })
  ).toString('base64url');

  // Build Microsoft OAuth URL
  const authUrl = new URL(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`
  );

  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account'); // Always show account picker

  context.log(`Redirecting to Microsoft login for OAuth`);

  return {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Cache-Control': 'no-store',
    },
  };
}

app.http('auth-login', {
  methods: ['GET'],
  authLevel: 'anonymous', // Public endpoint
  route: 'auth/login',
  handler: authLogin,
});
