/**
 * Azure Functions proxy
 *
 * All browser → Azure API calls go through here so that:
 * 1. The browser never sees the Azure URL (no CORS issue, URL stays hidden)
 * 2. The HttpOnly lb_session cookie is readable server-side — the browser
 *    cannot read it via document.cookie, but Next.js route handlers can.
 * 3. The session token is forwarded as Authorization: Bearer to Azure.
 *
 * Usage: /api/azure/<path> → ${AZURE_API_URL}/<path>
 * All methods (GET, POST, PUT, PATCH, DELETE) are supported.
 */

import { NextRequest, NextResponse } from 'next/server';

const AZURE_API_URL = process.env.AZURE_API_URL;

type Params = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!AZURE_API_URL) {
    return NextResponse.json(
      { error: 'Azure API not configured (missing AZURE_API_URL)' },
      { status: 503 }
    );
  }

  // Read the HttpOnly session cookie — only possible server-side
  const session = req.cookies.get('lb_session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { path } = await params;

  // Build the upstream URL, preserving the full query string
  const targetUrl = new URL(`${AZURE_API_URL}/${path.join('/')}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Forward the body for mutating methods
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text();
  }

  let azureRes: Response;
  try {
    azureRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session}`,
      },
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
