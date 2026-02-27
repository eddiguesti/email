/**
 * Meeting Intent Detector
 *
 * Analyzes email metadata (from, subject, body snippet) to detect whether the
 * email contains a real appointment/meeting that should be added to the calendar.
 *
 * Design goals:
 * - Never stores raw email body — only receives a short snippet (≤ 1000 chars)
 * - Layered: sales/junk guard → deterministic date+time parsing → keyword cues
 * - Always assumes Europe/Paris timezone unless explicit
 * - Returns null for any ambiguous or low-confidence case unless caller opts in
 *
 * PRIVACY: This module must receive only pre-truncated body snippets.
 *          Never pass full email bodies.
 */

import type { MeetingIntent } from '../types/calendar.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Meeting-intent keyword patterns (French + common legal terms) */
const MEETING_KEYWORDS = [
  /\baudience\b/i,
  /\brdv\b/i,
  /\brendez[- ]vous\b/i,
  /\bréunion\b/i,
  /\bconvocation\b/i,
  /\bexpertise\b/i,
  /\bvisio[-\s]?conférence\b/i,
  /\bconférence\b/i,
  /\bteams\b/i,
  /\bzoom\b/i,
  /\bwebex\b/i,
  /\ben salle\b/i,
  /\btribunal\b/i,
  /\bmédiation\b/i,
  /\bconciliation\b/i,
  /\bplaidoirie\b/i,
  /\baudition\b/i,
  /\breunion\b/i,
  /\bmeeting\b/i,
  /\bappel\s+(?:téléphonique|de\s+conférence)\b/i,
  /\bentretien\b/i,
  /\bconsultation\b/i,
  /\bséance\b/i,
  /\brencontre\b/i,
];

/** Junk/sales keywords that prevent suggestion creation even when dates are present */
const JUNK_KEYWORDS = [
  /newsletter/i,
  /unsubscribe/i,
  /désabonner/i,
  /désinscri/i,
  /se désinscrire/i,
  /\bpromo\b/i,
  /offre spéciale/i,
  /offre exclusive/i,
  /code promo/i,
  /-\s*\d{1,2}\s*%/,                // -20%, -50% etc.
  /\d{1,2}\s*%\s*(?:de réduction|off)/i,
  /webinar\s+marketing/i,
  /marketing\s+webinar/i,
  /\bdiscount\b/i,
  /\bsale\b.*\boff\b/i,
  /black friday/i,
  /soldes/i,
  /vente privée/i,
  /fidélité/i,
  /cadeau/i,
  /essai gratuit/i,
];

/** Known bulk-sender local-part patterns (additional guard beyond skip-filter) */
const BULK_SENDER_PATTERNS = [
  /^(?:news|newsletter|promo|marketing|communication|campaigns?|noreply|no-reply|donotreply|bulk|mass)$/i,
];

// ─── Date/Time Regex Patterns ─────────────────────────────────────────────────

const FR_MONTHS: Record<string, number> = {
  janvier:0, février:1, mars:2, avril:3, mai:4, juin:5,
  juillet:6, août:7, septembre:8, octobre:9, novembre:10, décembre:11,
};

/**
 * French and ISO date patterns.
 * All dates are constructed as UTC midnight to avoid server-timezone drift.
 */
