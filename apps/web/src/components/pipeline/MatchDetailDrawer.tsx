'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Paperclip,
  Scale,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  PenLine,
  Copy,
  User,
  Inbox,
  AlertCircle,
  Send,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MatchLog, DraftReplyResult } from '@/types/pipeline';
import { MATCH_SOURCE_LABELS, MATCH_SOURCE_COLORS } from '@/types/pipeline';
import { generateDraftReply } from '@/lib/pipeline-api';
import ConfidenceBadge from './ConfidenceBadge';
import CategoryBadge from './CategoryBadge';

// ─── Animation variants ───────────────────────────────────────────────────────

/** Panel slides in from the right on a spring; exits fast (Apple sheet behaviour) */
const PANEL: import('framer-motion').Variants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: { type: 'spring', stiffness: 320, damping: 30, mass: 0.85 },
  },
  exit: {
    x: '100%',
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

/** Stagger container — drives the cascade of children */
const STAGGER: import('framer-motion').Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.055, delayChildren: 0.13 },
  },
};

/** Each section fades + floats up */
const SECTION: import('framer-motion').Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name?: string; address?: string } };
  toRecipients: Array<{ emailAddress: { name?: string; address?: string } }>;
  ccRecipients: Array<{ emailAddress: { name?: string; address?: string } }>;
  receivedDateTime: string;
  body: { contentType: 'html' | 'text'; content: string };
  bodyPreview: string;
  hasAttachments: boolean;
  conversationId: string;
  isRead: boolean;
  importance: string;
}

interface ThreadItem {
  id: string;
  subject: string;
  from: { emailAddress: { name?: string; address?: string } };
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
  importance: string;
}

interface Props {
  log: MatchLog | null;
  open: boolean;
  onClose: () => void;
  onReview?: (id: string, approved: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return (email || '?').slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchDetailDrawer({ log, open, onClose, onReview }: Props) {
  const [message,  setMessage]  = useState<GraphMessage | null>(null);
  const [thread,   setThread]   = useState<ThreadItem[]>([]);
  const [msgLoad,  setMsgLoad]  = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [draft,        setDraft]        = useState<DraftReplyResult | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError,   setDraftError]   = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [editedDraft,  setEditedDraft]  = useState('');
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState<string | null>(null);
  const [sent,         setSent]         = useState(false);

  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError,   setReviewError]   = useState<string | null>(null);

  const fetchEmail = useCallback(async (l: MatchLog) => {
    setMessage(null);
    setThread([]);
    setMsgError(null);
    setNotFound(false);
    setDraft(null);
    setDraftError(null);
    setEditedDraft('');
    setSending(false);
    setSendError(null);
    setSent(false);
    if (!l.email_id) return;

    setMsgLoad(true);
    try {
      const msgUrl = new URL('/api/messages', window.location.origin);
      msgUrl.searchParams.set('id', l.email_id);
      if (l.mailbox) msgUrl.searchParams.set('mailbox', l.mailbox);
      const res = await fetch(msgUrl.toString());

      if (!res.ok) {
        setMsgError('Impossible de charger cet email');
        return;
      }

      const data = await res.json();

      if (data.notFound) {
        setNotFound(true);
      } else if (data.message) {
        setMessage(data.message);
        const convId = data.message.conversationId || l.conversation_id;
        if (convId) {
          const threadUrl = new URL('/api/messages', window.location.origin);
          threadUrl.searchParams.set('conversationId', convId);
          if (l.mailbox) threadUrl.searchParams.set('mailbox', l.mailbox);
          fetch(threadUrl.toString())
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(d => setThread((d.thread || []).filter((t: ThreadItem) => t.id !== l.email_id)))
            .catch((err) => console.warn('[MatchDetailDrawer] thread fetch failed:', err));
        }
      }
    } catch {
      setMsgError('Impossible de charger cet email');
    } finally {
      setMsgLoad(false);
    }
  }, []);

