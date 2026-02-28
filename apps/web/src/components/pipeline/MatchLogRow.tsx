'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Paperclip, CheckCircle, XCircle, Scale, PenLine, Copy, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MatchLog, DraftReplyResult } from '@/types/pipeline';
import { getActionStatus, ACTION_STATUS_CONFIG } from '@/types/pipeline';
import { generateDraftReply } from '@/lib/pipeline-api';
import ConfidenceBadge from './ConfidenceBadge';
import MatchSourceTag from './MatchSourceTag';
import CategoryBadge from './CategoryBadge';

interface Props {
  log: MatchLog;
  /** If provided, clicking the row opens the detail drawer instead of expanding inline */
  onSelect?: (log: MatchLog) => void;
}

export default function MatchLogRow({ log, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<DraftReplyResult | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actionStatus = getActionStatus(log);
  const actionCfg = ACTION_STATUS_CONFIG[actionStatus];
  const isDone = actionStatus === 'done';

  async function handleGenerateDraft() {
    setDraftLoading(true);
    setDraftError(null);
    try {
      const result = await generateDraftReply(log.id);
      setDraft(result);
    } catch (err) {
      setDraftError((err as Error).message || 'Erreur de génération');
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const receivedDate = log.received_at ? new Date(log.received_at) : null;
  const relativeDate = receivedDate
    ? formatDistanceToNow(receivedDate, { addSuffix: true, locale: fr })
    : '-';
  const absoluteDate = receivedDate
    ? format(receivedDate, 'dd MMM yyyy à HH:mm', { locale: fr })
    : '';

  // Urgency tooltip explains the escalation rule
  const urgencyTooltip =
    actionStatus === 'urgent'
      ? `Urgent — email reçu il y a plus de 48h ou marqué important`
      : actionStatus === 'to_review'
      ? `En attente de validation (confiance 60–85%)`
      : actionStatus === 'unclassified'
      ? `Aucun dossier trouvé pour cet email`
      : '';

  return (
    <div className={`relative transition-opacity duration-200 ${isDone ? 'opacity-50' : 'opacity-100'}`}>
      {/* Left urgency accent bar */}
      {!isDone && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm ${actionCfg.accentBg}`} />
      )}

      <div
        className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)] cursor-pointer transition-all duration-200"
        onClick={() => onSelect ? onSelect(log) : setExpanded(!expanded)}
      >
        {/* Status dot with tooltip */}
        <div className="w-5 flex-shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${actionCfg.dotClass} ${actionCfg.pulse ? 'animate-pulse' : ''}`}
            title={urgencyTooltip}
          />
        </div>

        {/* Sender + subject */}
        <div className="w-44 flex-shrink-0 min-w-0">
          <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
            {log.sender_name || log.sender_email}
          </p>
          {log.email_subject ? (
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">{log.email_subject}</p>
          ) : (
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">{log.sender_email}</p>
          )}
        </div>

        {/* Dossier */}
        <div className="flex-1 min-w-0 hidden md:block">
          {log.dossier_name ? (
            <div>
              <p className="text-[13px] text-[var(--foreground)] truncate">{log.dossier_name}</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">[{log.dossier_ref}]</p>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--muted-foreground)] italic">Aucun dossier associé</p>
          )}
        </div>

        {/* Confidence */}
        <div className="w-14 flex-shrink-0 text-center">
          <ConfidenceBadge confidence={log.confidence} matched={log.matched} />
        </div>

        {/* Source */}
        <div className="w-40 flex-shrink-0 hidden lg:block">
          <MatchSourceTag source={log.match_source} />
        </div>

        {/* Lawyer */}
        <div className="w-32 flex-shrink-0 hidden xl:block">
          <p className="text-[11px] text-[var(--muted-foreground)] truncate">{log.lawyer || 'N/D'}</p>
        </div>

        {/* Category + Action badge */}
        <div className="w-36 flex-shrink-0 hidden lg:block space-y-1">
          <CategoryBadge color={log.category_color} />
          {!isDone && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${actionCfg.badgeClass}`}
              title={urgencyTooltip}
            >
              {actionCfg.label}
            </span>
          )}
        </div>

        {/* Icons */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center gap-1.5">
          {log.is_ebarreau && (
            <span title="Acte e-Barreau (dépôt électronique judiciaire)">
              <Scale className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.8} />
            </span>
          )}
          {log.has_attachments && (
            <span title="Pièces jointes">
              <Paperclip className="w-3.5 h-3.5 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </span>
          )}
          {log.review_approved === true && (
            <span title={`Validé${log.reviewed_by ? ' par ' + log.reviewed_by : ''}`}>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.8} />
            </span>
          )}
          {log.review_approved === false && (
            <span title={`Rejeté${log.reviewed_by ? ' par ' + log.reviewed_by : ''}`}>
              <XCircle className="w-3.5 h-3.5 text-red-400" strokeWidth={1.8} />
            </span>
          )}
        </div>

        {/* Date with absolute date in tooltip */}
        <div className="w-24 flex-shrink-0 text-right">
          <p
            className="text-[11px] text-[var(--muted-foreground)]"
            title={absoluteDate}
          >
            {relativeDate}
          </p>
        </div>

        {/* Expand / open */}
        <div className="w-5 flex-shrink-0">
          {onSelect ? (
            <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
          ) : (
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-4 pl-14 space-y-3">
              {log.match_reasons && log.match_reasons.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-[var(--muted-foreground)] mb-1.5">Pourquoi ce dossier :</p>
                  <ul className="space-y-1">
                    {log.match_reasons.map((r, i) => (
                      <li key={i} className="text-[12px] text-[var(--foreground)]">· {r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-6 text-[11px] text-[var(--muted-foreground)]">
                <span>Boîte : {log.mailbox}</span>
                {log.action_taken && <span>Action : {log.action_taken}</span>}
                {log.reviewed_by && <span>Validé par : {log.reviewed_by}</span>}
              </div>

              {/* Draft Reply Section */}
              <div className="pt-1">
                {!draft && !draftLoading && !draftError && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateDraft(); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white transition-all duration-200"
                  >
                    <PenLine className="w-3.5 h-3.5" strokeWidth={1.8} />
                    Rédiger une réponse IA
                  </button>
                )}

                {draftLoading && (
                  <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération en cours…
                  </div>
                )}

                {draftError && (
                  <div className="space-y-2">
                    <p className="text-[12px] text-red-500">Erreur : {draftError}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenerateDraft(); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all duration-200"
                    >
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                      Réessayer
                    </button>
                  </div>
                )}

                {draft && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] bg-blue-50 px-2 py-0.5 rounded-md">
                        Brouillon IA
                      </span>
                      {draft.styleMatch && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          Style de rédaction : {draft.styleMatch}
                        </span>
                      )}
                    </div>
                    <div className="bg-[var(--muted)] border-l-2 border-l-[var(--accent)] rounded-xl p-4">
                      <p className="text-[13px] text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                        {draft.draft}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--foreground)] text-white hover:opacity-90 transition-all duration-200"
                      >
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
                        {copied ? 'Copié !' : 'Copier'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDraft(null); handleGenerateDraft(); }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-all duration-200"
                      >
                        <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                        Générer une alternative
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
