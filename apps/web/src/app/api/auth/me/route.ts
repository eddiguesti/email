import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromRequest(req);

  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Demo mode — return session data directly
  if (sessionUser.userId === 'demo-user-1') {
    return NextResponse.json({
      id: sessionUser.userId,
      email: sessionUser.email,
      displayName: sessionUser.name,
    });
  }

  // Fetch full user from Supabase
  const { data: user, error } = await supabaseAdmin
    .from('lawyers')
    .select('id, email, display_name, is_active')
    .eq('id', sessionUser.userId)
    .single();

  if (error || !user) {
    // Fallback to session data if user not found in DB yet
    return NextResponse.json({
      id: sessionUser.userId,
      email: sessionUser.email,
      displayName: sessionUser.name,
    });
  }

  if (!user.is_active) {
    return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
  });
}
