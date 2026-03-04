'use client';

import { motion } from 'framer-motion';
import { MapPin, Users, Video, Clock } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-api';
import { parisDayKey, formatTime, formatDateLong } from '@/lib/calendar-utils';

interface Props {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export default function AgendaView({ events, onEventClick }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mb-4">
          <Clock className="w-6 h-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-medium text-[var(--foreground)]">No events</p>
        <p className="text-[13px] text-[var(--muted-foreground)] mt-1.5">
          Your calendar is empty for this period
        </p>
      </div>
    );
  }

  // Sort events chronologically, then group by calendar day (Europe/Paris)
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const groups: { dayKey: string; events: CalendarEvent[] }[] = [];
  for (const event of sorted) {
    const key = parisDayKey(event.start);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === key) {
      last.events.push(event);
    } else {
      groups.push({ dayKey: key, events: [event] });
    }
  }

  const todayKey = parisDayKey(new Date().toISOString());

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => {
        const isToday = group.dayKey === todayKey;
        // Use the first event's ISO to format the day header
        const representativeIso = group.events[0].start;

        return (
          <motion.div
            key={group.dayKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: gi * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Day header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex items-center gap-2 ${isToday ? 'text-[var(--accent)]' : 'text-[var(--muted-foreground)]'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                  isToday ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-[var(--foreground)]'
                }`}>
                  {parseInt(group.dayKey.slice(8))}
                </div>
                <span className="text-[13px] font-medium capitalize">
                  {formatDateLong(representativeIso)}
                </span>
              </div>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Events */}
            <div className="space-y-2 ml-1">
              {group.events.map((event) => (
                <EventRow key={event.id} event={event} onClick={() => onEventClick(event)} />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function EventRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const hasOnlineMeeting = !!event.onlineMeetingUrl;
  const hasLocation      = !!event.location;
  const attendeeCount    = event.attendees?.length || 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-[0_0_0_3px_rgba(0,113,227,0.08)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {/* Time column */}
      <div className="flex-shrink-0 w-16 text-right">
        {event.isAllDay ? (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)] bg-blue-50 rounded-md">
            All day
          </span>
        ) : (
          <div>
            <p className="text-[12px] font-medium text-[var(--foreground)]">
              {formatTime(event.start)}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {formatTime(event.end)}
            </p>
          </div>
        )}
      </div>

      {/* Color bar */}
      <div className="flex-shrink-0 w-1 self-stretch rounded-full bg-[var(--accent)] opacity-70 group-hover:opacity-100 transition-opacity" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--foreground)] truncate group-hover:text-[var(--accent)] transition-colors">
          {event.subject}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {hasLocation && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
              <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
              <span className="truncate max-w-[180px]">{event.location}</span>
            </span>
          )}
          {hasOnlineMeeting && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--accent)]">
              <Video className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
              Online meeting
            </span>
          )}
          {attendeeCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
              <Users className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
              {attendeeCount} participant{attendeeCount > 1 ? 's' : ''}
            </span>
          )}
          {event.categories?.map(c => (
            <span key={c} className="text-[10px] px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] rounded-md font-medium">
              {c}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
