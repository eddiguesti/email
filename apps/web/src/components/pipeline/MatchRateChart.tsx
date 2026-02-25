'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  date: string;
  processed: number;
  matched: number;
  auto_filed: number;
}

interface Props {
  data: DataPoint[];
}

export default function MatchRateChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    date: d.date.slice(5),
    match_rate: d.processed > 0 ? Math.round((d.matched / d.processed) * 100) : 0,
  }));

  return (
    <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Taux de classement</h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Emails traités et classés par jour</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1d1d1f]" />
            <span className="text-[11px] text-[var(--muted-foreground)]">Traités</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-[var(--muted-foreground)]">Classés</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1d1d1f" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#1d1d1f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMatched" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#86868b', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#86868b', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
                padding: '12px 16px',
              }}
              labelStyle={{ color: '#1d1d1f', fontWeight: 500, fontSize: 13 }}
              itemStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="processed"
              stroke="#1d1d1f"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorProcessed)"
              name="Traités"
            />
            <Area
              type="monotone"
              dataKey="matched"
              stroke="#34d399"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMatched)"
              name="Classés"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
