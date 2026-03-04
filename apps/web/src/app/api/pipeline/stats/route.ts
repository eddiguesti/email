import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 365);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const allLogs = (MOCK_DATA.match_logs as Record<string, unknown>[]).filter(
    l => (l.created_at as string) >= cutoff
  );

  const matched = allLogs.filter(l => l.matched);
  const totalProcessed = allLogs.length;
  const totalMatched = matched.length;
  const avgConfidence = totalMatched > 0
    ? matched.reduce((s, l) => s + (l.confidence as number || 0), 0) / totalMatched : 0;
  const totalAutoFile = matched.filter(l => (l.confidence as number || 0) >= 0.85).length;
  const totalReview = matched.filter(l => { const c = l.confidence as number || 0; return c >= 0.60 && c < 0.85; }).length;
  const totalNoMatch = allLogs.filter(l => !l.matched).length;

  const bins = Array.from({ length: 10 }, (_, i) => ({ band: `${i * 10}-${(i + 1) * 10}%`, count: 0 }));
  for (const log of matched) {
    const idx = Math.min(Math.floor((log.confidence as number || 0) * 10), 9);
    bins[idx].count++;
  }

  const sourceMap = new Map<string, { count: number; totalConf: number }>();
  for (const log of matched) {
    const src = log.match_source as string || 'unknown';
    const e = sourceMap.get(src) || { count: 0, totalConf: 0 };
    e.count++; e.totalConf += log.confidence as number || 0;
    sourceMap.set(src, e);
  }
  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, { count, totalConf }]) => ({ source, count, avg_confidence: count > 0 ? totalConf / count : 0 }))
    .sort((a, b) => b.count - a.count);

  const dailyMap = new Map<string, { processed: number; matched: number; auto_filed: number }>();
  for (const log of allLogs) {
    const date = (log.created_at as string).slice(0, 10);
    const e = dailyMap.get(date) || { processed: 0, matched: 0, auto_filed: 0 };
    e.processed++;
    if (log.matched) { e.matched++; if ((log.confidence as number || 0) >= 0.85) e.auto_filed++; }
    dailyMap.set(date, e);
  }
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, s]) => ({ date, ...s }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    overview: {
      total_processed: totalProcessed, total_matched: totalMatched,
      match_rate: totalProcessed > 0 ? totalMatched / totalProcessed : 0,
      avg_confidence: avgConfidence, total_auto_file: totalAutoFile,
      total_review: totalReview, total_no_match: totalNoMatch,
    },
    confidence_distribution: bins,
    source_breakdown: sourceBreakdown,
    daily_stats: dailyStats,
    mailbox_stats: [{ mailbox: 'demo@grandazurehotel.com', processed: totalProcessed, matched: totalMatched, match_rate: totalProcessed > 0 ? totalMatched / totalProcessed : 0 }],
  });
}
