'use client';

import { motion } from 'framer-motion';
import type { CalendarEvent } from '@/lib/calendar-api';
import { formatTime, isSameDayParis } from '@/lib/calendar-utils';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MAX_EVENTS_PER_DAY = 3;

interface Props {
  events: CalendarEvent[];
  currentDate: Date;          // Any date in the month to display
  onEventClick: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayIndex(date: Date): number {
  // Monday=0 … Sunday=6
  return (date.getDay() + 6) % 7;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();
}

export default function MonthView({ events, currentDate, onEventClick, onDayClick }: Props) {
  const today      = new Date();
  const monthStart = startOfMonth(currentDate);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  // Leading empty cells (Mon-aligned grid)
  const leadingOffset = dayIndex(monthStart);

  // Build 6-week grid (42 cells)
  const cells: (Date | null)[] = [
    ...Array(leadingOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] py-2 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-2xl overflow-hidden border border-[var(--border)]">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="bg-[var(--muted)] min-h-[96px]" />;
          }

          const isToday   = isSameDay(day, today);
          const isPast    = day < today && !isToday;
          const dayEvents = events.filter(e => isSameDayParis(e.start, day));
          const overflow  = Math.max(0, dayEvents.length - MAX_EVENTS_PER_DAY);

          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.005, duration: 0.2 }}
              onClick={() => onDayClick?.(day)}
              className={`bg-white min-h-[96px] p-1.5 cursor-pointer transition-colors duration-150 group ${
                isPast ? 'opacity-60' : ''
              } hover:bg-blue-50/40`}
            >
              {/* Day number */}
              <div className="flex justify-center mb-1">
                <span className={`
                  w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium transition-colors
                  ${isToday ? 'bg-[var(--accent)] text-white font-semibold' : 'text-[var(--foreground)] group-hover:bg-[var(--muted)]'}
                `}>
                  {day.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_EVENTS_PER_DAY).map(event => (
                  <button
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    className="w-full text-left px-1.5 py-0.5 rounded-md bg-[var(--accent)] bg-opacity-10 hover:bg-opacity-20 transition-colors group/ev"
                  >
                    <p className="text-[10px] font-medium text-[var(--accent)] truncate leading-tight">
                      {!event.isAllDay && (
                        <span className="opacity-70 mr-0.5">{formatTime(event.start)}</span>
                      )}
                      {event.subject}
                    </p>
                  </button>
                ))}
                {overflow > 0 && (
                  <p className="text-[10px] text-[var(--muted-foreground)] pl-1">
                    +{overflow} autre{overflow > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
