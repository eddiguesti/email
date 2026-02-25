/**
 * Shared Authentication Utilities
 *
 * Centralized auth helpers for all API endpoints.
 * Handles session validation, token retrieval, and audit logging.
 */

import { HttpRequest } from '@azure/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decryptToken, createStorageClientFromEnv } from '@lb-bot/shared';
import { refreshUserTokens, tokensNeedRefresh } from '../functions/auth-refresh.js';

// Singleton Supabase client
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    }

    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// Types
export interface SessionData {
  userId: string;
  email: string;
  name?: string;
  exp: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name?: string;
  accessToken: string;
  tokenExpiresAt?: Date;
}

export type AuthResult = {
  success: true;
  user: AuthenticatedUser;
} | {
  success: false;
  error: string;
  status: 401 | 403;
};

/**
 * Extract session token from request (header or cookie)
 */
export function extractSessionToken(request: HttpRequest): string | null {
  // Check Authorization header first (preferred for API calls)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionMatch = cookieHeader.match(/lb_session=([^;]+)/);
  return sessionMatch ? sessionMatch[1] : null;
}

/**
 * Verify HMAC signature and decode session token.
 * Format: base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))
 */
export function decodeSessionToken(token: string): SessionData | null {
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
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (!decoded.userId || !decoded.exp || decoded.exp <= Date.now()) return null;
    return {
      userId: decoded.userId,
      email: decoded.email || '',
      name: decoded.name,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Get user ID only (for endpoints that don't need access token)
 */
export function getUserIdFromRequest(request: HttpRequest): string | null {
  const token = extractSessionToken(request);
  if (!token) return null;

  const session = decodeSessionToken(token);
  return session?.userId || null;
}

/**
 * Full authentication with access token retrieval
 * Use this for endpoints that need to call Microsoft Graph
 */
export async function authenticateRequest(request: HttpRequest): Promise<AuthResult> {
  const token = extractSessionToken(request);
  if (!token) {
    return { success: false, error: 'No session token provided', status: 401 };
  }

  const session = decodeSessionToken(token);
  if (!session) {
    return { success: false, error: 'Invalid or expired session', status: 401 };
  }

  try {
    const supabase = getSupabase();

    // Get user with access token from database
    const { data: lawyer, error } = await supabase
      .from('lawyers')
      .select('id, email, display_name, access_token, refresh_token, token_expires_at, is_active')
      .eq('id', session.userId)
      .single();

    if (error || !lawyer) {
      return { success: false, error: 'User not found', status: 401 };
    }

    if (!lawyer.is_active) {
      return { success: false, error: 'Account deactivated', status: 403 };
    }

    if (!lawyer.access_token) {
      return { success: false, error: 'No access token - please re-authenticate', status: 401 };
    }

    // Auto-refresh token if expired or expiring soon
    // Cast to DbUser — refreshUserTokens/tokensNeedRefresh only use token_expires_at and refresh_token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lawyerAsDbUser = lawyer as any;
    let rawAccessToken = lawyer.access_token;
    if (tokensNeedRefresh(lawyerAsDbUser)) {
      try {
        const newTokens = await refreshUserTokens(lawyerAsDbUser);
        if (newTokens) {
          const storageClient = createStorageClientFromEnv();
          await storageClient.updateUserTokens(lawyer.id, newTokens);
          rawAccessToken = newTokens.accessToken;
        } else if (!rawAccessToken) {
          return { success: false, error: 'Token expired and refresh failed — please re-authenticate', status: 401 };
        }
      } catch {
        if (!rawAccessToken) {
          return { success: false, error: 'Token expired and refresh failed — please re-authenticate', status: 401 };
        }
        // If refresh throws but we still have an existing token, continue with it
      }
    }

    // Decrypt token before returning (handles both encrypted and legacy plaintext)
    const accessToken = decryptToken(rawAccessToken);
    if (!accessToken) {
      return { success: false, error: 'Failed to decrypt access token', status: 401 };
    }

    return {
      success: true,
      user: {
        userId: lawyer.id,
        email: lawyer.email,
        name: lawyer.display_name,
        accessToken,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed', status: 401 };
  }
}

/**
 * Log security-relevant events
 */
export async function logSecurityEvent(
  action: string,
  lawyerId: string | null,
  request: HttpRequest,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getSupabase();

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;

    const userAgent = request.headers.get('user-agent') || null;

    await supabase.from('security_audit_log').insert({
      action,
      lawyer_id: lawyerId,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: details || {},
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log security event:', error);
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Rate limiting check (simple in-memory, use Redis in production)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Create standard error response
 */
export function errorResponse(status: number, message: string, details?: unknown) {
  return {
    status,
    jsonBody: {
      error: message,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Create standard success response
 */
export function successResponse<T>(data: T, status: number = 200) {
  return {
    status,
    jsonBody: data,
  };
}
