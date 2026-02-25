/**
 * Client Transmittal Letter Template
 * For forwarding documents/correspondence to clients
 */

import { sanitizeForPrompt, sanitizeHtml } from '../utils/sanitization.js';

export interface ClientTransmittalParams {
  clientName: string;
  clientEmail: string;
  dossierRef: string;
  dossierName: string;
  documentDescription: string;
  attachmentNames: string[];
  lawyerName: string;
  lawyerTitle?: string;
  firmName: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  additionalNotes?: string;
  language?: 'fr' | 'nl' | 'en';
}

const TEMPLATES = {
  fr: {
    subject: (ref: string, desc: string) => `${ref} - Transmission de documents: ${desc}`,
    greeting: (name: string) => `Cher(e) ${name}`,
    intro: 'Veuillez trouver ci-joint, pour votre information, les documents suivants:',
    attachmentLabel: 'Documents joints:',
    notesLabel: 'Remarques:',
    actionRequired: 'N\'hésitez pas à nous contacter si vous avez des questions concernant ces documents.',
    closing: 'Bien cordialement,',
  },
  nl: {
    subject: (ref: string, desc: string) => `${ref} - Documentenoverdracht: ${desc}`,
    greeting: (name: string) => `Geachte ${name}`,
    intro: 'Hierbij vindt u ter informatie de volgende documenten:',
    attachmentLabel: 'Bijgevoegde documenten:',
    notesLabel: 'Opmerkingen:',
    actionRequired: 'Aarzel niet om contact met ons op te nemen indien u vragen heeft over deze documenten.',
    closing: 'Met vriendelijke groeten,',
  },
  en: {
    subject: (ref: string, desc: string) => `${ref} - Document Transmittal: ${desc}`,
    greeting: (name: string) => `Dear ${name}`,
    intro: 'Please find attached the following documents for your information:',
    attachmentLabel: 'Attached documents:',
    notesLabel: 'Notes:',
    actionRequired: 'Please do not hesitate to contact us if you have any questions regarding these documents.',
    closing: 'Kind regards,',
  },
};

/**
 * Generate a client transmittal letter
 */
export function generateClientTransmittal(params: ClientTransmittalParams): {
  subject: string;
  body: string;
  bodyHtml: string;
  to: string[];
} {
  const lang = params.language || 'fr';
  const t = TEMPLATES[lang];

  const subject = t.subject(
    sanitizeForPrompt(params.dossierRef),
    sanitizeForPrompt(params.documentDescription)
  );

  // Build body
  const bodyParts: string[] = [];

  // Reference line
  bodyParts.push(`Référence: ${params.dossierRef} - ${params.dossierName}`);
  bodyParts.push('');

  bodyParts.push(t.greeting(sanitizeForPrompt(params.clientName)) + ',');
  bodyParts.push('');

  bodyParts.push(t.intro);
  bodyParts.push('');

  // List attachments
  bodyParts.push(t.attachmentLabel);
  for (const attachment of params.attachmentNames) {
    bodyParts.push(`  • ${sanitizeForPrompt(attachment)}`);
  }
  bodyParts.push('');

  // Additional notes
  if (params.additionalNotes) {
    bodyParts.push(t.notesLabel);
    bodyParts.push(sanitizeForPrompt(params.additionalNotes));
    bodyParts.push('');
  }

  bodyParts.push(t.actionRequired);
  bodyParts.push('');

  bodyParts.push(t.closing);
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
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; }
    .reference { background: #f5f5f5; padding: 12px; margin-bottom: 16px; border-left: 4px solid #2563eb; }
    .attachments { background: #fafafa; padding: 12px; margin: 16px 0; }
    .attachments ul { margin: 8px 0; padding-left: 20px; }
    .attachments li { margin: 4px 0; }
    .notes { background: #fff9e6; padding: 12px; margin: 16px 0; border-left: 4px solid #f59e0b; }
    .signature { margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
    .signature-name { font-weight: bold; }
  </style>
</head>
<body>
  <div class="reference">
    <strong>Référence:</strong> ${sanitizeHtml(params.dossierRef)} - ${sanitizeHtml(params.dossierName)}
  </div>

  <p>${t.greeting(sanitizeHtml(params.clientName))},</p>

  <p>${t.intro}</p>

  <div class="attachments">
    <strong>${t.attachmentLabel}</strong>
    <ul>
      ${params.attachmentNames.map(a => `<li>${sanitizeHtml(a)}</li>`).join('\n')}
    </ul>
  </div>

  ${params.additionalNotes ? `
  <div class="notes">
    <strong>${t.notesLabel}</strong><br>
    ${sanitizeHtml(params.additionalNotes)}
  </div>
  ` : ''}

  <p>${t.actionRequired}</p>

  <p>${t.closing}</p>

  <div class="signature">
    <p class="signature-name">${params.lawyerTitle ? sanitizeHtml(params.lawyerTitle) + ' ' : ''}${sanitizeHtml(params.lawyerName)}</p>
    <p>${sanitizeHtml(params.firmName)}</p>
    ${params.firmPhone ? `<p>Tel: ${sanitizeHtml(params.firmPhone)}</p>` : ''}
    ${params.firmEmail ? `<p>${sanitizeHtml(params.firmEmail)}</p>` : ''}
  </div>
</body>
</html>
  `.trim();

  return {
    subject,
    body,
    bodyHtml,
    to: [params.clientEmail],
  };
}

function buildSignature(params: ClientTransmittalParams): string {
  const lines: string[] = [];

  if (params.lawyerTitle) {
    lines.push(`${params.lawyerTitle} ${params.lawyerName}`);
  } else {
    lines.push(params.lawyerName);
  }

  lines.push(params.firmName);

  if (params.firmPhone) {
    lines.push(`Tel: ${params.firmPhone}`);
  }

  if (params.firmEmail) {
    lines.push(params.firmEmail);
  }

  return lines.join('\n');
}
