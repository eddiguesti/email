import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}

// Only these columns may be set by the client. user_id / email are always
// derived from the session and must never come from the request body.
const ALLOWED_PREF_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  display_name:        (v) => v === null || typeof v === 'string',
  email_notifications: (v) => typeof v === 'boolean',
  urgent_alerts:       (v) => typeof v === 'boolean',
  language:            (v) => typeof v === 'string' && v.length > 0 && v.length <= 10,
  onboarded:           (v) => typeof v === 'boolean',
  onboarded_at:        (v) => typeof v === 'string',
  bot_mode:            (v) => ['observation', 'assiste', 'automatique'].includes(v as string),
  email_filter:        (v) => ['smart', 'all', 'clients'].includes(v as string),
};

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Whitelist: only accept known preference fields with correct types.
  // Never trust user_id or email from the body — always use session values.
  const updates: Record<string, unknown> = {};
  for (const [key, validator] of Object.entries(ALLOWED_PREF_VALIDATORS)) {
    if (key in body) {
      if (!validator(body[key])) {
        return NextResponse.json(
          { error: `Invalid value for field: ${key}` },
          { status: 400 }
        );
      }
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields provided' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(
      { user_id: user.userId, email: user.email, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log user activity
  supabaseAdmin.from('activity_logs').insert({
    user_id: user.userId,
    user_email: user.email,
    user_name: user.name,
    action: 'settings_updated',
    details: { changes: Object.keys(updates) },
    resource_type: 'user_preferences',
    resource_id: user.userId,
  }).then(() => {});

  return NextResponse.json({ preferences: data });
}
