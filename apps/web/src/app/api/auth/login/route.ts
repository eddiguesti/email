import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const REDIRECT_URI = process.env.AUTH_REDIRECT_URI;

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

export async function GET(req: NextRequest) {
  if (!TENANT_ID || !CLIENT_ID || !REDIRECT_URI) {
    return NextResponse.json({ error: 'OAuth not configured' }, { status: 500 });
  }

  const rawRedirect = req.nextUrl.searchParams.get('redirect') || '/dashboard';
  // Only allow relative paths — prevent open redirect via absolute URLs
  const postLoginRedirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/dashboard';

  const state = Buffer.from(
    JSON.stringify({
      nonce: randomBytes(16).toString('hex'),
      redirect: postLoginRedirect,
    })
  ).toString('base64url');

  const authUrl = new URL(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`
  );
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  return NextResponse.redirect(authUrl.toString());
}
