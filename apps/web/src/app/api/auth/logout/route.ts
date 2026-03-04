import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('lb_session', '', { path: '/', maxAge: 0 });
  res.cookies.set('lb_demo_mode', '', { path: '/', maxAge: 0 });
  return res;
}
