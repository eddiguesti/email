import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.toLowerCase();
  let senders = [...MOCK_DATA.sender_history] as Record<string, unknown>[];
  if (search) senders = senders.filter(s => (s.sender_email as string).toLowerCase().includes(search));
  senders.sort((a, b) => (b.match_count as number) - (a.match_count as number));
  return NextResponse.json({ senders, total: senders.length });
}
