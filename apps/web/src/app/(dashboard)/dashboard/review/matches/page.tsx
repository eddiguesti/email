'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MatchLog, MatchLogFilters } from '@/types/pipeline';
import { getMatchLogs, reviewMatch } from '@/lib/pipeline-api';
import MatchLogRow from '@/components/pipeline/MatchLogRow';
import MatchDetailDrawer from '@/components/pipeline/MatchDetailDrawer';
import FilterBar from '@/components/pipeline/FilterBar';
import { useAuth } from '@/context/AuthContext';

export default function MatchesPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MatchLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MatchLogFilters>({ page: 1, per_page: 50 });
  const [selectedLog, setSelectedLog] = useState<MatchLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMatchLogs(filters);
      setLogs(res.matches);
      setTotal(res.total);
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id: string, approved: boolean) => {
    try {
      await reviewMatch(id, approved);
      setLogs(prev => prev.map(l =>
        l.id === id ? { ...l, review_approved: approved, reviewed_by: user?.email ?? null, reviewed_at: new Date().toISOString() } : l
      ));
    } catch {
      // Fail silently
    }
  };

  const page = filters.page || 1;
  const perPage = filters.per_page || 50;
  const totalPages = Math.ceil(total / perPage);

  return (
    <>
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
          <span className="text-[13px] text-[var(--muted-foreground)]">
            {total} correspondance{total !== 1 ? 's' : ''} trouvée{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--border)] text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
          <div className="w-5 flex-shrink-0" />
          <div className="w-44 flex-shrink-0">Expéditeur</div>
          <div className="flex-1 min-w-0 hidden md:block">Dossier</div>
          <div className="w-14 flex-shrink-0 text-center">Conf.</div>
          <div className="w-40 flex-shrink-0 hidden lg:block">Source</div>
          <div className="w-32 flex-shrink-0 hidden xl:block">Avocat</div>
          <div className="w-36 flex-shrink-0 hidden lg:block">Catégorie</div>
          <div className="w-8 flex-shrink-0" />
          <div className="w-24 flex-shrink-0 text-right">Date</div>
          <div className="w-5 flex-shrink-0" />
        </div>

        {loading ? (
          <div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border)] last:border-b-0 animate-shimmer">
                <div className="w-5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-[var(--muted)]" />
                </div>
                <div className="w-44 flex-shrink-0 space-y-1.5">
                  <div className="h-3 bg-[var(--muted)] rounded w-3/4" />
                  <div className="h-2.5 bg-[var(--muted)] rounded w-full" />
                </div>
                <div className="flex-1 min-w-0 hidden md:block space-y-1.5">
                  <div className="h-3 bg-[var(--muted)] rounded w-2/3" />
                  <div className="h-2.5 bg-[var(--muted)] rounded w-1/3" />
                </div>
                <div className="w-14 flex-shrink-0">
                  <div className="h-6 bg-[var(--muted)] rounded-lg w-full" />
                </div>
                <div className="w-40 flex-shrink-0 hidden lg:block">
                  <div className="h-6 bg-[var(--muted)] rounded-lg w-3/4" />
                </div>
                <div className="w-36 flex-shrink-0 hidden lg:block">
                  <div className="h-6 bg-[var(--muted)] rounded-lg w-full" />
                </div>
                <div className="w-24 flex-shrink-0 ml-auto">
                  <div className="h-2.5 bg-[var(--muted)] rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[var(--muted-foreground)]">Aucun résultat</div>
        ) : (
          logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <MatchLogRow log={log} onReview={handleReview} showReviewActions onSelect={setSelectedLog} />
            </motion.div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: page - 1 }))}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-xl border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--muted)] transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.8} /> Précédent
          </button>
          <span className="text-[13px] text-[var(--muted-foreground)]">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setFilters(f => ({ ...f, page: page + 1 }))}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-xl border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--muted)] transition-all duration-200"
          >
            Suivant <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>

      <MatchDetailDrawer
        log={selectedLog}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        onReview={(id, approved) => {
          handleReview(id, approved);
          setSelectedLog(null);
        }}
      />
    </>
  );
}
