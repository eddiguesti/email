import { NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET() {
  const logs = [...MOCK_DATA.activity_logs].sort((a, b) =>
    (b.created_at as string).localeCompare(a.created_at as string)
  );
  return NextResponse.json({ logs, total: logs.length });
}

export async function POST() {
  return NextResponse.json({ log: null }, { status: 201 });
}
