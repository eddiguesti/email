/**
 * Fee Reminder Templates
 * First, second, and final reminder for unpaid invoices
 */

import { sanitizeForPrompt, sanitizeHtml } from '../utils/sanitization.js';

export interface FeeReminderParams {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
  dueDate: string;
  daysPastDue: number;
  dossierRef?: string;
  dossierName?: string;
  lawyerName: string;
  lawyerTitle?: string;
  firmName: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  bankAccount?: string;
  paymentReference?: string;
  language?: 'fr' | 'nl' | 'en';
}

type ReminderLevel = 'first' | 'second' | 'final';

const TEMPLATES = {
  fr: {
    first: {
      subject: (inv: string) => `Rappel de paiement - Facture ${inv}`,
      intro: 'Nous nous permettons de vous rappeler que la facture mentionnée ci-dessous reste impayée à ce jour.',
      tone: 'Nous vous serions reconnaissants de bien vouloir régulariser cette situation dans les meilleurs délais.',
      action: 'Si le paiement a déjà été effectué, veuillez ignorer ce rappel.',
    },
    second: {
      subject: (inv: string) => `2ème rappel - Facture ${inv} impayée`,
      intro: 'Malgré notre premier rappel, nous constatons que la facture ci-dessous demeure impayée.',
      tone: 'Nous vous prions de procéder au règlement dans les 8 jours.',
      action: 'À défaut de paiement, nous serons contraints de prendre des mesures complémentaires.',
    },
    final: {
      subject: (inv: string) => `MISE EN DEMEURE - Facture ${inv}`,
      intro: 'Malgré nos rappels précédents, la facture suivante reste impayée.',
      tone: 'La présente vaut mise en demeure formelle.',
      action: 'À défaut de paiement dans les 8 jours, nous transmettrons le dossier à notre service de recouvrement.',
    },
    labels: {
      invoice: 'Facture N°',
      date: 'Date',
      amount: 'Montant',
      dueDate: 'Échéance',
      daysPastDue: 'Jours de retard',
      bankAccount: 'Compte bancaire',
      reference: 'Communication',
    },
    closing: 'Nous vous prions d\'agréer nos salutations distinguées.',
  },
  nl: {
    first: {
      subject: (inv: string) => `Betalingsherinnering - Factuur ${inv}`,
      intro: 'Wij herinneren u eraan dat onderstaande factuur nog niet betaald is.',
      tone: 'Wij verzoeken u vriendelijk deze situatie zo spoedig mogelijk te regulariseren.',
      action: 'Indien de betaling reeds uitgevoerd is, gelieve deze herinnering als niet verzonden te beschouwen.',
    },
    second: {
      subject: (inv: string) => `2de herinnering - Factuur ${inv} onbetaald`,
      intro: 'Ondanks onze eerste herinnering stellen wij vast dat onderstaande factuur nog steeds onbetaald is.',
      tone: 'Wij verzoeken u de betaling binnen 8 dagen uit te voeren.',
      action: 'Bij gebrek aan betaling zullen wij genoodzaakt zijn verdere stappen te ondernemen.',
    },
    final: {
      subject: (inv: string) => `INGEBREKESTELLING - Factuur ${inv}`,
      intro: 'Ondanks onze vorige herinneringen blijft de volgende factuur onbetaald.',
      tone: 'Dit schrijven geldt als formele ingebrekestelling.',
      action: 'Bij gebrek aan betaling binnen 8 dagen zullen wij het dossier overdragen aan onze incassodienst.',
    },
    labels: {
      invoice: 'Factuur Nr.',
      date: 'Datum',
      amount: 'Bedrag',
      dueDate: 'Vervaldatum',
      daysPastDue: 'Dagen achterstallig',
      bankAccount: 'Bankrekening',
      reference: 'Mededeling',
    },
    closing: 'Met vriendelijke groeten,',
  },
  en: {
    first: {
      subject: (inv: string) => `Payment Reminder - Invoice ${inv}`,
      intro: 'We wish to remind you that the invoice below remains unpaid.',
      tone: 'We kindly request that you settle this matter at your earliest convenience.',
      action: 'If payment has already been made, please disregard this reminder.',
    },
    second: {
      subject: (inv: string) => `2nd Reminder - Invoice ${inv} Outstanding`,
      intro: 'Despite our first reminder, we note that the invoice below remains unpaid.',
      tone: 'Please arrange payment within 8 days.',
      action: 'Failure to pay may result in further action.',
    },
    final: {
      subject: (inv: string) => `FORMAL NOTICE - Invoice ${inv}`,
      intro: 'Despite our previous reminders, the following invoice remains unpaid.',
      tone: 'This constitutes formal notice of default.',
      action: 'Failure to pay within 8 days will result in referral to our collection service.',
    },
    labels: {
      invoice: 'Invoice No.',
      date: 'Date',
      amount: 'Amount',
      dueDate: 'Due Date',
      daysPastDue: 'Days Overdue',
      bankAccount: 'Bank Account',
      reference: 'Reference',
    },
    closing: 'Kind regards,',
  },
};

/**
 * Generate a fee reminder
 */
