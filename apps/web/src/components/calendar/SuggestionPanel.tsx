'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, CheckCircle2, XCircle, Edit3, Clock, CalendarDays, Loader2,
} from 'lucide-react';
import type { CalendarSuggestion } from '@/lib/calendar-api';
import { dismissSuggestion, acceptSuggestion } from '@/lib/calendar-api';
import { formatDateShort, formatTime } from '@/lib/calendar-utils';
import { toast } from 'sonner';
import SuggestionEditModal from './SuggestionEditModal';

interface Props {
  suggestions: CalendarSuggestion[];
  loading: boolean;
  onRefresh: () => void;
}

function confidenceDot(c: number): string {
  if (c >= 0.85) return 'bg-emerald-400';
  if (c >= 0.65) return 'bg-amber-400';
  return 'bg-orange-400';
}

export default function SuggestionPanel({ suggestions, loading, onRefresh }: Props) {
  const [editTarget,        setEditTarget]        = useState<CalendarSuggestion | null>(null);
  const [busyIds,           setBusyIds]           = useState<Set<string>>(new Set());
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(new Set());

  // Suggestions visible to the user: real list minus optimistically-removed items
  const visibleSuggestions = suggestions.filter(s => !optimisticRemoved.has(s.id));

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const optimisticRemove = (id: string) =>
    setOptimisticRemoved(prev => new Set(prev).add(id));

  const optimisticRestore = (id: string) =>
    setOptimisticRemoved(prev => { const next = new Set(prev); next.delete(id); return next; });

  const handleQuickAccept = async (s: CalendarSuggestion) => {
    setBusy(s.id, true);
    optimisticRemove(s.id);
    try {
      await acceptSuggestion(s.id);
      toast.success(`"${s.title.slice(0, 40)}" ajouté au calendrier`);
      onRefresh();
    } catch (err) {
      optimisticRestore(s.id);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(s.id, false);
    }
  };

  const handleDismiss = async (s: CalendarSuggestion) => {
    setBusy(s.id, true);
    optimisticRemove(s.id);
    try {
      await dismissSuggestion(s.id);
      toast.success('Suggestion ignorée');
      onRefresh();
    } catch (err) {
      optimisticRestore(s.id);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(s.id, false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[var(--border)]">
        <Sparkles className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
        <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex-1">
          Suggestions agenda
        </h3>
        {visibleSuggestions.length > 0 && (
          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {visibleSuggestions.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : visibleSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-[var(--muted-foreground)]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-[var(--foreground)]">Aucune suggestion</p>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
              Les emails contenant des rendez-vous apparaîtront ici automatiquement
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visibleSuggestions.map((s, idx) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="border-b border-[var(--border)] last:border-0"
              >
                <div className="px-4 py-3.5">
                  {/* Confidence indicator */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-2 h-2 rounded-full ${confidenceDot(s.confidence)}`} />
                    <span className="text-[10px] font-medium text-[var(--muted-foreground)]">
                      {Math.round(s.confidence * 100)}% confiance
                    </span>
                    {s.sender_name && (
                      <>
                        <span className="text-[var(--border)]">·</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[100px]">
                          {s.sender_name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <p className="text-[13px] font-semibold text-[var(--foreground)] leading-snug mb-1.5">
                    {s.title}
                  </p>

                  {/* Date/time */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mb-1">
                    <Clock className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
                    <span className="capitalize">{formatDateShort(s.start_at)}</span>
                    <span>·</span>
                    <span>{formatTime(s.start_at)}</span>
                    {s.end_at && (
                      <span>– {formatTime(s.end_at)}</span>
                    )}
                  </div>

                  {/* Evidence snippet */}
                  {s.evidence && (
                    <p className="text-[11px] text-[var(--muted-foreground)] italic line-clamp-2 mt-1.5 mb-2.5 leading-relaxed">
                      &ldquo;{s.evidence.slice(0, 120)}&rdquo;
                    </p>
                  )}

                  {/* Actions */}
                  {busyIds.has(s.id) ? (
                    <div className="flex justify-center py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2">
                      {/* Quick accept */}
                      <button
                        onClick={() => handleQuickAccept(s)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold transition-all duration-150"
                        title="Ajouter sans modifier"
                      >
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                        Ajouter
                      </button>

                      {/* Edit & accept */}
                      <button
                        onClick={() => setEditTarget(s)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white text-[11px] font-medium transition-all duration-150"
                        title="Modifier avant d'ajouter"
                      >
                        <Edit3 className="w-3 h-3" strokeWidth={2} />
                        Modifier
                      </button>

                      {/* Dismiss */}
                      <button
                        onClick={() => handleDismiss(s)}
                        className="ml-auto p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-red-50 transition-all duration-150"
                        title="Ignorer cette suggestion"
                      >
                        <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Edit modal */}
      <SuggestionEditModal
        suggestion={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onAccepted={onRefresh}
      />
    </div>
  );
}
