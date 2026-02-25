'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Paperclip,
  Flag,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getEmails, EmailMessage, createTodoFromEmail } from '@/lib/api';

interface EmailListProps {
  folderId: string;
  folderName: string;
}

export default function EmailList({ folderId, folderName }: EmailListProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const pageSize = 25;

  const loadEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmails(folderId, page * pageSize, pageSize);
      setEmails(data.emails);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    loadEmails();
  }, [folderId]);

  useEffect(() => {
    loadEmails();
  }, [page]);

  const handleCreateTodo = async (email: EmailMessage) => {
    try {
      await createTodoFromEmail(email);
      alert('Tâche créée avec succès!');
    } catch (err) {
      alert('Erreur: ' + (err as Error).message);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatEmailDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay) {
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    } else if (diff < 7 * oneDay) {
      return format(date, 'EEEE', { locale: fr });
    } else {
      return format(date, 'dd MMM', { locale: fr });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[var(--muted)]">
            <Mail className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{folderName}</h2>
            <p className="text-[12px] text-[var(--muted-foreground)]">{total} emails</p>
          </div>
        </div>
        <button
          onClick={loadEmails}
          disabled={loading}
          className="p-2.5 rounded-xl hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-all duration-200"
          title="Actualiser"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
        </button>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-6 flex items-center gap-3 text-[var(--destructive)]">
            <AlertCircle className="w-4 h-4" strokeWidth={1.8} />
            <span className="text-[13px]">{error}</span>
            <button
              onClick={loadEmails}
              className="ml-2 text-[13px] text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)] mx-auto" />
            <p className="mt-3 text-[13px] text-[var(--muted-foreground)]">Chargement des emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-[14px] text-[var(--muted-foreground)]">Aucun email dans ce dossier</p>
          </div>
        ) : (
          <div>
            {emails.map((email, index) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02, duration: 0.3 }}
                className={`
                  px-6 py-4 hover:bg-[var(--muted)] transition-all duration-200 cursor-pointer group
                  ${index > 0 ? 'border-t border-[var(--border)]' : ''}
                `}
                onClick={() => setSelectedEmail(email)}
              >
                <div className="flex items-start gap-4">
                  {/* Unread indicator + flags */}
                  <div className="mt-1.5 flex flex-col items-center gap-1.5 w-3">
                    {!email.isRead && (
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    )}
                    {email.flag.flagStatus === 'flagged' && (
                      <Flag className="w-3 h-3 text-orange-400" strokeWidth={2} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[14px] truncate ${!email.isRead ? 'font-semibold text-[var(--foreground)]' : 'font-medium text-[var(--muted-foreground)]'}`}>
                        {email.from.name}
                      </span>
                      {email.hasAttachments && (
                        <Paperclip className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" strokeWidth={1.8} />
                      )}
                      {email.importance === 'high' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-50 text-red-500 font-medium">
                          Important
                        </span>
                      )}
                    </div>

                    <p className={`text-[13px] truncate mt-0.5 ${!email.isRead ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                      {email.subject}
                    </p>

                    <p className="text-[12px] text-[var(--muted-foreground)] truncate mt-1 opacity-70">
                      {email.preview}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[12px] text-[var(--muted-foreground)] whitespace-nowrap">
                      {formatEmailDate(email.receivedDateTime)}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateTodo(email);
                      }}
                      className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--foreground)] hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Créer une tâche"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[12px] text-[var(--muted-foreground)]">
            Page {page + 1} sur {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