export function generateFeeReminder(
  params: FeeReminderParams,
  level: ReminderLevel
): {
  subject: string;
  body: string;
  bodyHtml: string;
  to: string[];
} {
  const lang = params.language || 'fr';
  const t = TEMPLATES[lang][level];
  const labels = TEMPLATES[lang].labels;
  const closing = TEMPLATES[lang].closing;

  const subject = t.subject(sanitizeForPrompt(params.invoiceNumber));

  // Build body
  const bodyParts: string[] = [];

  // Reference if available
  if (params.dossierRef) {
    bodyParts.push(`Référence: ${params.dossierRef}${params.dossierName ? ` - ${params.dossierName}` : ''}`);
    bodyParts.push('');
  }

  bodyParts.push(`${sanitizeForPrompt(params.clientName)},`);
  bodyParts.push('');

  bodyParts.push(t.intro);
  bodyParts.push('');

  // Invoice details
  bodyParts.push(`${labels.invoice}: ${params.invoiceNumber}`);
  bodyParts.push(`${labels.date}: ${params.invoiceDate}`);
  bodyParts.push(`${labels.amount}: ${params.invoiceAmount}`);
  bodyParts.push(`${labels.dueDate}: ${params.dueDate}`);
  bodyParts.push(`${labels.daysPastDue}: ${params.daysPastDue}`);
  bodyParts.push('');

  bodyParts.push(t.tone);
  bodyParts.push('');

  // Payment info
  if (params.bankAccount) {
    bodyParts.push(`${labels.bankAccount}: ${params.bankAccount}`);
  }
  if (params.paymentReference) {
    bodyParts.push(`${labels.reference}: ${params.paymentReference}`);
  }
  bodyParts.push('');

  bodyParts.push(t.action);
  bodyParts.push('');

  bodyParts.push(closing);
  bodyParts.push('');
  bodyParts.push(buildSignature(params));

  const body = bodyParts.join('\n');

  // HTML version
  const urgencyColor = level === 'final' ? '#dc2626' : level === 'second' ? '#f59e0b' : '#2563eb';
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; }
    .urgency-banner { background: ${urgencyColor}; color: white; padding: 12px; text-align: center; font-weight: bold; margin-bottom: 20px; }
    .invoice-details { background: #f5f5f5; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .invoice-details table { width: 100%; border-collapse: collapse; }
    .invoice-details td { padding: 8px 0; }
    .invoice-details td:first-child { font-weight: bold; width: 40%; }
    .payment-info { background: #e8f4fd; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .action-notice { ${level === 'final' ? 'background: #fef2f2; border-left: 4px solid #dc2626;' : ''} padding: 12px; margin: 16px 0; }
    .signature { margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
  </style>
</head>
<body>
  ${level === 'final' ? '<div class="urgency-banner">⚠️ MISE EN DEMEURE / FORMAL NOTICE</div>' : ''}
  ${level === 'second' ? '<div class="urgency-banner" style="background: #f59e0b;">⏰ 2ème RAPPEL / 2nd REMINDER</div>' : ''}

  ${params.dossierRef ? `<p><em>Ref: ${sanitizeHtml(params.dossierRef)}${params.dossierName ? ` - ${sanitizeHtml(params.dossierName)}` : ''}</em></p>` : ''}

  <p>${sanitizeHtml(params.clientName)},</p>

  <p>${t.intro}</p>

  <div class="invoice-details">
    <table>
      <tr><td>${labels.invoice}:</td><td>${sanitizeHtml(params.invoiceNumber)}</td></tr>
      <tr><td>${labels.date}:</td><td>${sanitizeHtml(params.invoiceDate)}</td></tr>
      <tr><td>${labels.amount}:</td><td><strong>${sanitizeHtml(params.invoiceAmount)}</strong></td></tr>
      <tr><td>${labels.dueDate}:</td><td>${sanitizeHtml(params.dueDate)}</td></tr>
      <tr><td>${labels.daysPastDue}:</td><td style="color: ${urgencyColor}; font-weight: bold;">${params.daysPastDue}</td></tr>
    </table>
  </div>

  <p><strong>${t.tone}</strong></p>

  ${params.bankAccount || params.paymentReference ? `
  <div class="payment-info">
    ${params.bankAccount ? `<p><strong>${labels.bankAccount}:</strong> ${sanitizeHtml(params.bankAccount)}</p>` : ''}
    ${params.paymentReference ? `<p><strong>${labels.reference}:</strong> ${sanitizeHtml(params.paymentReference)}</p>` : ''}
  </div>
  ` : ''}

  <div class="action-notice">
    <p>${t.action}</p>
  </div>

  <p>${closing}</p>

  <div class="signature">
    <p><strong>${params.lawyerTitle ? sanitizeHtml(params.lawyerTitle) + ' ' : ''}${sanitizeHtml(params.lawyerName)}</strong></p>
    <p>${sanitizeHtml(params.firmName)}</p>
    ${params.firmPhone ? `<p>Tel: ${sanitizeHtml(params.firmPhone)}</p>` : ''}
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

function buildSignature(params: FeeReminderParams): string {
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

  return lines.join('\n');
}
