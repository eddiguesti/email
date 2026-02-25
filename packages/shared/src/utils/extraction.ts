/**
 * Signal Extraction Utilities
 * Extracts RG numbers, entities, dates, and other signals from email content
 */

import type { Entity, EntityType, ExtractedSignals } from '../types/processing.js';

// ============= RG Number Patterns =============

/**
 * Belgian RG (Rôle Général) number patterns
 * Common formats:
 * - RG 2023/1234/A
 * - R.G. 2023/1234
 * - 2023/RG/1234
 * - AR 2023/1234 (Appel)
 */
const RG_PATTERNS = [
  /\b(?:R\.?G\.?|RG)\s*[:\s]?\s*(\d{4})[\/\-](\d+)(?:[\/\-]([A-Z]+))?\b/gi,
  /\b(\d{4})[\/\-](?:R\.?G\.?|RG)[\/\-](\d+)\b/gi,
  /\b(?:A\.?R\.?|AR)\s*[:\s]?\s*(\d{4})[\/\-](\d+)(?:[\/\-]([A-Z]+))?\b/gi,
  /\b(?:REP|Rep\.?)\s*[:\s]?\s*(\d{4})[\/\-](\d+)\b/gi,
];

/**
 * Extract RG numbers from text
 */
export function extractRgNumbers(text: string): string[] {
  const rgNumbers = new Set<string>();

  for (const pattern of RG_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      // Normalize the RG number format
      const normalized = normalizeRgNumber(match[0]);
      if (normalized) {
        rgNumbers.add(normalized);
      }
    }
  }

  return Array.from(rgNumbers);
}

/**
 * Normalize RG number to standard format: RG YYYY/NNNNN
 */
function normalizeRgNumber(rg: string): string | null {
  // Remove extra whitespace and normalize separators
  const cleaned = rg.replace(/\s+/g, ' ').trim().toUpperCase();

  // Try to extract year and number
  const yearMatch = cleaned.match(/(\d{4})/);
  const numberMatch = cleaned.match(/\/(\d+)/);

  if (yearMatch && numberMatch) {
    return `RG ${yearMatch[1]}/${numberMatch[1]}`;
  }

  return cleaned;
}

// ============= Entity Extraction =============

/**
 * Simple entity extraction using patterns
 * For production, consider using a proper NER library or service
 */
export function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // Extract dates
  entities.push(...extractDates(text));

  // Extract money amounts
  entities.push(...extractMoney(text));

  // Extract case numbers (besides RG)
  entities.push(...extractCaseNumbers(text));

  // Extract potential names (very basic - improve with NER)
  entities.push(...extractPotentialNames(text));

  return entities;
}

/**
 * Extract dates from text
 */
