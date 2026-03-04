import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    id: 'demo-user-1',
    email: 'demo@grandazurehotel.com',
    displayName: 'Demo User',
  });
}
