'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MATCH_SOURCE_LABELS } from '@/types/pipeline';
import type { PipelineStats } from '@/types/pipeline';
import { getPipelineStats } from '@/lib/pipeline-api';
import MatchRateChart from '@/components/pipeline/MatchRateChart';

const selectClasses = "px-3 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200";
const tooltipStyle = {
  backgroundColor: '#fff',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  padding: '12px 16px',
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getPipelineStats({ days })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-64 bg-white rounded-2xl shadow-[var(--shadow-card)] animate-shimmer" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return <p className="text-[13px] text-[var(--muted-foreground)]">Loading error</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2.5">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectClasses}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {stats.daily_stats.length > 0 && (
        <MatchRateChart data={stats.daily_stats} />
      )}

      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">Confidence distribution</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.confidence_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{ fill: '#86868b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#86868b', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#1d1d1f" radius={[6, 6, 0, 0]} name="Emails" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">Source Efficiency</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--border)]">
                <th className="pb-3 font-medium">Source</th>
                <th className="pb-3 font-medium text-right">Nombre</th>
                <th className="pb-3 font-medium text-right">% du total</th>
                <th className="pb-3 font-medium text-right">Avg. Confidence</th>
              </tr>
            </thead>
            <tbody>
              {stats.source_breakdown.map(s => (
                <tr key={s.source} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="py-3 text-[13px] text-[var(--foreground)]">
                    {MATCH_SOURCE_LABELS[s.source] || s.source}
                  </td>
                  <td className="py-3 text-right text-[13px] font-medium text-[var(--foreground)]">{s.count}</td>
                  <td className="py-3 text-right text-[13px] text-[var(--muted-foreground)]">
                    {stats.overview.total_matched > 0 ? Math.round((s.count / stats.overview.total_matched) * 100) : 0}%
                  </td>
                  <td className="py-3 text-right">
                    <span className={`text-[13px] font-medium ${
                      s.avg_confidence >= 0.85 ? 'text-emerald-500' :
                      s.avg_confidence >= 0.60 ? 'text-amber-500' : 'text-red-400'
                    }`}>
                      {Math.round(s.avg_confidence * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {stats.mailbox_stats.length > 1 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">Performance by Mailbox</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.mailbox_stats.map(mb => (
              <div key={mb.mailbox} className="p-5 bg-[var(--muted)] rounded-xl">
                <p className="text-[14px] font-medium text-[var(--foreground)] mb-3">{mb.mailbox}</p>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-[20px] font-light tracking-tight text-[var(--foreground)]">{mb.processed}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">Processed</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-light tracking-tight text-emerald-500">{mb.matched}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">Routed</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-light tracking-tight text-[var(--foreground)]">{Math.round(mb.match_rate * 100)}%</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">Rate</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
