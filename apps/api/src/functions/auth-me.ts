/**
 * Get Current User
 * Returns the currently authenticated user's profile
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createStorageClientFromEnv, type DbUser } from '@lb-bot/shared';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  hasSubscription: boolean;
  subscriptionExpiresAt: string | null;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  exp: number;
}

/**
 * Verify HMAC signature and decode session token.
 * Format: base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))
 */
function verifyAndDecodeToken(token: string): SessionPayload | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null; // Unsigned token — reject

  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = createHmac('sha256', secret).update(data).digest('base64url');

  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (!payload.userId || !payload.exp || payload.exp <= Date.now()) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Parse session token from request
 */
export function parseSessionToken(request: HttpRequest): SessionPayload | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const result = verifyAndDecodeToken(authHeader.slice(7));
    if (result) return result;
  }

  // Check cookie
  const cookies = request.headers.get('Cookie');
  if (cookies) {
    const sessionCookie = cookies
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('lb_session='));

    if (sessionCookie) {
      const token = sessionCookie.split('=')[1];
      return verifyAndDecodeToken(token);
    }
  }

  return null;
}

/**
 * Get the current authenticated user
 * GET /api/auth/me
 */
export async function authMe(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Parse session token
  const session = parseSessionToken(request);

  if (!session) {
    return {
      status: 401,
      jsonBody: { error: 'Not authenticated' },
    };
  }

  try {
    const storageClient = createStorageClientFromEnv();
    const user = await storageClient.getUserById(session.userId);

    if (!user) {
      return {
        status: 401,
        jsonBody: { error: 'User not found' },
      };
    }

    if (!user.is_active) {
      return {
        status: 403,
        jsonBody: { error: 'Account deactivated' },
      };
    }

    const response: AuthUser = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      hasSubscription: !!user.graph_subscription_id,
      subscriptionExpiresAt: user.subscription_expires_at,
    };

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error('Error getting user:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * Helper to get user from request (for use in other endpoints)
 */
export async function getUserFromRequest(
  request: HttpRequest,
  context: InvocationContext
): Promise<DbUser | null> {
  const session = parseSessionToken(request);
  if (!session) return null;

  try {
    const storageClient = createStorageClientFromEnv();
    const user = await storageClient.getUserById(session.userId);
    return user && user.is_active ? user : null;
  } catch (error) {
    context.error('Error getting user from request:', error);
    return null;
  }
}

app.http('auth-me', {
  methods: ['GET'],
  authLevel: 'anonymous', // Uses session token instead
  route: 'auth/me',
  handler: authMe,
});
