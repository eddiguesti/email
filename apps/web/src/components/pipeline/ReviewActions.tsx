'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { reviewMatch } from '@/lib/pipeline-api';

interface DraftResult {
  subject: string;
  body: string;
  confidence?: number;
}

interface Props {
  matchId: string;
  reviewedBy: string;
  onReviewed: (id: string, approved: boolean) => void;
}

export default function ReviewActions({ matchId, reviewedBy, onReviewed }: Props) {
  const [loading, setLoading] = useState<'approve' | 'reject' | 'draft' | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReview = async (approved: boolean) => {
    setLoading(approved ? 'approve' : 'reject');
    try {
      await reviewMatch(matchId, approved);
      onReviewed(matchId, approved);
    } catch {
      // Silently fail — the UI won't update, user can retry
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateDraft = async () => {
    setLoading('draft');
    setDraft(null);
    try {
      const res = await fetch('/api/pipeline/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchId }),
      });
      if (res.ok) {
        const data = await res.json() as DraftResult;
        setDraft(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleReview(true)}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl bg-[var(--foreground)] text-white hover:opacity-90 disabled:opacity-40 transition-all duration-200"
        >
          {loading === 'approve' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" strokeWidth={1.8} />
          )}
          Approuver
        </button>
        <button
          onClick={() => handleReview(false)}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all duration-200"
        >
          {loading === 'reject' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" strokeWidth={1.8} />
          )}
          Rejeter
        </button>
        <button
          onClick={handleGenerateDraft}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-40 transition-all duration-200"
        >
          {loading === 'draft' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" strokeWidth={1.8} />
          )}
          Générer brouillon IA
        </button>
      </div>

      {draft && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Brouillon généré par IA
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
              )}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Objet</p>
            <p className="text-[13px] text-[var(--foreground)]">{draft.subject}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Corps</p>
            <p className="text-[13px] text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
              {draft.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
