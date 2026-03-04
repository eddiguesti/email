import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface SessionUser {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

function checkIsAdmin(userId: string): boolean {
  const adminIds = process.env.ADMIN_USER_IDS || '';
  const lc = userId.toLowerCase();
  return adminIds.split(',').map(s => s.trim().toLowerCase()).includes(lc);
}

/**
 * Verify and decode a signed session token.
 * Format: base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))
 */
function verifySessionToken(token: string): SessionUser | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('SESSION_SECRET not set — cannot verify session tokens');
    return null;
  }

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null; // Unsigned legacy token — reject

  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expected = createHmac('sha256', secret).update(data).digest('base64url');

  // Constant-time comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (!payload.userId || !payload.email) return null;
    // Require exp claim — tokens without an expiry are rejected outright
    if (!payload.exp || payload.exp < Date.now()) return null;
    const userId = payload.userId;
    return {
      userId,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      isAdmin: checkIsAdmin(userId),
    };
  } catch {
    return null;
  }
}

/**
 * Extract user from session cookie (lb_session).
 */
export function getUserFromRequest(req: NextRequest): SessionUser | null {
  // Demo mode check FIRST — no session cookie required
  if (process.env.DEV_MODE === 'true') {
    const isDemo = req.cookies.get('lb_demo_mode')?.value === 'true';
    if (isDemo) {
      return { userId: 'demo-user-1', email: 'reservations@grandazurehotel.com', name: 'Demo User', isAdmin: true };
    }
  }

  // Try session cookie, then Authorization header as fallback
  let session = req.cookies.get('lb_session')?.value;
  if (!session) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      session = authHeader.slice(7);
    }
  }
  if (!session) return null;

  return verifySessionToken(session);
}
