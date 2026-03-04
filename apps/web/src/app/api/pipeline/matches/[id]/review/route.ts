import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { approved } = await req.json() as Record<string, unknown>;

  if (typeof approved !== 'boolean') {
    return NextResponse.json({ error: 'approved must be boolean' }, { status: 400 });
  }

  const match = MOCK_DATA.match_logs.find(m => (m as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Mutate in-memory so UI reflects the change during the session
  match.review_approved = approved;
  match.reviewed_by = 'Demo User';
  match.reviewed_at = new Date().toISOString();
  match.category_label = approved ? 'Approved' : 'Rejected';
  match.category_color = approved ? 'green' : 'red';

  return NextResponse.json({ match });
}
