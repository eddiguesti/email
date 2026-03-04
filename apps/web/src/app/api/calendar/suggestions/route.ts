import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'pending';
  let suggestions = [...MOCK_DATA.calendar_suggestions] as Record<string, unknown>[];
  if (status !== 'all') suggestions = suggestions.filter(s => s.status === status);
  suggestions.sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string));
  return NextResponse.json({ suggestions, count: suggestions.length });
}
