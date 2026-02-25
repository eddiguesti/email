import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

// POST — save a push subscription
export async function POST(req: NextRequest) {
  const sessionUser = getUserFromRequest(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const subscription = await req.json();
  const { endpoint, keys } = subscription;

  if (
    typeof endpoint !== 'string' ||
    typeof keys?.p256dh !== 'string' ||
    typeof keys?.auth !== 'string' ||
    endpoint.length === 0 ||
    endpoint.length > 2048 ||
    keys.p256dh.length > 512 ||
    keys.auth.length > 256
  ) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: sessionUser.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a push subscription (only the owner can delete their own)
export async function DELETE(req: NextRequest) {
  const sessionUser = getUserFromRequest(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { endpoint } = await req.json();

  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', sessionUser.userId);

  return NextResponse.json({ ok: true });
}
