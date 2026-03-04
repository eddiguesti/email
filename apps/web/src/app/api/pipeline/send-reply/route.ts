import { NextResponse } from 'next/server';

export async function POST() {
  await new Promise(r => setTimeout(r, 500)); // simulate sending delay
  return NextResponse.json({ success: true, message_id: `demo-sent-${Date.now()}` });
}
