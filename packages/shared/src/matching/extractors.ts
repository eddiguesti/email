/**
 * Signal Extractors
 * Extract RG numbers, dossier references, entities, and other signals from email content.
 */

import type { KnowledgeBase } from './types.js';

// ============= RG Number Patterns =============

const RG_PATTERNS = [
  // Standard format: "RG 2024/57171" or "RG 24/57171" (2 or 4 digit year)
  /\b(?:R\.?G\.?|RG)\s*[:\s]?\s*(\d{2}|\d{4})[\/\-](\d+)(?:[\/\-]([A-Z]+))?\b/gi,
  // Reversed format: "2024/RG/57171"
  /\b(\d{2}|\d{4})[\/\-](?:R\.?G\.?|RG)[\/\-](\d+)\b/gi,
  // AR format: "AR 2024/57171" or "AR 24/57171"
  /\b(?:A\.?R\.?|AR)\s*[:\s]?\s*(\d{2}|\d{4})[\/\-](\d+)(?:[\/\-]([A-Z]+))?\b/gi,
  // REP format: "Rep 2024/57171"
  /\b(?:REP|Rep\.?)\s*[:\s]?\s*(\d{2}|\d{4})[\/\-](\d+)\b/gi,
  // RG followed by 7-8 digit number without separator (e.g., "RG 22100976")
  /\b(?:R\.?G\.?|RG)\s*[:\s]?\s*(\d{2})(\d{5,6})\b/gi,
  // Bracketed format from e-Barreau: [18/01527], [24/57171]
  /\[(\d{2})[\/\-](\d{4,6})\]/g,
  // "Incident" prefix from e-Barreau: Incident [18/01527]
  /\bIncident\s+\[?(\d{2})[\/\-](\d{4,6})\]?/gi,
  // "n°" prefix from court documents: "n° 19/56688", "n°24/57171"
  /\bn[°º]\s*(\d{2}|\d{4})[\/\-](\d{4,6})\b/gi,
];

// Also extract plain reference numbers that match KLEOS format (6-7 digits)
const REF_PATTERN = /\b(\d{6,7})\b/g;

export function extractRgNumbers(text: string): string[] {
  const results = new Set<string>();
  for (const pattern of RG_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[2]) {
        results.add(`RG ${match[1]}/${match[2]}`);
      }
    }
  }
  return Array.from(results);
}

export function extractDossierRefs(text: string, kb: KnowledgeBase): string[] {
  const refs = new Set<string>();
  REF_PATTERN.lastIndex = 0;
  let match;
  while ((match = REF_PATTERN.exec(text)) !== null) {
    const ref = match[1];
    if (kb.referenceToDossier[ref]) {
      refs.add(ref);
    }
  }
  return Array.from(refs);
}

// ============= Entity Extraction =============

const NAME_PATTERN = /\b(?:Ma[îi]tre|Me|M\.|Mme|Mr\.?|Monsieur|Madame)\s+([A-ZÉÈÊËÀÂÔÛÙÏÎÇ][a-zéèêëàâôûùïîç]+(?:\s+[A-ZÉÈÊËÀÂÔÛÙÏÎÇ][a-zéèêëàâôûùïîç]+)*)\b/g;
const ORG_PATTERNS = [
  /\b(?:SCI|SARL|SAS|SA|SELARL|SCP|EURL|SASU)\s+([A-Z][A-Za-zéèêëàâôûùïîç\s\-&]+)/gi,
  /\b(SMABTP|AXA|RIVP|MAIF|MACIF|MMA|ALLIANZ|GROUPAMA|GENERALI|AVIVA|ZURICH)\b/gi,
];

export interface SimpleEntity {
  type: string;
  value: string;
}

export function extractEntities(text: string): SimpleEntity[] {
  const entities: SimpleEntity[] = [];
  const seen = new Set<string>();

  // Persons — cap at 40 chars
  NAME_PATTERN.lastIndex = 0;
  let match;
  while ((match = NAME_PATTERN.exec(text)) !== null) {
    if (match[1] && match[1].length > 2 && match[1].length < 40) {
      const val = match[1].trim();
      const key = val.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({ type: 'PERSON', value: val });
      }
    }
  }

  // Organizations — cap at 50 chars
  for (const pattern of ORG_PATTERNS) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1] || match[0];
      if (raw && raw.length < 50) {
        const val = raw.trim().toUpperCase();
        if (!seen.has(val)) {
          seen.add(val);
          entities.push({ type: 'ORGANIZATION', value: val });
        }
      }
    }
  }

  return entities;
}

// ============= Email Analysis =============

export function analyzeEmail(subject: string) {
  const cleaned = subject
    .replace(/^(?:re|aw|fwd?|tr|remis|lu)\s*:\s*/gi, '')
    .replace(/^(?:affaire|objet)\s*:\s*/gi, '')
    .trim();
  return {
    isReply: /^re\s*:/i.test(subject) || /^aw\s*:/i.test(subject),
    isForward: /^fwd?\s*:/i.test(subject) || /^tr\s*:/i.test(subject),
    cleanSubject: cleaned,
  };
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripSignature(text: string): string {
  const sigMarkers = [
    /^[-_]{2,}\s*$/m,
    /^cordialement[,.]?\s*$/im,
    /^bien [àa] vous[,.]?\s*$/im,
    /^(?:sincères? )?salutations[,.]?\s*$/im,
    /^regards[,.]?\s*$/im,
    /^best(?:\s+regards)?[,.]?\s*$/im,
    /^(?:me|maître)\s+/im,
    /^(?:envoyé|sent)\s+(?:de|from)\s+/im,
    /^AVERTISSEMENT|^DISCLAIMER|^CONFIDENTIALIT[EÉ]/im,
    /^Ce (?:message|courriel|mail) est confidentiel/im,
    /^This (?:email|message) is confidential/im,
  ];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const marker of sigMarkers) {
      if (marker.test(lines[i].trim())) {
        return lines.slice(0, i).join('\n').trim();
      }
    }
  }
  return text;
}

export function sanitizeForLLM(text: string): string {
  return text
    .replace(/\b(system|assistant|user)\s*:/gi, '$1 -')
    .replace(/```/g, "'''")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 2000);
}
