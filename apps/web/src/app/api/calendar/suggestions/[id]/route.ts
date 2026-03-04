import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const suggestion = MOCK_DATA.calendar_suggestions.find(s => (s as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  Object.assign(suggestion, body);
  return NextResponse.json({ suggestion });
}
