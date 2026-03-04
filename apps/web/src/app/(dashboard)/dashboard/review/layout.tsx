'use client';

import { useEffect, useState } from 'react';
import { Mail, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';
import ReviewNav from '@/components/pipeline/ReviewNav';
import { getPipelineStats } from '@/lib/pipeline-api';
import type { PipelineStats } from '@/types/pipeline';

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<PipelineStats | null>(null);

  useEffect(() => {
    getPipelineStats({ days: 30 }).then(setStats).catch(() => {});
  }, []);

  const o = stats?.overview;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">Email Routing</h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
            AI automatically routes emails at 85%+. Emails between 60–85% are listed for your review.
          </p>
        </div>
        {o && (
          <div className="flex items-center gap-6 pb-1">
            <Stat icon={<Mail className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.8} />} label="Emails received" value={o.total_processed} />
            <Stat icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.8} />} label="Match rate" value={`${Math.round((o.match_rate || 0) * 100)}%`} />
            <Stat icon={<BarChart3 className="w-3.5 h-3.5 text-[var(--foreground)]" strokeWidth={1.8} />} label="Auto-routed" value={o.total_auto_file} />
            <Stat icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />} label="Review needed" value={o.total_review} highlight={o.total_review > 0} />
          </div>
        )}
      </div>
      <ReviewNav />
      {children}
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!to) { setVal(0); return; }
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * to));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{val}</>;
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  const numericValue = typeof value === 'number' ? value : null;
  const pctMatch = typeof value === 'string' ? value.match(/^(\d+)%$/) : null;
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className={`text-[18px] font-light tracking-tight leading-none ${highlight ? 'text-amber-500' : 'text-[var(--foreground)]'}`}>
          {numericValue !== null ? (
            <CountUp to={numericValue} />
          ) : pctMatch ? (
            <><CountUp to={parseInt(pctMatch[1], 10)} />%</>
          ) : (
            value
          )}
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{label}</div>
      </div>
    </div>
  );
}
