'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import type { CalendarEvent } from '@/lib/calendar-api';
import { formatTime, isSameDayParis, parseParisTime } from '@/lib/calendar-utils';

const DAYS_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_HEIGHT = 56; // pixels per hour

interface Props {
  events: CalendarEvent[];
  currentDate: Date;           // Any date in the week to display
  onEventClick: (event: CalendarEvent) => void;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();
}

function eventTopPx(startIso: string): number {
  const { hours, minutes } = parseParisTime(startIso);
  return (hours + minutes / 60) * SLOT_HEIGHT;
}

function eventHeightPx(startIso: string, endIso: string): number {
  const s = parseParisTime(startIso);
  const e = parseParisTime(endIso);
  const durationH = (e.hours + e.minutes / 60) - (s.hours + s.minutes / 60);
  return Math.max(SLOT_HEIGHT * 0.5, durationH * SLOT_HEIGHT);
}

export default function WeekView({ events, currentDate, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today     = new Date();
  const weekDays  = getWeekDays(currentDate);

  const allDay = events.filter(e => e.isAllDay);
  const timed  = events.filter(e => !e.isAllDay);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-[var(--border)]">
      {/* All-day row */}
      {allDay.length > 0 && (
        <div className="flex border-b border-[var(--border)] bg-[var(--muted)]">
          <div className="w-12 flex-shrink-0 py-2 text-right pr-2 text-[10px] text-[var(--muted-foreground)]">Jour</div>
          {weekDays.map((day, di) => {
            const dayAllDay = allDay.filter(e => isSameDayParis(e.start, day));
            return (
              <div key={di} className="flex-1 px-1 py-1 border-l border-[var(--border)] min-w-0">
                {dayAllDay.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="w-full text-left px-1.5 py-0.5 rounded bg-[var(--accent)] bg-opacity-15 text-[10px] font-medium text-[var(--accent)] truncate hover:bg-opacity-25 transition-colors mb-0.5"
                  >
                    {e.subject}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Column headers */}
      <div className="flex border-b border-[var(--border)] bg-white sticky top-0 z-10">
        <div className="w-12 flex-shrink-0" />
        {weekDays.map((day, di) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={di} className="flex-1 py-2 text-center border-l border-[var(--border)] min-w-0">
              <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">
                {DAYS_FR_SHORT[di]}
              </p>
              <div className={`
                w-7 h-7 mx-auto mt-0.5 flex items-center justify-center rounded-full text-[14px] font-medium
                ${isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--foreground)]'}
              `}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: `${SLOT_HEIGHT * 24}px`, position: 'relative' }}>
          {/* Hour labels */}
          <div className="w-12 flex-shrink-0 relative">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-[var(--muted-foreground)]"
                style={{ top: h * SLOT_HEIGHT - 6 }}
              >
                {h === 0 ? '' : `${String(h).padStart(2, '0')}h`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const isToday  = isSameDay(day, today);
            const dayEvents = timed.filter(e => isSameDayParis(e.start, day));

            return (
              <div
                key={di}
                className={`flex-1 relative border-l border-[var(--border)] min-w-0 ${
                  isToday ? 'bg-blue-50/20' : ''
                }`}
              >
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-[var(--border)]"
                    style={{ top: h * SLOT_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map(event => {
                  const top    = eventTopPx(event.start);
                  const height = eventHeightPx(event.start, event.end);
                  return (
                    <motion.button
                      key={event.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => onEventClick(event)}
                      className="absolute left-0.5 right-0.5 rounded-lg bg-[var(--accent)] bg-opacity-15 border border-[var(--accent)] border-opacity-30 hover:bg-opacity-25 transition-all duration-150 text-left overflow-hidden px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      style={{ top, height: Math.max(height, 22) }}
                    >
                      <p className="text-[10px] font-semibold text-[var(--accent)] truncate leading-tight">
                        {formatTime(event.start)} {event.subject}
                      </p>
                      {height > 34 && event.location && (
                        <p className="text-[9px] text-[var(--accent)] opacity-70 truncate mt-0.5">
                          {event.location}
                        </p>
                      )}
                    </motion.button>
                  );
                })}

                {/* Current time indicator — uses Europe/Paris via parseParisTime */}
                {isToday && (() => {
                  const { hours, minutes } = parseParisTime(new Date().toISOString());
                  const top = (hours + minutes / 60) * SLOT_HEIGHT;
                  return (
                    <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top }}>
                      <div className="relative">
                        <div className="absolute -left-1 top-[-4px] w-2 h-2 rounded-full bg-[var(--destructive)]" />
                        <div className="h-px bg-[var(--destructive)]" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
