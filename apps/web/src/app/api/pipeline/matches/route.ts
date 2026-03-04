import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50', 10), 200);

  let matches = [...MOCK_DATA.match_logs] as Record<string, unknown>[];

  const matched = searchParams.get('matched');
  if (matched === 'true') matches = matches.filter(m => m.matched === true);
  if (matched === 'false') matches = matches.filter(m => m.matched === false);

  const confMin = parseFloat(searchParams.get('confidence_min') || '');
  const confMax = parseFloat(searchParams.get('confidence_max') || '');
  if (!isNaN(confMin)) matches = matches.filter(m => (m.confidence as number) >= confMin);
  if (!isNaN(confMax)) matches = matches.filter(m => (m.confidence as number) <= confMax);

  const source = searchParams.get('source');
  if (source) matches = matches.filter(m => m.match_source === source);

  const handler = searchParams.get('handler');
  if (handler) matches = matches.filter(m => (m.handler as string || '').toLowerCase().includes(handler.toLowerCase()));

  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  if (dateFrom) matches = matches.filter(m => (m.received_at as string) >= dateFrom);
  if (dateTo) matches = matches.filter(m => (m.received_at as string) <= dateTo);

  const reviewed = searchParams.get('reviewed');
  if (reviewed === 'true') matches = matches.filter(m => m.review_approved !== null);
  if (reviewed === 'false') matches = matches.filter(m => m.review_approved === null);

  const category = searchParams.get('category');
  if (category) matches = matches.filter(m => m.category_color === category);

  matches.sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string));

  const total = matches.length;
  const from = (page - 1) * perPage;
  const paginated = matches.slice(from, from + perPage);

  return NextResponse.json({ matches: paginated, total, page, per_page: perPage });
}
