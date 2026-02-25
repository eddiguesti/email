/**
 * Skip Filter
 * Determines if an email should be skipped (spam, newsletters, system notifications).
 */

import { SKIP_SENDERS, SKIP_DOMAINS } from './constants.js';
import type { EBarreauData } from './types.js';

/**
 * Check if an email should be skipped entirely (not worth processing).
 */
export function shouldSkipEmail(from: string, subject: string): boolean {
  const localPart = from.split('@')[0].toLowerCase();
  if (SKIP_SENDERS.has(localPart)) return true;

  // Skip delivery/read receipts
  if (/^(?:remis|lu|gelezen|delivered|read)\s*:/i.test(subject)) return true;

  // Skip known newsletter/marketing domains (exact match)
  const domain = from.split('@')[1]?.toLowerCase() || '';
  if (SKIP_DOMAINS.has(domain)) return true;

  // Also check parent domain for subdomains (e.g., "news@nl.ipharm.fr" → "ipharm.fr")
  const domainParts = domain.split('.');
  if (domainParts.length > 2) {
    const parentDomain = domainParts.slice(-2).join('.');
    if (SKIP_DOMAINS.has(parentDomain)) return true;
  }

  // Skip generic newsletter subjects
  if (/newsletter|unsubscribe|désabonner|désinscri/i.test(subject)) return true;

  // Skip ACH/payment processing spam
  if (/\bACH\s+(?:Copy|Deposit|Payment)\b/i.test(subject)) return true;

  // Skip obvious marketing patterns
  if (/(?:% de réduction|offre spéciale|offre exclusive|code promo)/i.test(subject)) return true;

  // Skip common promotional sender local parts (unless from legal/court entities)
  if (/^(?:news|newsletter|info|contact|hello|promo|marketing|communication|noreply|no-reply)$/i.test(localPart)) {
    if (!domain.endsWith('.gouv.fr') && !domain.endsWith('.justice.fr') && !domain.includes('avocat') && !domain.includes('barreau')) {
      return true;
    }
  }

  // Skip marketing emails with promotional patterns
  if (/(?:last\s+chance|saint[- ]valentin|black\s+friday|soldes|vente\s+privée|livraison\s+gratuite)/i.test(subject)) return true;
  if (/(?:fidélité|chèque\s+fidélité|points?\s+de\s+fidélité|carte\s+cadeau)/i.test(subject)) return true;
  if (/(?:mois\s+offerts|essai\s+gratuit|découvrez\s+nos\s+offres)/i.test(subject)) return true;

  // Skip recruitment/hiring marketing
  if (/(?:recrutez|recrutement\s+de\s+profils|candidat(?:e|ure)|apprentissage)/i.test(subject) && !domain.includes('avocat') && !domain.includes('barreau')) return true;

  // Skip telecom/utility invoices (not legal)
  if (/(?:votre\s+facture\s+(?:orange|sfr|free|bouygues|sosh)|facture\s+est\s+(?:disponible|en\s+ligne))/i.test(subject)) return true;

  // Skip e-Barreau procedural acknowledgments (no useful case info)
  if (/e-?barreau.*avis\s+de\s+r[ée]ception/i.test(subject)) return true;
  if (/e-?barreau.*#\d+[A-Z]?#/i.test(subject)) return true;

  return false;
}

/**
 * Parse e-Barreau (RPVA) structured messages.
 * Extracts parties, RG numbers, and message type codes.
 */
export function parseEBarreau(subject: string, bodyText: string): EBarreauData {
  const result: EBarreauData = { isEBarreau: false, parties: [], rgNumbers: [], messageType: '' };

  // Detect e-Barreau source
  if (!/e-?barreau|eBarreau|avocat-conseil\.fr|rpva/i.test(subject + bodyText.slice(0, 500))) {
    return result;
  }
  result.isEBarreau = true;

  // Extract parties from "Parties : X / Y / Z" pattern
  const partiesMatch = subject.match(/Parties?\s*:\s*(.+?)(?:\s*-\s*(?:Incident|Re\s*:)|$)/i)
    || bodyText.match(/Parties?\s*:\s*(.+?)(?:\n|<|$)/i);
  if (partiesMatch) {
    let partiesStr = partiesMatch[1];
    partiesStr = partiesStr.replace(/\s*\[.*$/, '').replace(/\s*<[A-Z]+>.*$/, '').replace(/\s+\d{2}\/\d{2}\/\d{4}.*$/, '');
    const partyList = partiesStr.split(/\s*\/\s*/).map(p => p.trim()).filter(p => p.length > 2).slice(0, 4);
    for (const p of partyList) {
      const cleaned = p
        .replace(/^(?:S\.?A\.?S\.?|S\.?A\.?|S\.?C\.?I\.?|S\.?A\.?R\.?L\.?|S\.?C\.?P\.?|E\.?U\.?R\.?L\.?|S\.?A\.?S\.?U\.?|S\.?E\.?L\.?A\.?R\.?L\.?)\s+/i, '')
        .replace(/^(?:Société|Ste|Mme|Monsieur|Madame|M\.)\s+/i, '')
        .trim();
      if (cleaned.length > 2) {
        result.parties.push(cleaned);
      }
    }
  }

  // Extract message type code from <CDEF>, <CIN>, <CONC>, etc.
  const typeMatch = subject.match(/<([A-Z]{2,6})>/);
  if (typeMatch) {
    result.messageType = typeMatch[1];
  }

  // Extract RG from bracket format [YY/NNNNN]
  const rgMatches = subject.matchAll(/\[(\d{2})[\/\-](\d{4,6})\]/g);
  for (const m of rgMatches) {
    result.rgNumbers.push(`RG ${m[1]}/${m[2]}`);
  }

  return result;
}

/**
 * Check if e-Barreau parties are meaningful (not just M.E.E. or acks).
 */
export function hasSignificantEBarreauParties(eBarreau: EBarreauData): boolean {
  const meaningful = eBarreau.parties.filter(p =>
    !/^M\.?E\.?E\.?$/i.test(p.trim()) &&
    !/^Avis\s+de\s+r[ée]ception/i.test(p.trim()) &&
    !/^Re\s*:/i.test(p.trim()) &&
    p.trim().length > 5
  );
  return meaningful.length > 0;
}

/**
 * Get the meaningful parties from e-Barreau data (filtering out M.E.E. noise).
 */
export function getMeaningfulEBarreauParties(eBarreau: EBarreauData): string[] {
  return eBarreau.parties.filter(p =>
    !/^M\.?E\.?E\.?$/i.test(p.trim()) &&
    !/^Avis\s+de\s+r[ée]ception/i.test(p.trim()) &&
    !/^Re\s*:/i.test(p.trim()) &&
    p.trim().length > 5
  );
}
