/**
 * Name Matching Utilities
 * Fuzzy and exact name matching for party/sender resolution.
 */

import { NAME_BLOCKLIST, COMMON_WORDS } from './constants.js';

export function normalize(s: string): string {
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

export function isBlockedName(name: string): boolean {
  const n = normalize(name);
  if (NAME_BLOCKLIST.has(n)) return true;
  if (n.length < 4) return true;
  // Block if it's just a first name (single word, < 8 chars)
  if (!n.includes(' ') && n.length < 8 && /^[A-ZÉÈÊËÀÂÔÛÙÏÎÇ]+$/.test(n)) return true;
  return false;
}

/**
 * Fuzzy name match: does name A match name B via substring or surname comparison?
 * - Exact match after normalization
 * - Substring match if shorter is >= 70% of longer and at a word boundary
 * - Surname match if last words match and are > 6 chars (not in COMMON_WORDS)
 */
export function fuzzyNameMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;

  // Strip common legal suffixes
  const stripSuffix = (s: string) => s
    .replace(/\s+(?:ET AUTRES|ET AL|ET CIE|& AUTRES)$/i, '')
    .replace(/\s*\((?:SAS|SARL|SA|SCI|EURL|SASU|SCP|SELARL|SCCV)\)\s*$/i, '')
    .trim();
  const cleanA = stripSuffix(na);
  const cleanB = stripSuffix(nb);
  if (cleanA === cleanB && cleanA.length > 4) return true;

  // Substring match
  if (cleanA.length > 4 && cleanB.length > 4) {
    const shorter = cleanA.length < cleanB.length ? cleanA : cleanB;
    const longer = cleanA.length < cleanB.length ? cleanB : cleanA;
    if (shorter.length / longer.length >= 0.7) {
      const idx = longer.indexOf(shorter);
      if (idx >= 0 && (idx === 0 || longer[idx - 1] === ' ')) return true;
    }
  }

  // Surname match: both names must have 2+ words, last word > 6 chars, not common
  const wordsA = na.split(' ').filter(w => w.length > 1);
  const wordsB = nb.split(' ').filter(w => w.length > 1);
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    const lastA = wordsA[wordsA.length - 1];
    const lastB = wordsB[wordsB.length - 1];
    if (lastA.length > 6 && lastB.length > 6 && lastA === lastB && !COMMON_WORDS.has(lastA)) return true;
  }

  return false;
}
