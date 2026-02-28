'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Copy, Check, Send, AlertCircle, RefreshCw, CheckCircle, ExternalLink } from 'lucide-react';

interface DraftResult {
  draft: string;
  subject?: string;
  styleMatch?: string;
}

interface Props {
  matchId: string;
  emailId?: string;
  mailbox?: string;
  reviewedBy: string;
  dossierId?: string;
  onReviewed: (id: string, approved: boolean) => void;
}

export default function ReviewActions({ matchId, emailId, mailbox, dossierId, onReviewed }: Props) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [editedDraft, setEditedDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleGenerateDraft = async () => {
    setLoading(true);
    setDraft(null);
    setDraftError(null);
    setSent(false);
    setSendError(null);
    try {
      const res = await fetch('/api/pipeline/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json() as DraftResult & { error?: string };
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setDraft(data);
      setEditedDraft(data.draft || '');
    } catch (err) {
      setDraftError((err as Error).message || 'Impossible de générer le brouillon');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!editedDraft) return;
    await navigator.clipboard.writeText(editedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!emailId || !mailbox || !editedDraft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/pipeline/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, emailId, mailbox, replyText: editedDraft.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setSent(true);
      onReviewed(matchId, true);
    } catch (err) {
      setSendError((err as Error).message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {/* Open in Kleos — the only real filing action */}
        {dossierId && (
          <a
            href={`https://eu.kleosapp.com/app/cases/${dossierId}/overview`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={1.8} />
            Ouvrir dans Kleos
          </a>
        )}

        {/* Generate draft */}
        <button
          onClick={handleGenerateDraft}
          disabled={loading || sent}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-40 transition-all duration-200"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" strokeWidth={1.8} />
          )}
          {draft ? 'Générer une alternative' : 'Rédiger une réponse IA'}
        </button>
      </div>

      {draftError && (
        <div className="flex items-center gap-2 text-[12px] text-red-500">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
          {draftError}
        </div>
      )}

      {draft && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Brouillon IA
              {draft.styleMatch && (
                <span className="normal-case font-normal"> — Style de rédaction : {draft.styleMatch}</span>
              )}
            </p>
          </div>

          {sent ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[12px] font-medium text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
              Réponse envoyée avec votre signature
            </div>
          ) : (
            <>
              <textarea
                value={editedDraft}
                onChange={e => { setEditedDraft(e.target.value); setSendError(null); }}
                disabled={sending}
                rows={6}
                className="w-full text-[13px] text-[var(--foreground)] leading-relaxed bg-white border border-transparent focus:border-[var(--accent)] focus:outline-none rounded-xl p-3 resize-none disabled:opacity-60 transition-colors duration-150"
              />
              {sendError && (
                <div className="flex items-center gap-1.5 text-[12px] text-red-500">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                  {sendError}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {emailId && mailbox && (
                  <button
                    onClick={handleSend}
                    disabled={sending || !editedDraft.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} /> : <Send className="w-3.5 h-3.5" strokeWidth={1.8} />}
                    {sending ? 'Envoi…' : 'Envoyer avec signature'}
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-lg bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50 transition-all duration-200"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
                <button
                  onClick={() => { setDraft(null); setEditedDraft(''); setSent(false); setSendError(null); handleGenerateDraft(); }}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-lg bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50 transition-all duration-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Régénérer
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