const DATE_PATTERNS = [
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  {
    re: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g,
    parse: (m: RegExpMatchArray) => new Date(
      Date.UTC(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    ),
  },
  // YYYY-MM-DD (ISO)
  {
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    parse: (m: RegExpMatchArray) => new Date(
      Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    ),
  },
  // French long form: "le 12 mars 2026", "12 mars 2026"
  {
    re: /\b(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})\b/gi,
    parse: (m: RegExpMatchArray) => new Date(
      Date.UTC(parseInt(m[3]), FR_MONTHS[m[2].toLowerCase()] ?? 0, parseInt(m[1]))
    ),
  },
  // Short form without year: "le 12 mars" → assume next occurrence
  {
    re: /\b(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi,
    parse: (m: RegExpMatchArray) => {
      const now = new Date();
      const d = new Date(Date.UTC(now.getUTCFullYear(), FR_MONTHS[m[2].toLowerCase()] ?? 0, parseInt(m[1])));
      if (d < now) d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    },
  },
];

/** Named time keywords → fixed clock values (Europe/Paris assumed) */
const NAMED_TIMES: Record<string, { hours: number; minutes: number }> = {
  midi:   { hours: 12, minutes: 0 },
  minuit: { hours: 0,  minutes: 0 },
};

/**
 * Single-time extraction patterns — tried in order, first match wins.
 * Covers: 14h30 · 14H30 · 14:30 · 14h · 9h00 · 14 heures · 14 HEURES 30
 *         · 14 heure · 14 h · midi · minuit
 */
const SINGLE_TIME_PATTERNS: Array<{
  re: RegExp;
  parse: (m: RegExpMatchArray) => { hours: number; minutes: number };
}> = [
  // 14h30 / 14H30 / 14:30 / 14h / 9h00
  { re: /\b(\d{1,2})[hH:](\d{2})?\b/g,
    parse: m => ({ hours: parseInt(m[1]), minutes: parseInt(m[2] || '0') }) },
  // "14 heures 30" / "14 HEURES" / "9 heure"
  { re: /\b(\d{1,2})\s+heures?\s*(\d{2})?\b/gi,
    parse: m => ({ hours: parseInt(m[1]), minutes: parseInt(m[2] || '0') }) },
  // "14 h" (space before isolated h)
  { re: /\b(\d{1,2})\s+h\b/gi,
    parse: m => ({ hours: parseInt(m[1]), minutes: 0 }) },
  // "midi" / "minuit"
  { re: /\b(midi|minuit)\b/gi,
    parse: m => NAMED_TIMES[m[1].toLowerCase()] ?? { hours: 12, minutes: 0 } },
];

/**
 * Time-range extraction patterns — tried in order, first match wins.
 * Covers: 14h–16h · 14:30 à 16:30 · 14 heures à 16 heures · 9h à midi
 */
const TIME_RANGE_PATTERNS: Array<{
  re: RegExp;
  parse: (m: RegExpMatchArray) => { startH: number; startM: number; endH: number; endM: number };
}> = [
  // "14h30 - 16h00" / "14:30 à 16:30" / "9h–17h"
  { re: /\b(\d{1,2})[hH:](\d{2})?\s*[-à–]\s*(\d{1,2})[hH:](\d{2})?\b/g,
    parse: m => ({ startH: parseInt(m[1]), startM: parseInt(m[2] || '0'), endH: parseInt(m[3]), endM: parseInt(m[4] || '0') }) },
  // "14 heures à 16 heures 30" / "9 heures - 17 heures"
  { re: /\b(\d{1,2})\s+heures?\s*(\d{2})?\s*[-à–]\s*(\d{1,2})\s+heures?\s*(\d{2})?\b/gi,
    parse: m => ({ startH: parseInt(m[1]), startM: parseInt(m[2] || '0'), endH: parseInt(m[3]), endM: parseInt(m[4] || '0') }) },
  // "midi à 14h" / "minuit à 1h"
  { re: /\b(midi|minuit)\s*[-à–]\s*(\d{1,2})[hH:](\d{2})?\b/gi,
    parse: m => { const s = NAMED_TIMES[m[1].toLowerCase()]!; return { startH: s.hours, startM: s.minutes, endH: parseInt(m[2]), endM: parseInt(m[3] || '0') }; } },
  // "9h à midi" / "11h à minuit"
  { re: /\b(\d{1,2})[hH:](\d{2})?\s*[-à–]\s*(midi|minuit)\b/gi,
    parse: m => { const e = NAMED_TIMES[m[3].toLowerCase()]!; return { startH: parseInt(m[1]), startM: parseInt(m[2] || '0'), endH: e.hours, endM: e.minutes }; } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PARIS_TZ = 'Europe/Paris';

/**
 * Given a UTC-midnight date and a clock time expressed in Europe/Paris,
 * returns the corresponding UTC instant.
 *
 * e.g. date = 2026-03-15T00:00Z, hours = 14, minutes = 30
 *      → returns 2026-03-15T13:30Z  (Paris is UTC+1 in winter)
 *
 * Uses the Intl offset trick (same as fromDatetimeLocal in calendar-utils)
 * so it handles DST correctly.
 */
function applyParisTime(date: Date, hours: number, minutes: number): Date {
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const d = date.getUTCDate();
  // Treat (y, mo, d, hours, minutes) as UTC naively
  const naiveUtc = new Date(Date.UTC(y, mo, d, hours, minutes));
  // Ask Intl what Paris shows for that naive UTC moment
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(naiveUtc);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0');
  const parisOfNaive = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  // offsetMs = how far Paris is ahead of UTC at this instant (e.g. +3 600 000 for UTC+1)
  const offsetMs = parisOfNaive - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}

function extractFirstDate(text: string): Date | null {
  for (const { re, parse } of DATE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const d = parse(m);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extractFirstTime(text: string): { hours: number; minutes: number } | null {
  for (const { re, parse } of SINGLE_TIME_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const t = parse(m);
      if (t.hours >= 0 && t.hours <= 23 && t.minutes >= 0 && t.minutes <= 59) return t;
    }
  }
  return null;
}

function extractTimeRange(
  text: string
): { startH: number; startM: number; endH: number; endM: number } | null {
  for (const { re, parse } of TIME_RANGE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const r = parse(m);
      if (r.startH >= 0 && r.startH <= 23 && r.endH >= 0 && r.endH <= 23) return r;
    }
  }
  return null;
}

function extractEvidence(subject: string, bodySnippet: string, maxLen = 500): string {
  // Prefer subject, then first relevant line of body
  const combined = `${subject}\n${bodySnippet}`.slice(0, maxLen * 2);
  // Find line with a date or meeting keyword
  const lines = combined.split(/\n+/);
  const keyLines = lines.filter(l =>
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]?\d{0,4}|\b(?:audience|rdv|rendez-vous|réunion|convocation|tribunal|médiation|teams|zoom)\b/i.test(l)
  );
  const snippets = keyLines.slice(0, 3).join(' — ');
  return snippets.slice(0, maxLen) || combined.slice(0, maxLen);
}

function buildTitle(subject: string): string {
  // Remove common prefixes
  return subject
    .replace(/^(?:re|fw|tr|fwd|réponse|transfert)\s*:\s*/i, '')
    .trim()
    .slice(0, 120);
}

// ─── Main Detector ────────────────────────────────────────────────────────────

/**
 * Detect whether an email has a meeting/appointment intent.
 *
 * @param from          Sender email address (e.g. "user@domain.fr")
 * @param subject       Email subject line
 * @param bodySnippet   First ≤1000 characters of the plain-text body (no raw HTML)
 * @returns MeetingIntent if a suggestion should be created, null otherwise
 */
export function detectMeetingIntent(
  from: string,
  subject: string,
  bodySnippet: string,
): MeetingIntent | null {
  const text = `${subject} ${bodySnippet}`;

  // ── Guard 1: Bulk sender heuristics (additional to the main skip-filter) ──
  const localPart = from.split('@')[0].toLowerCase();
  for (const pattern of BULK_SENDER_PATTERNS) {
    if (pattern.test(localPart)) return null;
  }

  // ── Guard 2: Junk/sales content in subject or body ────────────────────────
  for (const re of JUNK_KEYWORDS) {
    if (re.test(text)) return null;
  }

  // ── Step 1: Extract date ──────────────────────────────────────────────────
  const date = extractFirstDate(text);
  if (!date) return null; // No parseable date → no suggestion

  // ── Step 2: Extract time (range preferred, single fallback) ───────────────
  const timeRange = extractTimeRange(text);
  const singleTime = timeRange ? null : extractFirstTime(text);

  // ── Step 3: Build start/end datetimes ────────────────────────────────────
  let startAt: Date;
  let endAt: Date | undefined;

  if (timeRange) {
    startAt = applyParisTime(date, timeRange.startH, timeRange.startM);
    endAt   = applyParisTime(date, timeRange.endH,   timeRange.endM);
    // If end < start, it means it crosses midnight (rare) — just add 1h
    if (endAt <= startAt) endAt = new Date(startAt.getTime() + 3600_000);
  } else if (singleTime) {
    startAt = applyParisTime(date, singleTime.hours, singleTime.minutes);
    // Default 1-hour duration
    endAt = new Date(startAt.getTime() + 3600_000);
  } else {
    // Date found but no time → all-day style, low confidence; default 09:00 Paris
    startAt = applyParisTime(date, 9, 0);
    endAt   = new Date(startAt.getTime() + 3600_000);
  }

  // ── Step 4: Keyword scoring ───────────────────────────────────────────────
  const matchedKeywords: string[] = [];
  for (const re of MEETING_KEYWORDS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      matchedKeywords.push(m[0].toLowerCase());
    }
  }

  // ── Step 5: Confidence scoring ────────────────────────────────────────────
  let confidence = 0.35; // Base: date found

  if (singleTime || timeRange) confidence += 0.25; // Time found
  if (timeRange) confidence += 0.05;                // Range is stronger signal
  if (matchedKeywords.length > 0) confidence += 0.20; // Meeting keyword
  if (matchedKeywords.length > 1) confidence += 0.10; // Multiple keywords
  if (/\b(?:objet|sujet)\s*:/i.test(text)) confidence += 0.05; // Formal email
  if (/\bconfirmez?\b|\bconfirmation\b/i.test(text)) confidence += 0.05; // Confirmation language

  // Reduce confidence for events more than 24h in the past (user processing old mail)
  const now = new Date();
  if (startAt < new Date(now.getTime() - 24 * 3600_000)) {
    confidence -= 0.15;
  }

  // Clamp
  confidence = Math.min(1, Math.max(0.30, confidence));

  // Require at least some keyword evidence OR high time specificity
  const hasKeyword = matchedKeywords.length > 0;
  const hasExplicitTime = !!(singleTime || timeRange);
  if (!hasKeyword && !hasExplicitTime) return null;
  if (!hasKeyword && confidence < 0.55) return null;

  // ── Step 6: Extract location (simple heuristic) ───────────────────────────
  let location: string | undefined;
  const locMatch = text.match(
    /\b(?:en salle|salle|tribunal(?:\s+\w+)?|palais\s+de\s+justice|\d+[,\s]+(?:rue|avenue|boulevard|allée)[^,\n]{0,60})\b/i
  );
  if (locMatch) location = locMatch[0].trim().slice(0, 120);

  // ── Step 7: Build evidence snippet ───────────────────────────────────────
  const evidence = extractEvidence(subject, bodySnippet);

  // ── Step 8: Name detected patterns ───────────────────────────────────────
  const detectedPatterns: string[] = [];
  if (date) detectedPatterns.push('date_pattern');
  if (timeRange) detectedPatterns.push('time_range');
  else if (singleTime) detectedPatterns.push('time_single');
  if (matchedKeywords.length > 0) detectedPatterns.push('meeting_keyword');
  if (location) detectedPatterns.push('location');

  return {
    title: buildTitle(subject),
    startAt,
    endAt,
    location,
    confidence,
    evidence,
    detectedPatterns,
  };
}
