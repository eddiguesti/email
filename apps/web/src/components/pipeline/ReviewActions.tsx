'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, XCircle, FolderOpen } from 'lucide-react';

interface Props {
  matchId: string;
  reviewedBy: string;
  dossierId?: string;
  onReviewed: (id: string, approved: boolean) => void;
}

export default function ReviewActions({ matchId, dossierId, onReviewed }: Props) {
  const [reviewing, setReviewing] = useState(false);
  const [reviewed, setReviewed] = useState<'approved' | 'rejected' | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleReview = async (approved: boolean) => {
    setReviewing(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/pipeline/matches/${matchId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || `Error ${res.status}`);
      }
      setReviewed(approved ? 'approved' : 'rejected');
      onReviewed(matchId, approved);
    } catch (err) {
      setReviewError((err as Error).message || 'Validation error');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-3">
      {reviewed ? (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium ${reviewed === 'approved' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {reviewed === 'approved'
            ? <><CheckCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} /> Booking confirmed — AI has learned from your feedback</>
            : <><XCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} /> Booking rejected — AI will learn from this</>
          }
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleReview(true)}
            disabled={reviewing}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all duration-150"
          >
            {reviewing ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <CheckCircle className="w-4 h-4" strokeWidth={1.8} />}
            Correct booking
          </button>
          <button
            onClick={() => handleReview(false)}
            disabled={reviewing}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-all duration-150"
          >
            {reviewing ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <XCircle className="w-4 h-4" strokeWidth={1.8} />}
            Wrong booking
          </button>

          {dossierId && (
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200 cursor-default"
            >
              <FolderOpen className="w-4 h-4" strokeWidth={1.8} />
              View in Opera Cloud
            </button>
          )}
        </div>
      )}

      {reviewError && (
        <div className="flex items-center gap-2 text-[12px] text-red-500">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
          {reviewError}
        </div>
      )}
    </div>
  );
}
