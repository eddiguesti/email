import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 180);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const logs = (MOCK_DATA.match_logs as Record<string, unknown>[]).filter(
    l => (l.created_at as string) >= cutoff
  );

  const total = logs.filter(l => l.matched).length;
  const reviewed = logs.filter(l => l.review_approved !== null && l.review_approved !== undefined).length;

  const sourceGroups = new Map<string, { approved: number; rejected: number; total: number; totalConf: number }>();
  for (const log of logs) {
    if (log.review_approved === null || log.review_approved === undefined || !log.match_source) continue;
    const src = log.match_source as string;
    if (!sourceGroups.has(src)) sourceGroups.set(src, { approved: 0, rejected: 0, total: 0, totalConf: 0 });
    const g = sourceGroups.get(src)!;
    g.total++; g.totalConf += log.confidence as number || 0;
    if (log.review_approved) g.approved++; else g.rejected++;
  }
  const accuracyBySource = Array.from(sourceGroups.entries())
    .map(([source, g]) => ({ source, total: g.total, approved: g.approved, rejected: g.rejected,
      accuracy: g.total > 0 ? g.approved / g.total : 0, avg_confidence: g.total > 0 ? g.totalConf / g.total : 0 }))
    .sort((a, b) => b.total - a.total);

  const bands = new Map<string, { approved: number; total: number }>();
  for (const log of logs) {
    if (log.review_approved === null || log.review_approved === undefined || log.confidence === null) continue;
    const bandLow = Math.floor((log.confidence as number) * 20) * 5;
    const key = `${bandLow}-${bandLow + 5}%`;
    if (!bands.has(key)) bands.set(key, { approved: 0, total: 0 });
    const b = bands.get(key)!;
    b.total++;
    if (log.review_approved) b.approved++;
  }
  const accuracyByConfidenceBand = Array.from(bands.entries())
    .map(([band, b]) => ({ band, total: b.total, approved: b.approved, accuracy: b.total > 0 ? b.approved / b.total : 0 }))
    .sort((a, b) => parseInt(a.band) - parseInt(b.band));

  const falsePositives = logs
    .filter(l => l.review_approved === false && l.matched)
    .map(l => ({ match_source: l.match_source, confidence: l.confidence, dossier_ref: l.dossier_ref, created_at: l.created_at }))
    .slice(0, 50);

  return NextResponse.json({
    review_coverage: { total, reviewed, unreviewed: total - reviewed, coverage_rate: total > 0 ? reviewed / total : 0 },
    accuracy_by_source: accuracyBySource,
    accuracy_by_confidence_band: accuracyByConfidenceBand,
    threshold_recommendations: [
      { threshold: 'auto_file', current: 0.85, suggested: 0.85, reasoning: 'Current threshold is appropriate' },
      { threshold: 'review', current: 0.60, suggested: 0.60, reasoning: 'Current threshold is appropriate' },
    ],
    false_positives: falsePositives,
    daily_accuracy: [],
  });
}
