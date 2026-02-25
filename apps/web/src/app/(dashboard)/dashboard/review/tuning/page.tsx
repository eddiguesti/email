'use client';

import { useEffect, useState } from 'react';
import { getAccuracyStats } from '@/lib/pipeline-api';
import type { AccuracyStats } from '@/types/pipeline';
import { MATCH_SOURCE_LABELS, MATCH_SOURCE_COLORS } from '@/types/pipeline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';

const selectClasses = "px-3 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200";
const tooltipStyle = {
  backgroundColor: '#fff',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  padding: '12px 16px',
};

export default function TuningPage() {
  const [stats, setStats] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAccuracyStats({ days })
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 animate-shimmer">
            <div className="h-4 bg-[var(--muted)] rounded w-1/3 mb-4" />
            <div className="h-40 bg-[var(--muted)] rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 border-l-2 border-l-red-400">
        <p className="text-[13px] text-red-500">Erreur: {error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const cov = stats.review_coverage;

  return (
    <div className="space-y-6">
      <div className="flex gap-2.5 items-center">
        <select value={days} onChange={e => setDays(Number(e.target.value))} className={selectClasses}>
          <option value={7}>7 jours</option>
          <option value={14}>14 jours</option>
          <option value={30}>30 jours</option>
          <option value={60}>60 jours</option>
          <option value={90}>90 jours</option>
        </select>
      </div>

      {/* Review Coverage */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">
          Couverture des revues
        </h2>
        <div className="grid grid-cols-4 gap-4 mb-5">
          <StatCard label="Total correspondances" value={cov.total} />
          <StatCard label="Revues" value={cov.reviewed} color="text-emerald-500" />
          <StatCard label="Non revues" value={cov.unreviewed} color="text-amber-500" />
          <StatCard
            label="Taux de couverture"
            value={`${(cov.coverage_rate * 100).toFixed(1)}%`}
            color={cov.coverage_rate >= 0.5 ? 'text-emerald-500' : 'text-amber-500'}
          />
        </div>
        {cov.total > 0 && (
          <div className="w-full bg-[var(--muted)] rounded-full h-1.5">
            <div
              className="bg-emerald-400 rounded-full h-1.5 transition-all duration-500"
              style={{ width: `${Math.min(cov.coverage_rate * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Accuracy by Source */}
      {stats.accuracy_by_source.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">
            Précision par source
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={stats.accuracy_by_source.map(s => ({
                ...s,
                label: MATCH_SOURCE_LABELS[s.source] || s.source,
                accuracyPct: Math.round(s.accuracy * 100),
              }))}
              layout="vertical"
              margin={{ left: 140, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#86868b' }} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: '#1d1d1f' }} />
              <Tooltip formatter={(value) => [`${value}%`, 'Précision']} contentStyle={tooltipStyle} />
              <Bar dataKey="accuracyPct" radius={[0, 6, 6, 0]}>
                {stats.accuracy_by_source.map((s, i) => (
                  <Cell key={i} fill={s.accuracy >= 0.9 ? '#34d399' : s.accuracy >= 0.7 ? '#fbbf24' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--border)]">
                  <th className="py-2.5">Source</th>
                  <th className="py-2.5 text-right">Total</th>
                  <th className="py-2.5 text-right">Approuvés</th>
                  <th className="py-2.5 text-right">Rejetés</th>
                  <th className="py-2.5 text-right">Précision</th>
                  <th className="py-2.5 text-right">Conf. moy.</th>
                </tr>
              </thead>
              <tbody>
                {stats.accuracy_by_source.map(s => (
                  <tr key={s.source} className="border-b border-[var(--border)]">
                    <td className="py-2.5">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium ${MATCH_SOURCE_COLORS[s.source] || 'bg-gray-50 text-gray-500'}`}>
                        {MATCH_SOURCE_LABELS[s.source] || s.source}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-[13px]">{s.total}</td>
                    <td className="py-2.5 text-right text-[13px] text-emerald-500">{s.approved}</td>
                    <td className="py-2.5 text-right text-[13px] text-red-400">{s.rejected}</td>
                    <td className="py-2.5 text-right text-[13px] font-medium">{(s.accuracy * 100).toFixed(1)}%</td>
                    <td className="py-2.5 text-right text-[13px] text-[var(--muted-foreground)]">{(s.avg_confidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confidence vs Accuracy */}
      {stats.accuracy_by_confidence_band.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">
            Confiance vs Précision
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.accuracy_by_confidence_band.map(b => ({ ...b, accuracyPct: Math.round(b.accuracy * 100) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#86868b' }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#86868b' }} />
              <Tooltip
                formatter={(value, name) => [name === 'accuracyPct' ? `${value}%` : value, name === 'accuracyPct' ? 'Précision' : 'Total']}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="accuracyPct" radius={[6, 6, 0, 0]}>
                {stats.accuracy_by_confidence_band.map((b, i) => (
                  <Cell key={i} fill={b.accuracy >= 0.9 ? '#34d399' : b.accuracy >= 0.7 ? '#fbbf24' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-3">
            Les barres vertes indiquent une précision &ge; 90%, jaunes &ge; 70%, rouges &lt; 70%
          </p>
        </div>
      )}

      {/* Threshold Recommendations */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">
          Recommandations de seuils
        </h2>
        <div className="space-y-3">
          {stats.threshold_recommendations.map(rec => (
            <div key={rec.threshold} className="flex items-center gap-4 p-5 bg-[var(--muted)] rounded-xl">
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[var(--foreground)]">
                  {rec.threshold === 'auto_file' ? 'Auto-classement' : 'Seuil de revue'}
                </div>
                <div className="text-[12px] text-[var(--muted-foreground)] mt-1">
                  {rec.reasoning}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-[var(--muted-foreground)]">Actuel</div>
                <div className="font-mono font-light text-[20px] text-[var(--foreground)]">{(rec.current * 100).toFixed(0)}%</div>
              </div>
              {rec.suggested !== rec.current && (
                <>
                  <div className="text-[var(--muted-foreground)]">&rarr;</div>
                  <div className="text-right">
                    <div className="text-[11px] text-emerald-500">Suggéré</div>
                    <div className="font-mono font-light text-[20px] text-emerald-500">
                      {(rec.suggested * 100).toFixed(0)}%
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Accuracy Trend */}
      {stats.daily_accuracy.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">
            Tendance de précision quotidienne
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.daily_accuracy.map(d => ({ ...d, accuracyPct: Math.round(d.accuracy * 100) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#86868b' }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#86868b' }} />
              <Tooltip
                formatter={(value, name) => [name === 'accuracyPct' ? `${value}%` : value, name === 'accuracyPct' ? 'Précision' : name === 'total' ? 'Total' : name]}
                contentStyle={tooltipStyle}
              />
              <Line type="monotone" dataKey="accuracyPct" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* False Positives */}
      {stats.false_positives.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">
            Faux positifs récents ({stats.false_positives.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--border)]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Source</th>
                  <th className="py-2.5">Confiance</th>
                  <th className="py-2.5">Dossier</th>
                  <th className="py-2.5">Boîte</th>
                </tr>
              </thead>
              <tbody>
                {stats.false_positives.slice(0, 20).map((fp, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="py-2.5 text-[12px] text-[var(--muted-foreground)]">{fp.created_at?.slice(0, 10)}</td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium ${MATCH_SOURCE_COLORS[fp.match_source || ''] || 'bg-gray-50 text-gray-500'}`}>
                        {MATCH_SOURCE_LABELS[fp.match_source || ''] || fp.match_source || '?'}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-[12px]">{fp.confidence !== null ? `${(fp.confidence * 100).toFixed(0)}%` : '-'}</td>
                    <td className="py-2.5 text-[12px]">{fp.dossier_ref || '-'}</td>
                    <td className="py-2.5 text-[12px] text-[var(--muted-foreground)]">{fp.mailbox?.split('@')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {cov.reviewed === 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-[13px] text-[var(--muted-foreground)]">
            Aucune revue trouvée pour cette période. Approuvez ou rejetez des correspondances
            dans la <a href="/dashboard/review/queue" className="text-[var(--accent)] hover:underline">file de revue</a> pour
            voir les statistiques de précision.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-[24px] font-light tracking-tight ${color || 'text-[var(--foreground)]'}`}>
        {value}
      </div>
      <div className="text-[11px] text-[var(--muted-foreground)] mt-1">{label}</div>
    </div>
  );
}
