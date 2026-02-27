/**
 * Outlook add-in API proxy
 *
 * The Outlook add-in task pane makes all API calls through this proxy so that:
 * 1. The Azure Functions URL and host key are never shipped in the client bundle.
 * 2. Session authentication is enforced server-side before any upstream call.
 * 3. The Azure Functions key is injected here from a server-side env var.
 *
 * Usage: /api/addin/<path> → ${AZURE_API_URL}/api/<path>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-server';

const AZURE_API_URL = process.env.AZURE_API_URL;
const AZURE_FUNCTIONS_KEY = process.env.AZURE_FUNCTIONS_KEY;

type Params = { params: Promise<{ path: string[] }> };

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
  const url = new URL(`${normalizedBase}/api/${segments.join('/')}`);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url;
}

async function handler(req: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!AZURE_API_URL) {
    return NextResponse.json({ error: 'Azure API not configured' }, { status: 503 });
  }

  if (!getUserFromRequest(req)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const session =
    req.cookies.get('lb_session')?.value ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

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

  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.text()
      : undefined;

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${session}`,
  };
  if (AZURE_FUNCTIONS_KEY) {
    upstreamHeaders['x-functions-key'] = AZURE_FUNCTIONS_KEY;
  }
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
    console.error('[addin-proxy] upstream fetch failed:', err);
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
