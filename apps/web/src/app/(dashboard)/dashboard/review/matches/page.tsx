'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import type { MatchLog, MatchLogFilters } from '@/types/pipeline';
import { getMatchLogs } from '@/lib/pipeline-api';
import MatchLogRow from '@/components/pipeline/MatchLogRow';
import MatchDetailDrawer from '@/components/pipeline/MatchDetailDrawer';
import FilterBar from '@/components/pipeline/FilterBar';

export default function MatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialise filters from URL so they survive refresh and can be shared
  const [filters, setFilters] = useState<MatchLogFilters>(() => ({
    page: Number(searchParams.get('page') || 1),
    per_page: 50,
    matched: searchParams.has('matched') ? searchParams.get('matched') === 'true' : undefined,
    reviewed: searchParams.get('reviewed') || undefined,
    source: searchParams.get('source') || undefined,
    lawyer: searchParams.get('lawyer') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
  }));

  const [logs, setLogs] = useState<MatchLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MatchLog | null>(null);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1) params.set('page', String(filters.page));
    if (filters.matched !== undefined) params.set('matched', String(filters.matched));
    if (filters.reviewed) params.set('reviewed', filters.reviewed);
    if (filters.source) params.set('source', filters.source);
    if (filters.lawyer) params.set('lawyer', filters.lawyer);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getMatchLogs(filters);
      setLogs(res.matches);
      setTotal(res.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

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

      <div data-tour="matches-table" className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--border)] text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
          <div className="w-5 flex-shrink-0" />
          <div className="w-44 flex-shrink-0">Expéditeur</div>
          <div className="flex-1 min-w-0 hidden md:block">Dossier</div>
          <div className="w-14 flex-shrink-0 text-center" title="Score de confiance de l'IA (85%+ = classé automatiquement)">Confiance</div>
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
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center p-10 gap-3 text-center">
            <AlertCircle className="w-6 h-6 text-red-400" strokeWidth={1.5} />
            <p className="text-[13px] text-[var(--muted-foreground)]">
              Impossible de charger les correspondances. Vérifiez votre connexion.
            </p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-xl bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.8} />
              Réessayer
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center space-y-1">
            <p className="text-[13px] text-[var(--foreground)]">Aucun résultat</p>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Essayez d&apos;ajuster les filtres ou de changer la plage de dates.
            </p>
          </div>
        ) : (
          logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <MatchLogRow log={log} onSelect={setSelectedLog} />
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
      />
    </>
  );
}
