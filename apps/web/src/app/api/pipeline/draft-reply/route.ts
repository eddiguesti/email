import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function POST(req: NextRequest) {
  const { matchId } = await req.json() as { matchId?: string };
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

  const m = MOCK_DATA.match_logs.find(l => (l as Record<string, unknown>).id === matchId) as Record<string, unknown> | undefined;
  const guestName = (m?.dossier_name as string)?.split('—')[0]?.trim() || 'Valued Guest';
  const ref = (m?.dossier_ref as string) || 'your booking';
  const department = (m?.handler as string) || 'our team';

  const draft = `Dear ${guestName},

Thank you for your email regarding ${ref}. We have received your message and it has been assigned to our ${department} team.

We will review your request and get back to you within 24 hours with a full response. In the meantime, if you have any urgent queries, please do not hesitate to contact us directly.

We look forward to welcoming you to the Grand Azure Hotel.

Warm regards,
${department} Team
Grand Azure Hotel`;

  return NextResponse.json({ draft, subject: `Re: ${ref}` });
}
