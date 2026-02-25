/**
 * Reply Draft Template
 * Safe template for generating reply emails
 */

import { sanitizeForPrompt, sanitizeHtml } from '../utils/sanitization.js';

export interface ReplyTemplateParams {
  originalSender: string;
  originalSubject: string;
  dossierRef?: string;
  dossierName?: string;
  clientName?: string;
  lawyerName: string;
  lawyerTitle?: string;
  firmName: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  customContent?: string;
  language?: 'fr' | 'nl' | 'en';
}

const GREETINGS = {
  fr: {
    formal: 'Cher Maître',
    client: 'Cher client',
    general: 'Madame, Monsieur',
  },
  nl: {
    formal: 'Geachte Meester',
    client: 'Geachte cliënt',
    general: 'Geachte heer/mevrouw',
  },
  en: {
    formal: 'Dear Counsel',
    client: 'Dear Client',
    general: 'Dear Sir/Madam',
  },
};

const CLOSINGS = {
  fr: 'Veuillez agréer, Maître, l\'expression de mes salutations distinguées.',
  nl: 'Met vriendelijke groeten,',
  en: 'Kind regards,',
};

const REFERENCES = {
  fr: 'Référence',
  nl: 'Referentie',
  en: 'Reference',
};

/**
 * Generate a reply draft template
 */
export function generateReplyTemplate(params: ReplyTemplateParams): {
  subject: string;
  body: string;
  bodyHtml: string;
} {
  const lang = params.language || 'fr';
  const greeting = GREETINGS[lang].general;
  const closing = CLOSINGS[lang];
  const refLabel = REFERENCES[lang];

  // Build reference line
  const refLine = params.dossierRef
    ? `${refLabel}: ${sanitizeForPrompt(params.dossierRef)}${params.dossierName ? ` - ${sanitizeForPrompt(params.dossierName)}` : ''}`
    : '';

  // Subject (clean Re: prefix handling)
  const subject = params.originalSubject.toLowerCase().startsWith('re:')
    ? params.originalSubject
    : `Re: ${params.originalSubject}`;

  // Build body
  const bodyParts: string[] = [];

  if (refLine) {
    bodyParts.push(refLine);
    bodyParts.push('');
  }

  bodyParts.push(greeting + ',');
  bodyParts.push('');

  if (params.customContent) {
    bodyParts.push(sanitizeForPrompt(params.customContent));
    bodyParts.push('');
  } else {
    bodyParts.push('[Votre message ici / Your message here]');
    bodyParts.push('');
  }

  bodyParts.push(closing);
  bodyParts.push('');
  bodyParts.push(buildSignature(params));

  const body = bodyParts.join('\n');

  // HTML version
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; }
    .reference { color: #666; font-size: 12px; margin-bottom: 16px; }
    .signature { margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
    .signature-name { font-weight: bold; }
    .signature-firm { color: #666; }
  </style>
</head>
<body>
  ${refLine ? `<p class="reference">${sanitizeHtml(refLine)}</p>` : ''}
  <p>${sanitizeHtml(greeting)},</p>
  ${params.customContent
    ? `<p>${sanitizeHtml(params.customContent)}</p>`
    : '<p>[Votre message ici / Your message here]</p>'}
  <p>${sanitizeHtml(closing)}</p>
  ${buildSignatureHtml(params)}
</body>
</html>
  `.trim();

  return { subject, body, bodyHtml };
}

function buildSignature(params: ReplyTemplateParams): string {
  const lines: string[] = [];

  if (params.lawyerTitle) {
    lines.push(`${params.lawyerTitle} ${params.lawyerName}`);
  } else {
    lines.push(params.lawyerName);
  }

  lines.push(params.firmName);

  if (params.firmAddress) {
    lines.push(params.firmAddress);
  }

  if (params.firmPhone) {
    lines.push(`Tel: ${params.firmPhone}`);
  }

  if (params.firmEmail) {
    lines.push(params.firmEmail);
  }

  return lines.join('\n');
}

function buildSignatureHtml(params: ReplyTemplateParams): string {
  return `
<div class="signature">
  <p class="signature-name">${params.lawyerTitle ? sanitizeHtml(params.lawyerTitle) + ' ' : ''}${sanitizeHtml(params.lawyerName)}</p>
  <p class="signature-firm">${sanitizeHtml(params.firmName)}</p>
  ${params.firmAddress ? `<p>${sanitizeHtml(params.firmAddress)}</p>` : ''}
  ${params.firmPhone ? `<p>Tel: ${sanitizeHtml(params.firmPhone)}</p>` : ''}
  ${params.firmEmail ? `<p>${sanitizeHtml(params.firmEmail)}</p>` : ''}
</div>
  `.trim();
}
