'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Inbox,
  AlertCircle,
  Send,
  Sparkles,
  ExternalLink,
  MessageSquare,
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

/** Strip raw AI prefixes like "Grok: " or "AI: " from match reasons */
function cleanReason(r: string): string {
  return r.replace(/^(grok|ai|llm)[^:]*:\s*/i, '').trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchDetailDrawer({ log, open, onClose }: Props) {
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

  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toExpanded,  setToExpanded]  = useState(false);

  const draftSectionRef = useRef<HTMLDivElement>(null);
  const chatEndRef      = useRef<HTMLDivElement>(null);

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
    setChatHistory([]);
    setChatInput('');
    setToExpanded(false);
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
    // Scroll to draft section immediately so the user sees the spinner
    draftSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  async function handleChatQuestion(q: string) {
    if (!log || !q.trim()) return;
    const question = q.trim();
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/pipeline/dossier-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: log.id, question }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      const answer = data.answer ?? data.error ?? 'Erreur inconnue.';
      setChatHistory(prev => [...prev, { q: question, a: answer }]);
      // Scroll to bottom of chat after answer
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch {
      setChatHistory(prev => [...prev, { q: question, a: 'Impossible de contacter le serveur.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleCopy() {
    if (!editedDraft) return;
    await navigator.clipboard.writeText(editedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const subject     = message?.subject ?? (msgLoad ? '…' : '(Sans objet)');
  const bodyText    = message?.body
    ? (message.body.contentType === 'html' ? stripHtml(message.body.content) : message.body.content)
    : null;
  const senderName  = message?.from?.emailAddress?.name  || log?.sender_name  || null;
  const senderEmail = message?.from?.emailAddress?.address || log?.sender_email || '';
  const toRecipients = (message?.toRecipients ?? [])
    .map(r => r.emailAddress?.name || r.emailAddress?.address)
    .filter(Boolean) as string[];
  const TO_LIMIT = 2;
  const toHiddenCount = toRecipients.length - TO_LIMIT;

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
                      {toRecipients.length > 0 && (
                        <div className="mt-0.5">
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            <span className="font-medium">À :</span>{' '}
                            {(toExpanded ? toRecipients : toRecipients.slice(0, TO_LIMIT)).join(', ')}
                            {!toExpanded && toHiddenCount > 0 && (
                              <>
                                {', '}
                                <button
                                  onClick={() => setToExpanded(true)}
                                  className="text-[var(--accent)] hover:underline font-medium"
                                >
                                  +{toHiddenCount} autres
                                </button>
                              </>
                            )}
                            {toExpanded && toHiddenCount > 0 && (
                              <>
                                {' '}
                                <button
                                  onClick={() => setToExpanded(false)}
                                  className="text-[var(--muted-foreground)] hover:underline"
                                >
                                  (réduire)
                                </button>
                              </>
                            )}
                          </p>
                        </div>
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
                      {/* Dossier card */}
                      <div className="bg-[var(--muted)] rounded-xl p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold text-[var(--foreground)] leading-snug flex-1 min-w-0">
                            {log.dossier_name}
                          </p>
                          <ConfidenceBadge confidence={log.confidence} matched={log.matched} />
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          Réf. {log.dossier_ref}{log.lawyer ? ` · ${log.lawyer}` : ''}
                        </p>
                        {log.dossier_id && (
                          <a
                            href={`https://eu.kleosapp.com/app/cases/${log.dossier_id}/overview`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                          >
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                            Ouvrir dans Kleos
                          </a>
                        )}
                      </div>

                      {/* Méthode + statut */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
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

                      {/* Raisons */}
                      {log.match_reasons && log.match_reasons.length > 0 && (
                        <div className="space-y-1.5 pt-0.5">
                          <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                            Pourquoi ce dossier
                          </p>
                          <div className="space-y-1">
                            {log.match_reasons.map((r, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                                <p className="text-[12px] text-[var(--foreground)] leading-snug">{cleanReason(r)}</p>
                              </div>
                            ))}
                          </div>
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

                {/* Dossier AI assistant — only when matched to a dossier */}
                {log.matched && log.dossier_id && (
                  <motion.div
                    variants={SECTION}
                    className="px-5 py-4 border-b border-[var(--border)]"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.8} />
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                        Assistant dossier
                      </p>
                      <span className="ml-auto text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-md">
                        {log.dossier_ref}
                      </span>
                    </div>

                    {/* Q&A history */}
                    {chatHistory.length > 0 && (
                      <div className="space-y-3 mb-3 max-h-72 overflow-y-auto overscroll-contain">
                        {chatHistory.map((msg, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-end">
                              <div className="max-w-[85%] bg-[var(--accent)] text-white text-[12px] leading-relaxed rounded-2xl rounded-tr-md px-3.5 py-2">
                                {msg.q}
                              </div>
                            </div>
                            <div className="flex justify-start">
                              <div className="max-w-[90%] bg-[var(--muted)] text-[var(--foreground)] text-[12px] leading-relaxed rounded-2xl rounded-tl-md px-3.5 py-2.5 whitespace-pre-wrap">
                                {msg.a}
                              </div>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-[var(--muted)] rounded-2xl rounded-tl-md px-3.5 py-2.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce" style={{ animationDelay: '120ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce" style={{ animationDelay: '240ms' }} />
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}

                    {/* Quick questions — shown only before first message */}
                    {chatHistory.length === 0 && !chatLoading && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {[
                          'Y a-t-il une réunion prévue ?',
                          'Quels sont les derniers échanges ?',
                          'Y a-t-il des documents manquants ?',
                        ].map(q => (
                          <button
                            key={q}
                            onClick={() => handleChatQuestion(q)}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-blue-50/50 transition-all duration-150"
                          >
                            <MessageSquare className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
                            {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input row */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim() && !chatLoading) handleChatQuestion(chatInput); }}
                        placeholder="Poser une question sur ce dossier…"
                        disabled={chatLoading}
                        className="flex-1 text-[12px] px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted-foreground)] disabled:opacity-50 transition-colors duration-150"
                      />
                      <button
                        onClick={() => { if (chatInput.trim() && !chatLoading) handleChatQuestion(chatInput); }}
                        disabled={chatLoading || !chatInput.trim()}
                        className="p-2 rounded-xl bg-[var(--accent)] text-white disabled:opacity-40 transition-opacity duration-150 flex-shrink-0"
                      >
                        {chatLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                          : <Send className="w-4 h-4" strokeWidth={2} />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Draft reply */}
                <motion.div ref={draftSectionRef} variants={SECTION} className="px-5 py-4">
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
                        {draft.styleMatch && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">Style de rédaction : {draft.styleMatch}</span>
                        )}
                      </div>

                      {sent ? (
                        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[13px] font-medium text-emerald-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                          Réponse envoyée à {log.sender_email}
                        </div>
                      ) : (
                        <>
                          {/* Recipient + signature notice */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              À : <span className="font-medium text-[var(--foreground)]">{log.sender_name ? `${log.sender_name} <${log.sender_email}>` : log.sender_email}</span>
                            </p>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex-shrink-0">
                              Votre signature sera incluse
                            </span>
                          </div>

                          <textarea
                            value={editedDraft}
                            onChange={e => { setEditedDraft(e.target.value); setSendError(null); }}
                            disabled={sending}
                            rows={8}
                            className="w-full text-[13px] text-[var(--foreground)] leading-relaxed bg-[var(--muted)] border border-transparent focus:border-[var(--accent)] focus:outline-none rounded-xl p-4 resize-none disabled:opacity-60 transition-colors duration-150"
                          />
                          {sendError && (
                            <div className="flex items-center gap-1.5 text-[12px] text-red-500 mt-1">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                              {sendError}
                            </div>
                          )}

                          {/* Primary action row */}
                          <div className="flex gap-2 flex-wrap mt-2.5">
                            <button
                              onClick={handleSend}
                              disabled={sending || !editedDraft.trim()}
                              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                              ) : (
                                <Send className="w-4 h-4" strokeWidth={2} />
                              )}
                              {sending ? 'Envoi en cours…' : 'Envoyer'}
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
                              Générer une alternative
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>

              </div>{/* end scrollable body */}


            </motion.div>{/* end stagger wrapper */}
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
