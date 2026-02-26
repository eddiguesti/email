/**
 * Azure Functions proxy
 *
 * All browser → Azure API calls go through here so that:
 * 1. The browser never sees the Azure URL (no CORS issue, URL stays hidden)
 * 2. The HttpOnly lb_session cookie is readable server-side — the browser
 *    cannot read it via document.cookie, but Next.js route handlers can.
 * 3. The session token is validated (HMAC + expiry) before being forwarded
 *    as Authorization: Bearer to Azure Functions.
 *
 * Usage: /api/azure/<path> → ${AZURE_API_URL}/<path>
 * Supported methods: GET, POST, PUT, PATCH, DELETE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';

const AZURE_API_URL = process.env.AZURE_API_URL;

type Params = { params: Promise<{ path: string[] }> };

/**
 * Build the upstream URL from the base, path segments, and query params.
 *
 * - Strips trailing slashes from the base to prevent double-slash segments
 *   (URL constructor does NOT normalise `//` inside a path).
 * - Rejects `..` and `.` segments to prevent path traversal out of the
 *   intended Azure Functions path prefix.
 */
function buildTargetUrl(
  base: string,
  segments: string[],
  searchParams: URLSearchParams,
): URL {
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new Error('Path traversal attempt');
    }
  }
  const normalizedBase = base.replace(/\/+$/, '');
  const url = new URL(`${normalizedBase}/${segments.join('/')}`);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url;
}

async function handler(req: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!AZURE_API_URL) {
    return NextResponse.json(
      { error: 'Azure API not configured' },
      { status: 503 },
    );
  }

  // Verify the session token (HMAC signature + expiry) before touching the upstream.
  // FIX: the original code only checked for cookie *existence*; expired or tampered
  // tokens were still forwarded. Consistent with all other routes in this app.
  // BEHAVIOR CHANGE: invalid/expired tokens now return 401 from this proxy
  // (body: { error: 'Non authentifié' }) instead of being forwarded to Azure.
  if (!getUserFromRequest(req)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Extract the raw token for forwarding. getUserFromRequest accepts cookie or
  // Authorization header; we replicate the same priority so the forwarded token
  // matches what was just verified.
  const session =
    req.cookies.get('lb_session')?.value ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

  // Defensive guard — unreachable if getUserFromRequest() succeeded above.
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { path } = await params;

  let targetUrl: URL;
  try {
    targetUrl = buildTargetUrl(AZURE_API_URL, path, req.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'Invalid request path' }, { status: 400 });
  }

  // Read the body for methods that carry one.
  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.text()
      : undefined;

  // Only set Content-Type when there is a body to describe. Attaching it to
  // GET/HEAD requests is semantically wrong and was a bug in the original.
  // Forward the request's own Content-Type; fall back to application/json.
  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${session}`,
  };
  if (body !== undefined) {
    upstreamHeaders['Content-Type'] =
      req.headers.get('Content-Type') ?? 'application/json';
  }

  let azureRes: Response;
  try {
    azureRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: upstreamHeaders,
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error('[azure-proxy] upstream fetch failed:', err);
    return NextResponse.json({ error: 'Azure API unreachable' }, { status: 502 });
  }

  const json = await azureRes.json().catch(() => ({ error: 'Non-JSON response from upstream' }));
  return NextResponse.json(json, { status: azureRes.status });
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const PATCH  = handler;
export const DELETE = handler;
