'use client';

import { formatDistanceToNow } from 'date-fns';

import { Activity, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import type { PipelineRun } from '@/types/pipeline';

interface Props {
  run: PipelineRun;
}

export default function PipelineRunCard({ run }: Props) {
  const matchRate = run.emails_processed > 0
    ? Math.round((run.emails_matched / run.emails_processed) * 100)
    : 0;

  const statusIcon = run.status === 'completed'
    ? <CheckCircle className="w-4 h-4 text-emerald-400" strokeWidth={1.8} />
    : run.status === 'failed'
    ? <XCircle className="w-4 h-4 text-red-400" strokeWidth={1.8} />
    : <Activity className="w-4 h-4 text-[var(--accent)] animate-pulse" strokeWidth={1.8} />;

  return (
    <div className="p-5 bg-white rounded-2xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-400">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {statusIcon}
          <span className="text-[14px] font-medium text-[var(--foreground)]">{run.mailbox}</span>
        </div>
        <span className="text-[11px] text-[var(--muted-foreground)]">
          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-[20px] font-light tracking-tight text-[var(--foreground)]">{run.emails_processed}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Processed</p>
        </div>
        <div>
          <p className="text-[20px] font-light tracking-tight text-emerald-500">{matchRate}%</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Rate</p>
        </div>
        <div>
          <p className="text-[20px] font-light tracking-tight text-[var(--accent)]">{run.emails_auto_filed}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Auto</p>
        </div>
        <div>
          <p className="text-[20px] font-light tracking-tight text-amber-500">{run.emails_review}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Review</p>
        </div>
      </div>

      {run.error_count > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
          {run.error_count} error{run.error_count > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
