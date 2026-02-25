import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  const sessionUser = getUserFromRequest(req);

  if (sessionUser && sessionUser.userId !== 'demo-user-1') {
    // Log activity only — do NOT set is_active: false (that permanently deactivates the account)
    try {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: sessionUser.userId,
        user_email: sessionUser.email,
        user_name: sessionUser.name,
        action: 'logout',
      });
    } catch { /* non-blocking */ }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('lb_session', '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
  });
  return response;
}