function extractDates(text: string): Entity[] {
  const entities: Entity[] = [];

  // European date format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const euroDatePattern = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g;
  const matches = text.matchAll(euroDatePattern);

  for (const match of matches) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    // Validate date
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      entities.push({
        type: 'DATE',
        value: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        confidence: 0.8,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  // ISO format: YYYY-MM-DD
  const isoDatePattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const isoMatches = text.matchAll(isoDatePattern);

  for (const match of isoMatches) {
    entities.push({
      type: 'DATE',
      value: match[0],
      confidence: 0.9,
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return entities;
}

/**
 * Extract money amounts
 */
function extractMoney(text: string): Entity[] {
  const entities: Entity[] = [];

  // Euro amounts: €1,234.56 or 1.234,56 EUR or 1234,56€
  const euroPattern = /(?:€\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR|euros?)\b/gi;
  const matches = text.matchAll(euroPattern);

  for (const match of matches) {
    entities.push({
      type: 'MONEY',
      value: match[0].trim(),
      confidence: 0.85,
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return entities;
}

/**
 * Extract case numbers (various formats)
 */
function extractCaseNumbers(text: string): Entity[] {
  const entities: Entity[] = [];

  // Generic case number patterns
  const patterns = [
    /\b(?:Dossier|dossier|Ref|REF|Référence)\s*[:\s]?\s*([A-Z0-9\-\/]+)\b/gi,
    /\b(?:Affaire|affaire)\s*[:\s]?\s*([A-Z0-9\-\/]+)\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        type: 'CASE_NUMBER',
        value: match[1],
        confidence: 0.7,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  return entities;
}

/**
 * Extract potential names (basic pattern matching)
 * For production, use a proper NER service
 */
function extractPotentialNames(text: string): Entity[] {
  const entities: Entity[] = [];

  // Look for "Maître/Me/M./Mme" followed by capitalized words
  const titlePattern = /\b(?:Ma[îi]tre|Me|M\.|Mme|Mr\.?)\s+([A-Z][a-zéèêëàâôûùïîç]+(?:\s+[A-Z][a-zéèêëàâôûùïîç]+)*)\b/g;
  const matches = text.matchAll(titlePattern);

  for (const match of matches) {
    entities.push({
      type: 'PERSON',
      value: match[1],
      confidence: 0.6,
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return entities;
}

// ============= Email Analysis =============

/**
 * Check if email is a reply (Re:) or forward (Fwd:)
 */
export function analyzeEmailType(subject: string): { isReply: boolean; isForward: boolean } {
  const lowerSubject = subject.toLowerCase().trim();

  return {
    isReply: /^re\s*:/i.test(lowerSubject) || /^aw\s*:/i.test(lowerSubject),
    isForward: /^fwd?\s*:/i.test(lowerSubject) || /^tr\s*:/i.test(lowerSubject),
  };
}

/**
 * Extract the clean subject (without Re:/Fwd: prefixes)
 */
export function cleanSubject(subject: string): string {
  return subject
    .replace(/^(?:re|aw|fwd?|tr)\s*:\s*/gi, '')
    .replace(/^(?:re|aw|fwd?|tr)\s*:\s*/gi, '') // Handle multiple prefixes
    .trim();
}

/**
 * Remove quoted text from email body (basic)
 */
export function removeQuotedText(body: string, contentType: 'text' | 'html'): string {
  if (contentType === 'html') {
    // Remove common quote patterns in HTML
    let cleaned = body
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<div class="gmail_quote"[^>]*>[\s\S]*$/gi, '')
      .replace(/<div id="appendonsend"[^>]*>[\s\S]*$/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    return cleaned;
  }

  // Plain text: remove lines starting with >
  const lines = body.split('\n');
  const cleanedLines = lines.filter((line) => !line.trim().startsWith('>'));

  // Also remove "On X wrote:" patterns and everything after
  const text = cleanedLines.join('\n');
  const onWroteMatch = text.match(/\n\s*On .+wrote:\s*$/im);

  if (onWroteMatch && onWroteMatch.index !== undefined) {
    return text.slice(0, onWroteMatch.index).trim();
  }

  return text.trim();
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
}

// ============= Full Signal Extraction =============

/**
 * Extract all signals from an email
 */
export function extractSignals(
  subject: string,
  body: string,
  bodyContentType: 'text' | 'html',
  senderEmail: string,
  recipientEmails: string[],
  bodyHash: string,
  attachmentCount: number
): ExtractedSignals {
  // Clean the body
  const cleanedBody = removeQuotedText(body, bodyContentType);

  // Combine subject and body for extraction
  const fullText = `${subject}\n${cleanedBody}`;

  // Extract RG numbers
  const rgNumbers = extractRgNumbers(fullText);

  // Extract entities
  const entities = extractEntities(fullText);

  // Extract dates from entities
  const dates = entities.filter((e) => e.type === 'DATE').map((e) => e.value);

  // Analyze email type
  const { isReply, isForward } = analyzeEmailType(subject);

  return {
    rgNumbers,
    entities,
    dates,
    senderDomain: extractDomain(senderEmail),
    senderEmail: senderEmail.toLowerCase(),
    recipientEmails: recipientEmails.map((e) => e.toLowerCase()),
    subject: cleanSubject(subject),
    bodyPreview: cleanedBody.slice(0, 500),
    bodyHash,
    hasAttachments: attachmentCount > 0,
    attachmentCount,
    isReply,
    isForward,
    threadPosition: isReply || isForward ? 1 : 0, // Will be refined by conversation analysis
  };
}

// ============= PDF Text Extraction =============

/**
 * Extract text from PDF buffer
 * Note: This is a simple extraction. For scanned PDFs, OCR would be needed.
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; needsOcr: boolean }> {
  try {
    // Dynamic import to handle optional dependency
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);

    const text = data.text.trim();

    // If very little text extracted, likely a scanned document
    const needsOcr = text.length < 100 && data.numpages > 0;

    return { text, needsOcr };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return { text: '', needsOcr: true };
  }
}

/**
 * Check if content type is a PDF
 */
export function isPdf(contentType: string, filename: string): boolean {
  return (
    contentType === 'application/pdf' ||
    contentType === 'application/x-pdf' ||
    filename.toLowerCase().endsWith('.pdf')
  );
}
