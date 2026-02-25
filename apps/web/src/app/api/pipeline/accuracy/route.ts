/**
 * Accuracy Tuning API
 * GET /api/pipeline/accuracy?days=30&mailbox=...
 *
 * Analyzes lawyer review decisions to surface accuracy patterns
 * and suggest confidence threshold adjustments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 180);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Always scope to the authenticated user's own mailbox — never trust a client-provided value
    let query = supabaseAdmin
      .from('match_logs')
      .select('id, confidence, match_source, matched, review_approved, reviewed_at, dossier_ref, lawyer, mailbox, created_at')
      .eq('mailbox', user.email)
      .gte('created_at', cutoff);

    const { data: logs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        review_coverage: { total: 0, reviewed: 0, unreviewed: 0, coverage_rate: 0 },
        accuracy_by_source: [],
        accuracy_by_confidence_band: [],
        threshold_recommendations: [],
        false_positives: [],
        daily_accuracy: [],
      });
    }

    // ── Review Coverage ──
    const total = logs.filter(l => l.matched).length;
    const reviewed = logs.filter(l => l.review_approved !== null).length;
    const unreviewed = total - reviewed;
    const coverageRate = total > 0 ? reviewed / total : 0;

    // ── Accuracy by Source ──
    const sourceGroups = new Map<string, { approved: number; rejected: number; total: number; totalConf: number }>();
    for (const log of logs) {
      if (log.review_approved === null || !log.match_source) continue;
      const src = log.match_source;
      if (!sourceGroups.has(src)) {
        sourceGroups.set(src, { approved: 0, rejected: 0, total: 0, totalConf: 0 });
      }
      const g = sourceGroups.get(src)!;
      g.total++;
      g.totalConf += log.confidence || 0;
      if (log.review_approved) g.approved++;
      else g.rejected++;
    }

    const accuracyBySource = Array.from(sourceGroups.entries())
      .map(([source, g]) => ({
        source,
        total: g.total,
        approved: g.approved,
        rejected: g.rejected,
        accuracy: g.total > 0 ? g.approved / g.total : 0,
        avg_confidence: g.total > 0 ? g.totalConf / g.total : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Accuracy by Confidence Band (5% increments) ──
    const bands = new Map<string, { approved: number; total: number }>();
    for (const log of logs) {
      if (log.review_approved === null || log.confidence === null) continue;
      const bandLow = Math.floor(log.confidence * 20) * 5;
      const bandHigh = bandLow + 5;
      const bandKey = `${bandLow}-${bandHigh}%`;
      if (!bands.has(bandKey)) {
        bands.set(bandKey, { approved: 0, total: 0 });
      }
      const b = bands.get(bandKey)!;
      b.total++;
      if (log.review_approved) b.approved++;
    }

    const accuracyByConfidenceBand = Array.from(bands.entries())
      .map(([band, b]) => ({
        band,
        total: b.total,
        approved: b.approved,
        accuracy: b.total > 0 ? b.approved / b.total : 0,
      }))
      .sort((a, b) => {
        const aNum = parseInt(a.band);
        const bNum = parseInt(b.band);
        return aNum - bNum;
      });

    // ── Threshold Recommendations ──
    const currentAutoFileThreshold = 0.85;
    const currentReviewThreshold = 0.60;

    // Find the lowest confidence where accuracy >= 90%
    let suggestedAutoFile = currentAutoFileThreshold;
    for (const band of accuracyByConfidenceBand) {
      const bandLow = parseInt(band.band) / 100;
      if (band.total >= 5 && band.accuracy >= 0.90 && bandLow < suggestedAutoFile) {
        suggestedAutoFile = bandLow;
      }
    }

    // Find the lowest confidence where accuracy >= 70%
    let suggestedReview = currentReviewThreshold;
    for (const band of accuracyByConfidenceBand) {
      const bandLow = parseInt(band.band) / 100;
      if (band.total >= 3 && band.accuracy >= 0.70 && bandLow < suggestedReview) {
        suggestedReview = bandLow;
      }
    }

    const thresholdRecommendations = [
      {
        threshold: 'auto_file',
        current: currentAutoFileThreshold,
        suggested: suggestedAutoFile,
        reasoning: suggestedAutoFile < currentAutoFileThreshold
          ? `Accuracy is ≥90% down to ${(suggestedAutoFile * 100).toFixed(0)}% confidence — auto-file threshold could be lowered`
          : 'Current threshold is appropriate',
      },
      {
        threshold: 'review',
        current: currentReviewThreshold,
        suggested: suggestedReview,
        reasoning: suggestedReview < currentReviewThreshold
          ? `Accuracy is ≥70% down to ${(suggestedReview * 100).toFixed(0)}% confidence — review threshold could be lowered`
          : 'Current threshold is appropriate',
      },
    ];

    // ── False Positives ──
    const falsePositives = logs
      .filter(l => l.review_approved === false && l.matched)
      .map(l => ({
        match_source: l.match_source,
        confidence: l.confidence,
        dossier_ref: l.dossier_ref,
        mailbox: l.mailbox,
        created_at: l.created_at,
      }))
      .slice(0, 50);

    // ── Daily Accuracy ──
    const dailyGroups = new Map<string, { approved: number; rejected: number; total: number }>();
    for (const log of logs) {
      if (log.review_approved === null) continue;
      const date = (log.reviewed_at || log.created_at).slice(0, 10);
      if (!dailyGroups.has(date)) {
        dailyGroups.set(date, { approved: 0, rejected: 0, total: 0 });
      }
      const d = dailyGroups.get(date)!;
      d.total++;
      if (log.review_approved) d.approved++;
      else d.rejected++;
    }

    const dailyAccuracy = Array.from(dailyGroups.entries())
      .map(([date, d]) => ({
        date,
        total: d.total,
        approved: d.approved,
        rejected: d.rejected,
        accuracy: d.total > 0 ? d.approved / d.total : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      review_coverage: {
        total,
        reviewed,
        unreviewed,
        coverage_rate: coverageRate,
      },
      accuracy_by_source: accuracyBySource,
      accuracy_by_confidence_band: accuracyByConfidenceBand,
      threshold_recommendations: thresholdRecommendations,
      false_positives: falsePositives,
      daily_accuracy: dailyAccuracy,
    });
  } catch (err) {
    console.error('Accuracy API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
