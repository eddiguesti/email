import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const suggestion = MOCK_DATA.calendar_suggestions.find(s => (s as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
  if (suggestion) suggestion.status = 'dismissed';
  return NextResponse.json({ success: true });
}
