import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 365);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Always scope to the authenticated user's own mailbox — never trust a client-provided value
  let query = supabaseAdmin
    .from('match_logs')
    .select('matched, confidence, match_source, mailbox, is_ebarreau, created_at')
    .eq('mailbox', user.email)
    .gte('created_at', cutoff);

  const { data: logs, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allLogs = logs || [];

  // Overview
  const totalProcessed = allLogs.length;
  const matched = allLogs.filter(l => l.matched);
  const totalMatched = matched.length;
  const avgConfidence = matched.length > 0
    ? matched.reduce((sum, l) => sum + (l.confidence || 0), 0) / matched.length
    : 0;
  const totalAutoFile = matched.filter(l => (l.confidence || 0) >= 0.85).length;
  const totalReview = matched.filter(l => {
    const c = l.confidence || 0;
    return c >= 0.60 && c < 0.85;
  }).length;
  const totalNoMatch = allLogs.filter(l => !l.matched).length;

  // Confidence distribution (10 bins)
  const bins = Array.from({ length: 10 }, (_, i) => ({
    band: `${i * 10}-${(i + 1) * 10}%`,
    min: i * 0.1,
    max: (i + 1) * 0.1,
    count: 0,
  }));
  for (const log of matched) {
    const c = log.confidence || 0;
    const idx = Math.min(Math.floor(c * 10), 9);
    bins[idx].count++;
  }

  // Source breakdown
  const sourceMap = new Map<string, { count: number; totalConf: number }>();
  for (const log of matched) {
    const src = log.match_source || 'unknown';
    const entry = sourceMap.get(src) || { count: 0, totalConf: 0 };
    entry.count++;
    entry.totalConf += log.confidence || 0;
    sourceMap.set(src, entry);
  }
  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, { count, totalConf }]) => ({
      source,
      count,
      avg_confidence: count > 0 ? totalConf / count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Daily stats
  const dailyMap = new Map<string, { processed: number; matched: number; auto_filed: number }>();
  for (const log of allLogs) {
    const date = log.created_at.slice(0, 10);
    const entry = dailyMap.get(date) || { processed: 0, matched: 0, auto_filed: 0 };
    entry.processed++;
    if (log.matched) {
      entry.matched++;
      if ((log.confidence || 0) >= 0.85) entry.auto_filed++;
    }
    dailyMap.set(date, entry);
  }
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Per-mailbox stats
  const mbMap = new Map<string, { processed: number; matched: number }>();
  for (const log of allLogs) {
    const mb = log.mailbox;
    const entry = mbMap.get(mb) || { processed: 0, matched: 0 };
    entry.processed++;
    if (log.matched) entry.matched++;
    mbMap.set(mb, entry);
  }
  const mailboxStats = Array.from(mbMap.entries())
    .map(([mb, { processed, matched: m }]) => ({
      mailbox: mb,
      processed,
      matched: m,
      match_rate: processed > 0 ? m / processed : 0,
    }))
    .sort((a, b) => b.processed - a.processed);

  return NextResponse.json({
    overview: {
      total_processed: totalProcessed,
      total_matched: totalMatched,
      match_rate: totalProcessed > 0 ? totalMatched / totalProcessed : 0,
      avg_confidence: avgConfidence,
      total_auto_file: totalAutoFile,
      total_review: totalReview,
      total_no_match: totalNoMatch,
    },
    confidence_distribution: bins.map(b => ({ band: b.band, count: b.count })),
    source_breakdown: sourceBreakdown,
    daily_stats: dailyStats,
    mailbox_stats: mailboxStats,
  });
}
