'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

import { Activity, CheckCircle, XCircle, FileText, Settings, Search, LogIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getActivityLogs } from '@/lib/pipeline-api';
import type { ActivityLog } from '@/types/pipeline';

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  match_approved: { label: 'Match approved', icon: CheckCircle, color: 'text-emerald-400' },
  match_rejected: { label: 'Match rejected', icon: XCircle, color: 'text-red-400' },
  draft_generated: { label: 'Draft generated', icon: FileText, color: 'text-[var(--accent)]' },
  settings_updated: { label: 'Settings updated', icon: Settings, color: 'text-amber-400' },
  login: { label: 'Login', icon: LogIn, color: 'text-[var(--foreground)]' },
  search: { label: 'Search', icon: Search, color: 'text-purple-400' },
};

const DEFAULT_ACTION = { label: 'Action', icon: Activity, color: 'text-[var(--muted-foreground)]' };

export default function ActivityPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<'all' | 'me'>('all');
  const perPage = 30;

  const load = async () => {
    setLoading(true);
    try {
      const res = await getActivityLogs({ page, per_page: perPage });
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filterUser]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">Activity Log</h1>
        <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
          History of actions performed by users
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 border-b border-[var(--border)]">
          <button
            onClick={() => { setFilterUser('all'); setPage(1); }}
            className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 ${
              filterUser === 'all'
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Tous les utilisateurs
            {filterUser === 'all' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--foreground)] rounded-full" />
            )}
          </button>
          <button
            onClick={() => { setFilterUser('me'); setPage(1); }}
            className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 ${
              filterUser === 'me'
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Mes actions
            {filterUser === 'me' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--foreground)] rounded-full" />
            )}
          </button>
        </div>
        <span className="text-[12px] text-[var(--muted-foreground)]">
          {total} entr{total !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-white rounded-2xl shadow-[var(--shadow-card)] animate-shimmer" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
            <Activity className="w-6 h-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] text-[var(--muted-foreground)]">No activity recorded</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          {logs.map((log, index) => {
            const config = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
            const Icon = config.icon;
            const details = log.details as Record<string, unknown> | null;
            const dossierRef = details?.dossier_ref ? String(details.dossier_ref) : '';
            const dossierName = details?.dossier_name ? String(details.dossier_name) : '';
            const senderEmail = details?.sender_email ? String(details.sender_email) : '';
            const changes = Array.isArray(details?.changes) ? (details.changes as string[]).join(', ') : '';

            return (
              <div
                key={log.id}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)] transition-all duration-200 ${
                  index > 0 ? 'border-t border-[var(--border)]' : ''
                }`}
              >
                <div className={`flex-shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--foreground)]">
                      {config.label}
                    </span>
                    {dossierRef && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--muted)] text-[var(--muted-foreground)]">
                        {dossierRef}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {log.user_name || log.user_email}
                    </span>
                    {dossierName && (
                      <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                        — {dossierName}
                      </span>
                    )}
                    {senderEmail && (
                      <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                        — {senderEmail}
                      </span>
                    )}
                    {changes && (
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        — {changes}
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex-shrink-0 text-[11px] text-[var(--muted-foreground)]">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              Suivant
              <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
