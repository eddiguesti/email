/**
 * Leave Request Acknowledgement Template
 * Auto-reply for leave/absence notifications
 */

import { sanitizeForPrompt, sanitizeHtml } from '../utils/sanitization.js';

export interface LeaveAcknowledgementParams {
  senderName: string;
  senderEmail: string;
  leaveType: 'vacation' | 'sick' | 'parental' | 'other';
  startDate?: string;
  endDate?: string;
  originalSubject: string;
  acknowledgerName: string;
  acknowledgerTitle?: string;
  firmName: string;
  alternateContact?: {
    name: string;
    email: string;
    phone?: string;
  };
  additionalNotes?: string;
  language?: 'fr' | 'nl' | 'en';
}

const TEMPLATES = {
  fr: {
    subject: 'Accusé de réception - Demande de congé',
    greeting: (name: string) => `Cher(e) ${name}`,
    intro: {
      vacation: 'Nous accusons réception de votre demande de congé.',
      sick: 'Nous accusons réception de votre notification d\'absence pour maladie.',
      parental: 'Nous accusons réception de votre demande de congé parental.',
      other: 'Nous accusons réception de votre notification d\'absence.',
    },
    periodLabel: 'Période concernée',
    confirmed: 'Votre demande a été enregistrée et sera traitée dans les meilleurs délais.',
    alternateContact: 'En cas d\'urgence pendant cette période, veuillez contacter',
    closing: 'Bien cordialement,',
    autoReply: 'Ce message a été généré automatiquement.',
  },
  nl: {
    subject: 'Ontvangstbevestiging - Verlofaanvraag',
    greeting: (name: string) => `Beste ${name}`,
    intro: {
      vacation: 'Wij bevestigen de ontvangst van uw verlofaanvraag.',
      sick: 'Wij bevestigen de ontvangst van uw ziektemelding.',
      parental: 'Wij bevestigen de ontvangst van uw aanvraag ouderschapsverlof.',
      other: 'Wij bevestigen de ontvangst van uw afwezigheidsmelding.',
    },
    periodLabel: 'Betrokken periode',
    confirmed: 'Uw aanvraag is geregistreerd en zal zo spoedig mogelijk worden behandeld.',
    alternateContact: 'In geval van nood tijdens deze periode, gelieve contact op te nemen met',
    closing: 'Met vriendelijke groeten,',
    autoReply: 'Dit bericht is automatisch gegenereerd.',
  },
  en: {
    subject: 'Acknowledgement - Leave Request',
    greeting: (name: string) => `Dear ${name}`,
    intro: {
      vacation: 'We acknowledge receipt of your leave request.',
      sick: 'We acknowledge receipt of your sick leave notification.',
      parental: 'We acknowledge receipt of your parental leave request.',
      other: 'We acknowledge receipt of your absence notification.',
    },
    periodLabel: 'Period',
    confirmed: 'Your request has been registered and will be processed shortly.',
    alternateContact: 'In case of emergency during this period, please contact',
    closing: 'Kind regards,',
    autoReply: 'This message was automatically generated.',
  },
};

/**
 * Generate a leave acknowledgement email
 */
export function generateLeaveAcknowledgement(params: LeaveAcknowledgementParams): {
  subject: string;
  body: string;
  bodyHtml: string;
  to: string[];
} {
  const lang = params.language || 'fr';
  const t = TEMPLATES[lang];

  const subject = `Re: ${params.originalSubject}`;

  // Build body
  const bodyParts: string[] = [];

  bodyParts.push(t.greeting(sanitizeForPrompt(params.senderName)) + ',');
  bodyParts.push('');

  bodyParts.push(t.intro[params.leaveType]);
  bodyParts.push('');

  // Period if specified
  if (params.startDate || params.endDate) {
    const period = params.startDate && params.endDate
      ? `${params.startDate} - ${params.endDate}`
      : params.startDate || params.endDate;
    bodyParts.push(`${t.periodLabel}: ${period}`);
    bodyParts.push('');
  }

  bodyParts.push(t.confirmed);
  bodyParts.push('');

  // Alternate contact
  if (params.alternateContact) {
    bodyParts.push(t.alternateContact + ':');
    bodyParts.push(`  ${params.alternateContact.name}`);
    bodyParts.push(`  ${params.alternateContact.email}`);
    if (params.alternateContact.phone) {
      bodyParts.push(`  Tel: ${params.alternateContact.phone}`);
    }
    bodyParts.push('');
  }

  // Additional notes
  if (params.additionalNotes) {
    bodyParts.push(sanitizeForPrompt(params.additionalNotes));
    bodyParts.push('');
  }

  bodyParts.push(t.closing);
  bodyParts.push('');
  bodyParts.push(params.acknowledgerTitle
    ? `${params.acknowledgerTitle} ${params.acknowledgerName}`
    : params.acknowledgerName);
  bodyParts.push(params.firmName);
  bodyParts.push('');
  bodyParts.push(`---`);
  bodyParts.push(t.autoReply);

  const body = bodyParts.join('\n');

  // HTML version
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; }
    .confirmation { background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 16px 0; }
    .period { background: #f5f5f5; padding: 12px; margin: 16px 0; border-radius: 4px; }
    .alternate-contact { background: #fef3c7; padding: 12px; margin: 16px 0; border-radius: 4px; }
    .signature { margin-top: 24px; }
    .auto-notice { color: #666; font-size: 12px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <p>${t.greeting(sanitizeHtml(params.senderName))},</p>

  <div class="confirmation">
    <p>${t.intro[params.leaveType]}</p>
  </div>

  ${params.startDate || params.endDate ? `
  <div class="period">
    <strong>${t.periodLabel}:</strong>
    ${params.startDate && params.endDate
      ? `${sanitizeHtml(params.startDate)} - ${sanitizeHtml(params.endDate)}`
      : sanitizeHtml(params.startDate || params.endDate || '')}
  </div>
  ` : ''}

  <p>${t.confirmed}</p>

  ${params.alternateContact ? `
  <div class="alternate-contact">
    <strong>${t.alternateContact}:</strong><br>
    ${sanitizeHtml(params.alternateContact.name)}<br>
    <a href="mailto:${sanitizeHtml(params.alternateContact.email)}">${sanitizeHtml(params.alternateContact.email)}</a>
    ${params.alternateContact.phone ? `<br>Tel: ${sanitizeHtml(params.alternateContact.phone)}` : ''}
  </div>
  ` : ''}

  ${params.additionalNotes ? `<p>${sanitizeHtml(params.additionalNotes)}</p>` : ''}

  <p>${t.closing}</p>

  <div class="signature">
    <p><strong>${params.acknowledgerTitle ? sanitizeHtml(params.acknowledgerTitle) + ' ' : ''}${sanitizeHtml(params.acknowledgerName)}</strong><br>
    ${sanitizeHtml(params.firmName)}</p>
  </div>

  <p class="auto-notice">${t.autoReply}</p>
</body>
</html>
  `.trim();

  return {
    subject,
    body,
    bodyHtml,
    to: [params.senderEmail],
  };
}
