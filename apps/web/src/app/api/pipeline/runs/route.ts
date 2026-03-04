import { NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET() {
  const runs = [...MOCK_DATA.pipeline_runs].sort((a, b) =>
    (b.started_at as string).localeCompare(a.started_at as string)
  );
  return NextResponse.json({ runs, total: runs.length });
}
