/**
 * Refresh OAuth Tokens
 * Refreshes the access token using the refresh token
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createStorageClientFromEnv, type UserTokens, type DbUser } from '@lb-bot/shared';
import { parseSessionToken, getUserFromRequest } from './auth-me.js';
import { checkRateLimit, errorResponse } from '../utils/auth.js';

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Refresh OAuth tokens for a user
 */
export async function refreshUserTokens(user: DbUser): Promise<UserTokens | null> {
  if (!user.refresh_token) {
    return null;
  }

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Azure AD configuration');
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const tokenParams = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: user.refresh_token,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const tokenData = await response.json() as TokenResponse;

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    scopes: tokenData.scope.split(' '),
  };
}

/**
 * Check if tokens need refresh (within 5 minutes of expiry)
 */
export function tokensNeedRefresh(user: DbUser): boolean {
  if (!user.token_expires_at) return true;

  const expiresAt = new Date(user.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  return expiresAt <= fiveMinutesFromNow;
}

/**
 * Get valid access token for user (refresh if needed)
 */
export async function getValidAccessToken(user: DbUser): Promise<string | null> {
  if (!user.access_token) return null;

  // Check if token needs refresh
  if (tokensNeedRefresh(user)) {
    const storageClient = createStorageClientFromEnv();
    const newTokens = await refreshUserTokens(user);

    if (!newTokens) return null;

    await storageClient.updateUserTokens(user.id, newTokens);
    return newTokens.accessToken;
  }

  return user.access_token;
}

/**
 * Refresh tokens for current user
 * POST /api/auth/refresh
 */
export async function authRefresh(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Rate limit: max 5 token refreshes per IP per minute
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`auth-refresh:${clientIp}`, 5, 60000)) {
    return errorResponse(429, 'Trop de tentatives, réessayez dans 1 minute');
  }

  const user = await getUserFromRequest(request, context);

  if (!user) {
    return {
      status: 401,
      jsonBody: { error: 'Not authenticated' },
    };
  }

  if (!user.refresh_token) {
    return {
      status: 400,
      jsonBody: { error: 'No refresh token available' },
    };
  }

  try {
    const newTokens = await refreshUserTokens(user);

    if (!newTokens) {
      return {
        status: 400,
        jsonBody: { error: 'Failed to refresh tokens' },
      };
    }

    const storageClient = createStorageClientFromEnv();
    await storageClient.updateUserTokens(user.id, newTokens);

    context.log(`Tokens refreshed for user: ${user.email}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        expiresAt: newTokens.expiresAt.toISOString(),
      },
    };
  } catch (error) {
    context.error('Token refresh error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to refresh tokens' },
    };
  }
}

/**
 * Logout - Clear tokens
 * POST /api/auth/logout
 */
export async function authLogout(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const user = await getUserFromRequest(request, context);

  if (!user) {
    return {
      status: 401,
      jsonBody: { error: 'Not authenticated' },
    };
  }

  try {
    context.log(`User logged out: ${user.email}`);

    return {
      status: 200,
      headers: {
        // Clear session cookie
        'Set-Cookie': 'lb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      },
      jsonBody: { success: true },
    };
  } catch (error) {
    context.error('Logout error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to logout' },
    };
  }
}

app.http('auth-refresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/refresh',
  handler: authRefresh,
});

app.http('auth-logout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: authLogout,
});
