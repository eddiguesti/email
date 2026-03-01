'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Inbox, RefreshCw, AlertCircle } from 'lucide-react';
import type { MatchLog } from '@/types/pipeline';
import { getMatchLogs } from '@/lib/pipeline-api';
import ConfidenceBadge from '@/components/pipeline/ConfidenceBadge';
import MatchSourceTag from '@/components/pipeline/MatchSourceTag';
import ReviewActions from '@/components/pipeline/ReviewActions';
import { useAuth } from '@/context/AuthContext';

export default function ReviewQueuePage() {
  const { user } = useAuth();
  const reviewerEmail = user?.email || 'unknown';
  const [items, setItems] = useState<MatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getMatchLogs({
        matched: true,
        confidence_min: 0.60,
        confidence_max: 0.849,
        reviewed: 'false',
        per_page: 100,
      });
      setItems(res.matches);
      setTotal(res.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReviewed = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setTotal(prev => prev - 1);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-white rounded-2xl shadow-[var(--shadow-card)] animate-shimmer" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertCircle className="w-7 h-7 text-red-400" strokeWidth={1.5} />
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Impossible de charger la file de validation. Vérifiez votre connexion.
        </p>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={1.8} />
          Réessayer
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
          <CheckCircle className="w-7 h-7 text-emerald-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-2">
          Aucun email à valider
        </h2>
        <p className="text-[13px] text-[var(--muted-foreground)] mb-1 max-w-sm">
          Tous les emails entre 60 et 85% de confiance ont été traités.
        </p>
        <p className="text-[12px] text-[var(--muted-foreground)] mb-5 max-w-sm">
          Les emails à 85%+ sont classés automatiquement — consultez <strong>Toutes les correspondances</strong> pour les voir.
        </p>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={1.8} />
          Actualiser
        </button>
      </div>
    );
  }

  return (
    <div data-tour="review-queue" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50">
            <Inbox className="w-4 h-4 text-amber-500" strokeWidth={1.8} />
          </div>
          <div>
            <span className="text-[13px] font-medium text-[var(--foreground)]">
              {total} email{total !== 1 ? 's' : ''} à valider
            </span>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Confiance entre 60–85% — l&apos;IA n&apos;est pas sûre, votre avis est nécessaire
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-all duration-200"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
          Actualiser
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -300, transition: { duration: 0.3 } }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="p-5 bg-white rounded-2xl shadow-[var(--shadow-card)] space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--foreground)]">
                  {item.sender_name || item.sender_email}
                </p>
                <p className="text-[12px] text-[var(--muted-foreground)]">{item.sender_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <ConfidenceBadge confidence={item.confidence} matched={item.matched} />
                <MatchSourceTag source={item.match_source} />
              </div>
            </div>

            <div className="p-4 bg-[var(--muted)] rounded-xl">
              <p className="text-[13px] font-medium text-[var(--foreground)]">
                Dossier suggéré : [{item.dossier_ref}] {item.dossier_name}
              </p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                Avocat : {item.lawyer || 'N/D'} · Boîte : {item.mailbox}
              </p>
              {item.match_reasons && item.match_reasons.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Pourquoi ce dossier :</p>
                  {item.match_reasons.map((r, idx) => (
                    <p key={idx} className="text-[11px] text-[var(--muted-foreground)]">· {r}</p>
                  ))}
                </div>
              )}
            </div>

            <ReviewActions
              matchId={item.id}
              emailId={item.email_id ?? undefined}
              mailbox={item.mailbox ?? undefined}
              dossierId={item.dossier_id != null ? String(item.dossier_id) : undefined}
              reviewedBy={reviewerEmail}
              onReviewed={(id) => handleReviewed(id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
