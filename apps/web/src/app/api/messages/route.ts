import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    id: 'demo-message-1',
    subject: 'Demo Email — Grand Azure Hotel',
    body: '<p>This is a demo email body. In production, the full email content would be displayed here.</p>',
    from: { name: 'Demo Sender', email: 'demo@example.com' },
    receivedAt: new Date().toISOString(),
    messages: [],
  });
}
