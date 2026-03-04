'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Calendar, Clock, MapPin, Sparkles } from 'lucide-react';
import type { CalendarSuggestion } from '@/lib/calendar-api';
import { acceptSuggestion } from '@/lib/calendar-api';
import { toDatetimeLocal, fromDatetimeLocal } from '@/lib/calendar-utils';
import { toast } from 'sonner';

interface Props {
  suggestion: CalendarSuggestion | null;
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
}

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.85) return { label: 'Very confident', color: 'text-emerald-600 bg-emerald-50' };
  if (c >= 0.65) return { label: 'Likely', color: 'text-amber-600 bg-amber-50' };
  return { label: 'Uncertain', color: 'text-orange-600 bg-orange-50' };
}

export default function SuggestionEditModal({ suggestion, open, onClose, onAccepted }: Props) {
  const [title,       setTitle]       = useState('');
  const [startAt,     setStartAt]     = useState('');
  const [endAt,       setEndAt]       = useState('');
  const [location,    setLocation]    = useState('');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!suggestion) return;
    setTitle(suggestion.title);
    setStartAt(toDatetimeLocal(suggestion.start_at));
    setEndAt(suggestion.end_at ? toDatetimeLocal(suggestion.end_at) : '');
    setLocation(suggestion.location || '');
    setDescription(suggestion.description || '');
  }, [suggestion]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!suggestion) return null;

  const conf = confidenceLabel(suggestion.confidence);

  const handleAccept = async () => {
    if (!title.trim() || !startAt) {
      toast.error('Title and start date required');
      return;
    }
    if (endAt && fromDatetimeLocal(endAt) <= fromDatetimeLocal(startAt)) {
      toast.error('End date must be after start date');
      return;
    }
    setSaving(true);
    try {
      await acceptSuggestion(suggestion.id, {
        title:       title.trim(),
        start_at:    fromDatetimeLocal(startAt),
        end_at:      endAt ? fromDatetimeLocal(endAt) : undefined,
        location:    location.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast.success('Event added to Outlook calendar');
      onAccepted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-50 backdrop-blur-[3px]"
            onClick={onClose}
          />

          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-[var(--shadow-modal)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={2} />
                    <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                      Suggestion agenda
                    </span>
                  </div>
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                    Review and add
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${conf.color}`}>
                    {conf.label}
                  </span>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Evidence snippet */}
              {suggestion.evidence && (
                <div className="mx-6 mt-4 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-[11px] text-amber-700 font-medium mb-0.5">
                    Extrait de l&apos;email source
                  </p>
                  <p className="text-[11px] text-amber-600 line-clamp-2 italic">
                    &ldquo;{suggestion.evidence.slice(0, 200)}&rdquo;
                  </p>
                </div>
              )}

              {/* Form */}
              <div className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Event title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    maxLength={200}
                    className="w-full px-3 py-2.5 text-[13px] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--muted-foreground)]"
                    placeholder="Event title"
                  />
                </div>

                {/* Start + End */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                      <Calendar className="w-3 h-3 inline mr-1" strokeWidth={2} />
                      Start
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={e => setStartAt(e.target.value)}
                      className="w-full px-3 py-2.5 text-[12px] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                      <Clock className="w-3 h-3 inline mr-1" strokeWidth={2} />
                      Fin
                    </label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={e => setEndAt(e.target.value)}
                      className="w-full px-3 py-2.5 text-[12px] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    <MapPin className="w-3 h-3 inline mr-1" strokeWidth={2} />
                    Lieu (optionnel)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2.5 text-[13px] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--muted-foreground)]"
                    placeholder="Salle, adresse, lien…"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full px-3 py-2.5 text-[13px] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none placeholder:text-[var(--muted-foreground)]"
                    placeholder="Notes ou contexte…"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAccept}
                  disabled={saving || !title.trim() || !startAt}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--accent)] text-white hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Ajout en cours…
                    </>
                  ) : (
                    'Ajouter au calendrier'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
