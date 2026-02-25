/**
 * Shared calendar date/time utilities.
 *
 * All helpers operate in the Europe/Paris timezone — the canonical timezone
 * for this application. Never use getHours()/getDate()/etc. directly on
 * calendar event ISO strings; always go through these helpers.
 */

export const CALENDAR_TZ = 'Europe/Paris';

// ─── Day identity ──────────────────────────────────────────────────────────────

/**
 * Returns the calendar day of an ISO timestamp in Europe/Paris as "YYYY-MM-DD".
 * Use this for grouping and day comparisons instead of `.getDate()`.
 */
export function parisDayKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: CALENDAR_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Returns true if the ISO event timestamp falls on the same calendar day
 * (in Europe/Paris) as the given local Date object.
 */
export function isSameDayParis(iso: string, day: Date): boolean {
  const key = parisDayKey(iso);
  const y = parseInt(key.slice(0, 4));
  const m = parseInt(key.slice(5, 7)) - 1; // 0-based month
  const d = parseInt(key.slice(8, 10));
  return y === day.getFullYear() && m === day.getMonth() && d === day.getDate();
}

// ─── Time parsing ──────────────────────────────────────────────────────────────

/**
 * Returns { hours, minutes } of an ISO timestamp in Europe/Paris.
 * Used for positioning events on the week-view timeline.
 */
export function parseParisTime(iso: string): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    hour: 'numeric', minute: 'numeric',
    timeZone: CALENDAR_TZ, hour12: false,
  }).formatToParts(new Date(iso));
  return {
    hours:   parseInt(parts.find(p => p.type === 'hour')?.value   || '0'),
    minutes: parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
  };
}

// ─── Formatting ────────────────────────────────────────────────────────────────

/** "14:30" in Europe/Paris */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: CALENDAR_TZ,
  });
}

/** "lundi 12 mars 2026" (full weekday + date) in Europe/Paris */
export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: CALENDAR_TZ,
  });
}

/** "lun. 12 mars" (abbreviated weekday + date) in Europe/Paris */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: CALENDAR_TZ,
  });
}

// ─── datetime-local input helpers ──────────────────────────────────────────────

/**
 * Converts a UTC ISO string to "YYYY-MM-DDTHH:mm" in Europe/Paris
 * for use with <input type="datetime-local" />.
 */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: CALENDAR_TZ,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" datetime-local value (interpreted as
 * Europe/Paris local time) back to a UTC ISO string.
 *
 * Strategy: parse naively as UTC, then compute the Paris timezone offset
 * at that moment, and shift by that offset to obtain the real UTC instant.
 * This correctly handles DST transitions.
 */
export function fromDatetimeLocal(val: string): string {
  // 1. Parse the value as if it were a UTC instant (naive UTC)
  const naiveUtc = new Date(val + ':00.000Z');
  // 2. Ask Intl what Europe/Paris shows for that naive UTC moment
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: CALENDAR_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(naiveUtc);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0');
  // 3. Express that Paris reading as a UTC timestamp
  const parisOfNaive = Date.UTC(
    get('year'), get('month') - 1, get('day'), get('hour'), get('minute')
  );
  // 4. Offset = parisOfNaive − naiveUtc  (e.g. +3 600 000 ms for UTC+1)
  const offsetMs = parisOfNaive - naiveUtc.getTime();
  // 5. Real UTC = naiveUtc − offset
  return new Date(naiveUtc.getTime() - offsetMs).toISOString();
}
