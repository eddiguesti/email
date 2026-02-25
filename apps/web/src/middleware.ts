import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('lb_session')?.value;
  if (session) return NextResponse.next();

  // Allow demo mode through in local dev only.
  // DEV_MODE is a server-side env var (no NEXT_PUBLIC_ prefix) so it is
  // evaluated at runtime and never baked into the production bundle.
  const isDemo = request.cookies.get('lb_demo_mode')?.value === 'true';
  if (isDemo && process.env.DEV_MODE === 'true') {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
