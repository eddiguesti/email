import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function POST(req: NextRequest) {
  const { matchId, question } = await req.json() as { matchId?: string; question?: string };
  if (!matchId || !question?.trim()) {
    return NextResponse.json({ error: 'matchId and question are required' }, { status: 400 });
  }

  const m = MOCK_DATA.match_logs.find(l => (l as Record<string, unknown>).id === matchId) as Record<string, unknown> | undefined;
  const dossierName = (m?.dossier_name as string) || 'this booking';
  const department = (m?.handler as string) || 'the relevant department';
  const receivedDate = m?.received_at ? new Date(m.received_at as string).toLocaleDateString('en-GB') : 'recently';

  return NextResponse.json({
    answer: `Based on the booking records, "${dossierName}" is assigned to ${department}. The latest email was received on ${receivedDate} with a match confidence of ${m?.confidence ? ((m.confidence as number) * 100).toFixed(0) + '%' : 'N/A'}. *(Demo mode — AI assistant not connected)*`,
  });
}