  useEffect(() => {
    if (open && log) fetchEmail(log);
  }, [open, log, fetchEmail]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleGenerateDraft() {
    if (!log) return;
    setDraftLoading(true);
    setDraftError(null);
    setSent(false);
    setSendError(null);
    try {
      const result = await generateDraftReply(log.id);
      setDraft(result);
      setEditedDraft(result.draft);
    } catch (err) {
      setDraftError((err as Error).message || 'Erreur de génération');
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSend() {
    if (!log?.email_id || !log?.mailbox || !editedDraft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/pipeline/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId:   log.id,
          emailId:   log.email_id,
          mailbox:   log.mailbox,
          replyText: editedDraft.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setSent(true);
    } catch (err) {
      setSendError((err as Error).message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!editedDraft) return;
    await navigator.clipboard.writeText(editedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleReview(approved: boolean) {
    if (!log || !onReview) return;
    setReviewLoading(true);
    setReviewError(null);
    try {
      await Promise.resolve(onReview(log.id, approved));
      onClose();
    } catch (err) {
      setReviewError((err as Error).message || 'Erreur lors de la validation');
    } finally {
      setReviewLoading(false);
    }
  }

  const subject     = message?.subject ?? (msgLoad ? '…' : '(Sans objet)');
  const bodyText    = message?.body
    ? (message.body.contentType === 'html' ? stripHtml(message.body.content) : message.body.content)
    : null;
  const senderName  = message?.from?.emailAddress?.name  || log?.sender_name  || null;
  const senderEmail = message?.from?.emailAddress?.address || log?.sender_email || '';
  const toList      = message?.toRecipients?.map(r => r.emailAddress?.name || r.emailAddress?.address).filter(Boolean).join(', ') ?? '';

  const canReview  = log?.review_approved === null && log?.matched && !!onReview;
  const sourceLabel = log?.match_source ? (MATCH_SOURCE_LABELS[log.match_source] || log.match_source) : null;
  const sourceColor = log?.match_source ? (MATCH_SOURCE_COLORS[log.match_source] || 'bg-gray-100 text-gray-600') : '';

  // Portal: render into document.body so CSS transforms in parent layouts
  // don't create a new containing block for our position:fixed elements.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Backdrop — separate AnimatePresence so FM12 tracks it directly ── */}
      <AnimatePresence>
        {open && log && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* ── Panel — separate AnimatePresence ─────────────────────────────── */}
      <AnimatePresence>
        {open && log && (
          <motion.aside
            key="drawer"
            variants={PANEL}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 right-0 bottom-0 z-50 w-[520px] bg-white flex flex-col"
            style={{ boxShadow: '-8px 0 60px rgba(0,0,0,0.14), -1px 0 0 rgba(0,0,0,0.05)' }}
          >
            {/* Content — stagger wrapper preserving flex layout */}
            <motion.div
              variants={STAGGER}
              initial="hidden"
              animate="visible"
              className="flex flex-col flex-1 min-h-0"
            >

              {/* Header */}
              <motion.div
                variants={SECTION}
                className="flex items-start gap-3 px-5 py-4 border-b border-[var(--border)] flex-shrink-0"
              >
                <div className="flex-1 min-w-0 pt-0.5">
                  {msgLoad ? (
                    <div className="h-4 w-2/3 bg-[var(--muted)] rounded-md animate-pulse" />
                  ) : (
                    <h2 className="text-[14px] font-semibold text-[var(--foreground)] leading-snug line-clamp-2">
                      {subject}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-md">
                      <Inbox className="w-3 h-3" strokeWidth={1.8} />
                      {log.mailbox}
                    </span>
                    {log.has_attachments && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-md">
                        <Paperclip className="w-3 h-3" strokeWidth={1.8} />
                        Pièces jointes
                      </span>
                    )}
                    {log.is_ebarreau && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        <Scale className="w-3 h-3" strokeWidth={1.8} />
                        e-Barreau
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors duration-150 flex-shrink-0"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </motion.div>

              {/* ── Scrollable body ─────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto overscroll-contain">

                {/* Sender */}
                <motion.div
                  variants={SECTION}
                  className="px-5 py-4 border-b border-[var(--border)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--foreground)] font-medium text-[12px] flex-shrink-0 select-none">
                      {initials(senderName, senderEmail)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">
                          {senderName || senderEmail}
                        </p>
                        {log.received_at && (
                          <p className="text-[11px] text-[var(--muted-foreground)] flex-shrink-0">
                            {format(new Date(log.received_at), 'd MMM yyyy, HH:mm', { locale: fr })}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">{senderEmail}</p>
                      {toList && (
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          <span className="font-medium">À :</span> {toList}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Match info */}
                <motion.div
                  variants={SECTION}
                  className="px-5 py-4 border-b border-[var(--border)] space-y-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Classement
                  </p>

                  {log.matched && log.dossier_name ? (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[var(--foreground)]">{log.dossier_name}</p>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            Réf. {log.dossier_ref}
                            {log.lawyer ? ` — ${log.lawyer}` : ''}
                          </p>
                        </div>
                        <ConfidenceBadge confidence={log.confidence} matched={log.matched} />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {sourceLabel && (
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium ${sourceColor}`}>
                            {sourceLabel}
                          </span>
                        )}
                        {log.category_color && <CategoryBadge color={log.category_color} />}
                        {log.review_approved === true && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                            <CheckCircle className="w-3 h-3" strokeWidth={2} />
                            Approuvé
                          </span>
                        )}
                        {log.review_approved === false && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                            <XCircle className="w-3 h-3" strokeWidth={2} />
                            Rejeté
                          </span>
                        )}
                      </div>

                      {log.match_reasons && log.match_reasons.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Raisons :</p>
                          {log.match_reasons.map((r, i) => (
                            <p key={i} className="text-[12px] text-[var(--foreground)] pl-2">
                              <span className="text-emerald-500 mr-1.5">+</span>{r}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-[var(--muted-foreground)]">Non classé</p>
                  )}
                </motion.div>

                {/* Email body */}
                <motion.div
                  variants={SECTION}
                  className="px-5 py-4 border-b border-[var(--border)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                    Message
                  </p>

                  {msgLoad ? (
                    <div className="space-y-2">
                      {[90, 75, 85, 60, 80].map((w, i) => (
                        <div
                          key={i}
                          className="h-3 bg-[var(--muted)] rounded-md animate-pulse"
                          style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }}
                        />
                      ))}
                    </div>
                  ) : notFound ? (
                    <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] py-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                      Cet email n&apos;est plus accessible (supprimé ou archivé).
                    </div>
                  ) : msgError ? (
                    <div className="flex items-center gap-2 text-[12px] text-red-500 py-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                      {msgError}
                    </div>
                  ) : bodyText ? (
                    <p className="text-[13px] text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                      {bodyText.slice(0, 3000)}{bodyText.length > 3000 ? '…' : ''}
                    </p>
                  ) : (
                    <p className="text-[13px] text-[var(--muted-foreground)] italic">Contenu non disponible.</p>
                  )}
                </motion.div>

                {/* Thread */}
                {thread.length > 0 && (
                  <motion.div
                    variants={SECTION}
                    className="px-5 py-4 border-b border-[var(--border)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                      Fil de discussion ({thread.length} autre{thread.length > 1 ? 's' : ''})
                    </p>
                    <div className="space-y-2">
                      {thread.map((t) => (
                        <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--muted)]">
                          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[10px] font-medium text-[var(--foreground)] flex-shrink-0 shadow-[var(--shadow-sm)] select-none">
                            {initials(t.from?.emailAddress?.name, t.from?.emailAddress?.address)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-[12px] font-medium text-[var(--foreground)] truncate">
                                {t.from?.emailAddress?.name || t.from?.emailAddress?.address || 'Inconnu'}
                              </p>
                              <p className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">
                                {formatDistanceToNow(new Date(t.receivedDateTime), { addSuffix: true, locale: fr })}
                              </p>
                            </div>
                            <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5 leading-snug">
                              {t.bodyPreview}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Draft reply */}
                <motion.div variants={SECTION} className="px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                    Réponse IA
                  </p>

                  {!draft && !draftLoading && !draftError && (
                    <button
                      onClick={handleGenerateDraft}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white transition-all duration-200"
                    >
                      <PenLine className="w-3.5 h-3.5" strokeWidth={1.8} />
                      Rédiger une réponse
                    </button>
                  )}

                  {draftLoading && (
                    <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Génération en cours…
                    </div>
                  )}

                  {draftError && (
                    <div className="space-y-2">
                      <p className="text-[12px] text-red-500">{draftError}</p>
                      <button
                        onClick={handleGenerateDraft}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all duration-200"
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
                        <span className="text-[10px] text-[var(--muted-foreground)]">{draft.styleMatch}</span>
                      </div>

                      {sent ? (
                        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[13px] font-medium text-emerald-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                          Réponse envoyée avec votre signature
                        </div>
                      ) : (
                        <>
                          <textarea
                            value={editedDraft}
                            onChange={e => { setEditedDraft(e.target.value); setSendError(null); }}
                            disabled={sending}
                            rows={8}
                            className="w-full text-[13px] text-[var(--foreground)] leading-relaxed bg-[var(--muted)] border border-transparent focus:border-[var(--accent)] focus:outline-none rounded-xl p-4 resize-none disabled:opacity-60 transition-colors duration-150"
                          />
                          {sendError && (
                            <div className="flex items-center gap-1.5 text-[12px] text-red-500">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                              {sendError}
                            </div>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={handleSend}
                              disabled={sending || !editedDraft.trim()}
                              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {sending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
                              ) : (
                                <Send className="w-3.5 h-3.5" strokeWidth={1.8} />
                              )}
                              {sending ? 'Envoi…' : 'Envoyer avec signature'}
                            </button>
                            <button
                              onClick={handleCopy}
                              disabled={sending}
                              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-colors duration-150 disabled:opacity-50"
                            >
                              <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
                              {copied ? 'Copié !' : 'Copier'}
                            </button>
                            <button
                              onClick={() => { setDraft(null); setEditedDraft(''); setSent(false); setSendError(null); handleGenerateDraft(); }}
                              disabled={sending}
                              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-colors duration-150 disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                              Régénérer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>

              </div>{/* end scrollable body */}

              {/* ── Footer actions ───────────────────────────────────────────── */}
              {(canReview || log.reviewed_by) && (
                <motion.div
                  variants={SECTION}
                  className="flex flex-col gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--muted)] flex-shrink-0"
                >
                  {canReview ? (
                    <>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleReview(true)}
                          disabled={reviewLoading}
                          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl bg-[var(--foreground)] text-white hover:opacity-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
                          ) : (
                            <CheckCircle className="w-4 h-4" strokeWidth={1.8} />
                          )}
                          Approuver
                        </button>
                        <button
                          onClick={() => handleReview(false)}
                          disabled={reviewLoading}
                          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
                          ) : (
                            <XCircle className="w-4 h-4" strokeWidth={1.8} />
                          )}
                          Rejeter
                        </button>
                      </div>
                      {reviewError && (
                        <div className="flex items-center gap-1.5 text-[12px] text-red-500">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                          {reviewError}
                        </div>
                      )}
                    </>
                  ) : log.reviewed_by ? (
                    <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                      <User className="w-3.5 h-3.5" strokeWidth={1.8} />
                      Revu par {log.reviewed_by}
                      {log.reviewed_at
                        ? ` · ${formatDistanceToNow(new Date(log.reviewed_at), { addSuffix: true, locale: fr })}`
                        : ''}
                    </div>
                  ) : null}
                </motion.div>
              )}

            </motion.div>{/* end stagger wrapper */}
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
