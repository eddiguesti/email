'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, MapPin, Users, Video, Clock, Calendar, ExternalLink,
} from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-api';

interface Props {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Paris',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  });
}

function durationLabel(startIso: string, endIso: string): string {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default function EventDetailsDrawer({ event, open, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && event && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-[95vw] bg-white shadow-[var(--shadow-lg)] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
                  <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                    Outlook Event
                  </span>
                </div>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] leading-snug">
                  {event.subject}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-200"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Date & Time */}
              <Section icon={<Calendar className="w-4 h-4" />} label="Date">
                <p className="text-[14px] font-medium text-[var(--foreground)] capitalize">
                  {formatFullDate(event.start)}
                </p>
                {!event.isAllDay && (
                  <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.8} />
                    {formatTime(event.start)} – {formatTime(event.end)}
                    <span className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded-md font-medium">
                      {durationLabel(event.start, event.end)}
                    </span>
                  </p>
                )}
                {event.isAllDay && (
                  <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">All day</p>
                )}
              </Section>

              {/* Location */}
              {event.location && (
                <Section icon={<MapPin className="w-4 h-4" />} label="Lieu">
                  <p className="text-[13px] text-[var(--foreground)]">{event.location}</p>
                </Section>
              )}

              {/* Online meeting */}
              {event.onlineMeetingUrl && (
                <Section icon={<Video className="w-4 h-4" />} label="Online meeting">
                  <a
                    href={event.onlineMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:underline font-medium"
                  >
                    Join meeting <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  </a>
                </Section>
              )}

              {/* Organizer */}
              {event.organizer && (
                <Section icon={<Users className="w-4 h-4" />} label="Organisateur">
                  <p className="text-[13px] text-[var(--foreground)]">{event.organizer}</p>
                </Section>
              )}

              {/* Attendees */}
              {event.attendees && event.attendees.length > 0 && (
                <Section icon={<Users className="w-4 h-4" />} label={`Attendees (${event.attendees.length})`}>
                  <div className="space-y-1.5">
                    {event.attendees.slice(0, 10).map((a, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[var(--muted)] flex items-center justify-center text-[10px] font-semibold text-[var(--foreground)] flex-shrink-0">
                          {(a.name || a.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {a.name && (
                            <p className="text-[12px] font-medium text-[var(--foreground)] truncate">{a.name}</p>
                          )}
                          <p className="text-[11px] text-[var(--muted-foreground)] truncate">{a.email}</p>
                        </div>
                      </div>
                    ))}
                    {event.attendees.length > 10 && (
                      <p className="text-[11px] text-[var(--muted-foreground)] pl-8">
                        +{event.attendees.length - 10} more
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* Body preview */}
              {event.bodyPreview && (
                <Section icon={<Calendar className="w-4 h-4" />} label="Preview">
                  <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed line-clamp-4 whitespace-pre-wrap">
                    {event.bodyPreview}
                  </p>
                </Section>
              )}

              {/* Categories */}
              {event.categories && event.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {event.categories.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-[var(--muted)] text-[11px] font-medium text-[var(--muted-foreground)] rounded-lg">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all duration-200"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 text-[var(--muted-foreground)]">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}
