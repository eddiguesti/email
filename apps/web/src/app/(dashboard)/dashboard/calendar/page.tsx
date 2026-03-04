'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LayoutList,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import type { CalendarEvent, CalendarSuggestion } from '@/lib/calendar-api';
import { getCalendarEvents, getCalendarSuggestions } from '@/lib/calendar-api';
import AgendaView from '@/components/calendar/AgendaView';
import MonthView  from '@/components/calendar/MonthView';
import WeekView   from '@/components/calendar/WeekView';
import EventDetailsDrawer from '@/components/calendar/EventDetailsDrawer';
import SuggestionPanel    from '@/components/calendar/SuggestionPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type CalView = 'agenda' | 'week' | 'month';

const VIEW_LABELS: Record<CalView, { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }> }> = {
  agenda: { label: 'Agenda',  icon: LayoutList  },
  week:   { label: 'Semaine', icon: CalendarRange },
  month:  { label: 'Mois',    icon: CalendarDays  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatWeekRange(date: Date): string {
  const dow = (date.getDay() + 6) % 7;
  const mon = new Date(date); mon.setDate(date.getDate() - dow);
  const sun = new Date(mon);  sun.setDate(mon.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${mon.toLocaleDateString('fr-FR', opts)} – ${sun.toLocaleDateString('fr-FR', opts)} ${sun.getFullYear()}`;
}

function getDateRange(view: CalView, date: Date): { startDate: Date; endDate: Date } {
  if (view === 'month') {
    return {
      startDate: new Date(date.getFullYear(), date.getMonth(), 1),
      endDate:   new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (view === 'week') {
    const dow = (date.getDay() + 6) % 7;
    const startDate = new Date(date); startDate.setDate(date.getDate() - dow); startDate.setHours(0,0,0,0);
    const endDate   = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
    return { startDate, endDate };
  }
  // Agenda: next 30 days
  const startDate = new Date(); startDate.setHours(0,0,0,0);
  const endDate   = new Date(startDate.getTime() + 30 * 86400_000);
  return { startDate, endDate };
}

function navigate(view: CalView, date: Date, dir: -1 | 1): Date {
  const d = new Date(date);
  if (view === 'month') { d.setMonth(d.getMonth() + dir); return d; }
  if (view === 'week')  { d.setDate(d.getDate() + dir * 7); return d; }
  d.setDate(d.getDate() + dir * 30); return d;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="space-y-3 animate-shimmer">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="h-16 bg-[var(--muted)] rounded-xl"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view,          setView]          = useState<CalView>('week');
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [events,        setEvents]        = useState<CalendarEvent[]>([]);
  const [suggestions,   setSuggestions]   = useState<CalendarSuggestion[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSugg,   setLoadingSugg]   = useState(true);
  const [eventsError,   setEventsError]   = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const { startDate, endDate } = getDateRange(view, currentDate);
      const res = await getCalendarEvents({ startDate, endDate });
      setEvents(res.events);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoadingEvents(false);
    }
  }, [view, currentDate]);

  const loadSuggestions = useCallback(async () => {
    setLoadingSugg(true);
    try {
      const res = await getCalendarSuggestions('pending');
      setSuggestions(res.suggestions);
    } catch {
      // Non-fatal
    } finally {
      setLoadingSugg(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const goToToday = () => {
    startTransition(() => setCurrentDate(new Date()));
  };

  const goDirection = (dir: -1 | 1) => {
    startTransition(() => setCurrentDate(d => navigate(view, d, dir)));
  };

  const titleLabel = view === 'month'
    ? formatMonthYear(currentDate)
    : view === 'week'
    ? formatWeekRange(currentDate)
    : 'Agenda — next 30 days';

  return (
    <div className="flex gap-6 h-[calc(100vh-64px)]">
      {/* ── Main calendar area ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div>
            <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">
              Calendrier
            </h1>
            <p className="text-[14px] text-[var(--muted-foreground)] mt-0.5 capitalize">
              {titleLabel}
            </p>
          </div>

          <div data-tour="calendar-view" className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={() => { loadEvents(); loadSuggestions(); }}
              className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200"
              title="Actualiser"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.8} />
            </button>

            {/* View toggles */}
            <div className="flex items-center bg-[var(--muted)] rounded-xl p-0.5">
              {(Object.keys(VIEW_LABELS) as CalView[]).map(v => {
                const { label, icon: Icon } = VIEW_LABELS[v];
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all duration-200 ${
                      view === v
                        ? 'bg-white text-[var(--foreground)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation bar (Today + prev/next) */}
        {view !== 'agenda' && (
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-xl text-[12px] font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200"
            >
              Aujourd&apos;hui
            </button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => goDirection(-1)}
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                onClick={() => goDirection(1)}
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <h2 className="text-[14px] font-medium text-[var(--foreground)] capitalize">
              {view === 'month' ? formatMonthYear(currentDate) : formatWeekRange(currentDate)}
            </h2>
          </div>
        )}

        {/* Calendar body */}
        <div className="flex-1 overflow-hidden">
          {loadingEvents ? (
            <CalendarSkeleton />
          ) : eventsError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
                <CalendarDays className="w-5 h-5 text-[var(--destructive)]" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-medium text-[var(--foreground)]">
                Impossible de charger le calendrier
              </p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1 mb-4">
                {eventsError}
              </p>
              <button
                onClick={loadEvents}
                className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
              >
                Retry
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${currentDate.toISOString().slice(0, 10)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-auto"
              >
                {view === 'agenda' && (
                  <AgendaView
                    events={events}
                    onEventClick={setSelectedEvent}
                  />
                )}
                {view === 'week' && (
                  <WeekView
                    events={events}
                    currentDate={currentDate}
                    onEventClick={setSelectedEvent}
                  />
                )}
                {view === 'month' && (
                  <MonthView
                    events={events}
                    currentDate={currentDate}
                    onEventClick={setSelectedEvent}
                    onDayClick={(day) => { setCurrentDate(day); setView('agenda'); }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* ── Suggestions sidebar ────────────────────────────────────────── */}
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-[300px] flex-shrink-0 bg-white rounded-2xl shadow-[var(--shadow-card)] border border-[var(--border)] overflow-hidden flex flex-col self-start sticky top-0"
        style={{ maxHeight: 'calc(100vh - 64px)' }}
      >
        <SuggestionPanel
          suggestions={suggestions}
          loading={loadingSugg}
          onRefresh={loadSuggestions}
        />
      </motion.aside>

      {/* Event details drawer */}
      <EventDetailsDrawer
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
