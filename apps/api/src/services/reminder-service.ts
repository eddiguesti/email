/**
 * Invoice Reminder Service
 *
 * Handles the automated reminder process for unpaid invoices:
 * - Import invoices from Excel/CSV
 * - Enrich with Kleos data (case, contact info)
 * - Generate and send reminder emails
 * - Track reminder history
 * - Escalation logic
 */

import { createClient } from '@supabase/supabase-js';
import {
  searchCases,
  searchContacts,
  getContact,
  type KleosCase,
  type KleosIdentity,
} from './kleos-client.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ============== Types ==============

export interface UnpaidInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  amount: number;
  currency: string;
  clientReference?: string;
  firmReference?: string;
  caseName?: string;
  kleosCaseId?: number;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientSalutation?: string;
  kleosIdentityId?: number;
  status: InvoiceStatus;
  reminderCount: number;
  lastReminderAt?: Date;
  nextReminderAt?: Date;
  phoneCallRequired: boolean;
}

export type InvoiceStatus =
  | 'pending'
  | 'reminded'
  | 'paid'
  | 'partial'
  | 'contested'
  | 'processing'
  | 'written_off'
  | 'legal';

export interface ReminderTemplate {
  id: string;
  name: string;
  templateType: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface ReminderSettings {
  firstReminderDays: number;
  secondReminderDays: number;
  thirdReminderDays: number;
  subsequentReminderDays: number;
  phoneCallAfterReminder: number;
  escalateToPartnerAfter: number;
  legalActionAfterDays: number;
  alwaysCcEmails: string[];
}

export interface ImportedInvoiceRow {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number | string;
  clientReference?: string;
  firmReference?: string;
  caseName?: string;
  clientName: string;
  clientEmail?: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  enriched: number;
  errors: Array<{ row: number; error: string }>;
  batchId: string;
}

export interface ReminderReport {
  date: Date;
  processed: number;
  emailsSent: number;
  phoneCallsScheduled: number;
  errors: Array<{ invoiceId: string; error: string }>;
}

// ============== Invoice Import ==============

/**
 * Import invoices from parsed data
 */
export async function importInvoices(
  rows: ImportedInvoiceRow[],
  sourceName: string,
  userId: string
): Promise<ImportResult> {
  const batchId = crypto.randomUUID();
  const errors: ImportResult['errors'] = [];
  let imported = 0;
  let enriched = 0;

  // Fetch settings once before the loop (not per-row)
  const settings = await getReminderSettings();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Validate required fields
      if (!row.invoiceNumber || !row.clientName || !row.amount) {
        errors.push({ row: i + 1, error: 'Champs obligatoires manquants' });
        continue;
      }

      // Parse amount
      const amount = typeof row.amount === 'string'
        ? parseFloat(row.amount.replace(/[^\d.,]/g, '').replace(',', '.'))
        : row.amount;

      if (isNaN(amount)) {
        errors.push({ row: i + 1, error: 'Montant invalide' });
        continue;
      }

      // Parse dates
      const invoiceDate = parseDate(row.invoiceDate);
      const dueDate = row.dueDate ? parseDate(row.dueDate) : null;

      if (!invoiceDate) {
        errors.push({ row: i + 1, error: 'Date de facture invalide' });
        continue;
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('unpaid_invoices')
        .select('id')
        .eq('invoice_number', row.invoiceNumber)
        .single();

      if (existing) {
        errors.push({ row: i + 1, error: 'Facture déjà importée' });
        continue;
      }

      // Enrich with Kleos data
      let kleosData: {
        caseId?: number;
        identityId?: number;
        email?: string;
        salutation?: string;
      } = {};

      try {
        kleosData = await enrichWithKleos(row);
        if (kleosData.caseId || kleosData.identityId) {
          enriched++;
        }
      } catch (e) {
        // Continue without enrichment
        console.warn('Kleos enrichment failed:', e);
      }

      // Calculate next reminder date
      const nextReminderAt = calculateNextReminderDate(dueDate || invoiceDate, 0, settings);

      // Insert invoice
      const { error: insertError } = await supabase
        .from('unpaid_invoices')
        .insert({
          invoice_number: row.invoiceNumber,
          invoice_date: invoiceDate.toISOString(),
          due_date: dueDate?.toISOString(),
          amount,
          client_reference: row.clientReference,
          firm_reference: row.firmReference,
          case_name: row.caseName,
          kleos_case_id: kleosData.caseId,
          client_name: row.clientName,
          client_email: kleosData.email || row.clientEmail,
          client_salutation: kleosData.salutation || determineSalutation(row.clientName),
          kleos_identity_id: kleosData.identityId,
          status: 'pending',
          next_reminder_at: nextReminderAt.toISOString(),
          imported_from: sourceName,
          import_batch_id: batchId,
          created_by: userId,
        });

      if (insertError) {
        errors.push({ row: i + 1, error: insertError.message });
        continue;
      }

      imported++;
    } catch (error) {
      errors.push({ row: i + 1, error: error instanceof Error ? error.message : 'Erreur inconnue' });
    }
  }

  return {
    total: rows.length,
    imported,
    enriched,
    errors,
    batchId,
  };
}

/**
 * Enrich invoice data with Kleos case and contact information
 */
async function enrichWithKleos(row: ImportedInvoiceRow): Promise<{
  caseId?: number;
  identityId?: number;
  email?: string;
  salutation?: string;
}> {
  const result: {
    caseId?: number;
    identityId?: number;
    email?: string;
    salutation?: string;
  } = {};

  // Search for case by firm reference
  if (row.firmReference) {
    try {
      const { cases } = await searchCases(row.firmReference, { pageSize: 5 });
      if (cases.length > 0) {
        result.caseId = cases[0].id;
      }
    } catch (e) {
      console.warn('Case search failed:', e);
    }
  }

  // Search for contact by client name
  if (row.clientName) {
    try {
      const { contacts } = await searchContacts(row.clientName, { pageSize: 5 });
      if (contacts.length > 0) {
        result.identityId = contacts[0].id;

        // Get full contact details for email and salutation
        const contact = await getContact(contacts[0].id);
        if (contact) {
          result.email = contact.email;
          result.salutation = determineSalutationFromContact(contact);
        }
      }
    } catch (e) {
      console.warn('Contact search failed:', e);
    }
  }

  return result;
}

// ============== Reminder Generation ==============

/**
 * Get invoices due for reminder
 */
export async function getInvoicesDueForReminder(): Promise<UnpaidInvoice[]> {
  const { data, error } = await supabase
    .from('unpaid_invoices')
    .select('*')
    .in('status', ['pending', 'reminded'])
    .eq('contested', false)
    .lte('next_reminder_at', new Date().toISOString())
    .order('amount', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapDbToInvoice);
}

/**
 * Generate reminder email content
 */
export async function generateReminderEmail(
  invoice: UnpaidInvoice,
  reminderNumber: number
): Promise<{ subject: string; body: string }> {
  // Get appropriate template
  const templateType = getTemplateType(reminderNumber);
  const { data: template } = await supabase
    .from('reminder_templates')
    .select('*')
    .eq('template_type', templateType)
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (!template) {
    throw new Error(`Template not found for type: ${templateType}`);
  }

  // Replace placeholders
  const subject = replacePlaceholders(template.subject_template, invoice);
  const body = replacePlaceholders(template.body_template, invoice);

  return { subject, body };
}

/**
 * Generate grouped reminder for multiple invoices
 */
export async function generateGroupedReminderEmail(
  invoices: UnpaidInvoice[],
  reminderNumber: number
): Promise<{ subject: string; body: string }> {
  const { data: template } = await supabase
    .from('reminder_templates')
    .select('*')
    .eq('template_type', 'grouped_reminder')
    .eq('is_default', true)
    .single();

  if (!template) {
    throw new Error('Grouped reminder template not found');
  }

  // Calculate totals
  const totalAmount = invoices.reduce((sum, i) => sum + i.amount, 0);
  const invoiceCount = invoices.length;

  // Build invoice list
  const invoiceList = invoices
    .map(i => `n° ${i.invoiceNumber} d'un montant de ${formatAmount(i.amount)} € datée du ${formatDate(i.invoiceDate)}`)
    .join(',\n');

  // Get unique client references
  const clientReferences = [...new Set(invoices.map(i => i.clientReference).filter(Boolean))].join('\n');

  // Use first invoice for other placeholders
  const primary = invoices[0];

  // Replace placeholders
  let subject = template.subject_template
    .replace('{{invoice_count}}', String(invoiceCount))
    .replace('{{total_amount}}', formatAmount(totalAmount));

  let body = template.body_template
    .replace('{{client_references}}', clientReferences)
    .replace('{{firm_reference}}', primary.firmReference || '')
    .replace('{{case_name}}', primary.caseName || '')
    .replace('{{client_salutation}}', primary.clientSalutation || 'Madame, Monsieur')
    .replace('{{invoice_list}}', invoiceList);

  return { subject, body };
}

/**
 * Record a sent reminder
 */
export async function recordReminder(
  invoiceId: string,
  reminderNumber: number,
  type: 'email' | 'phone',
  details: {
    emailTo?: string;
    emailCc?: string[];
    emailSubject?: string;
    emailBody?: string;
    graphMessageId?: string;
    phoneNumber?: string;
    callNotes?: string;
    callResult?: string;
  },
  userId: string
): Promise<void> {
  // Insert reminder record
  const { error } = await supabase.from('reminder_history').insert({
    invoice_id: invoiceId,
    reminder_number: reminderNumber,
    reminder_type: type,
    email_to: details.emailTo,
    email_cc: details.emailCc ? JSON.stringify(details.emailCc) : null,
    email_subject: details.emailSubject,
    email_body: details.emailBody,
    graph_message_id: details.graphMessageId,
    phone_number: details.phoneNumber,
    call_notes: details.callNotes,
    call_result: details.callResult,
    created_by: userId,
  });

  if (error) throw error;

  // Calculate and update next reminder date
  const settings = await getReminderSettings();
  const nextReminderAt = calculateNextReminderDate(
    new Date(),
    reminderNumber,
    settings
  );

  const phoneCallRequired = reminderNumber >= settings.phoneCallAfterReminder;

  await supabase
    .from('unpaid_invoices')
    .update({
      next_reminder_at: nextReminderAt.toISOString(),
      phone_call_required: phoneCallRequired,
    })
    .eq('id', invoiceId);
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(
  invoiceId: string,
  paymentInfo: {
    amount?: number;
    method?: string;
    reference?: string;
  },
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('unpaid_invoices')
    .update({
      status: 'paid',
      payment_received_at: new Date().toISOString(),
      payment_amount: paymentInfo.amount,
      payment_method: paymentInfo.method,
      payment_reference: paymentInfo.reference,
      updated_by: userId,
    })
    .eq('id', invoiceId);

  if (error) throw error;
}

/**
 * Mark invoice as contested
 */
export async function markInvoiceAsContested(
  invoiceId: string,
  reason: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('unpaid_invoices')
    .update({
      status: 'contested',
      contested: true,
      contested_reason: reason,
      contested_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', invoiceId);

  if (error) throw error;
}

// ============== Helper Functions ==============

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try different formats
  const formats = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
    /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[1]) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }

  // Try native parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function determineSalutation(clientName: string): string {
  // Default salutation when we don't have gender info
  return 'Madame, Monsieur';
}

function determineSalutationFromContact(contact: KleosIdentity): string {
  if (contact.type === 'L') {
    return 'Mesdames, Messieurs';
  }

  // For natural persons, we'd need gender from Kleos
  // Default to formal neutral
  return 'Chère Madame, Cher Monsieur';
}

function getTemplateType(reminderNumber: number): string {
  if (reminderNumber === 1) return 'first_reminder';
  if (reminderNumber === 2) return 'second_reminder';
  if (reminderNumber >= 3) return 'urgent_reminder';
  return 'first_reminder';
}

function replacePlaceholders(template: string, invoice: UnpaidInvoice): string {
  return template
    .replace(/\{\{invoice_number\}\}/g, invoice.invoiceNumber)
    .replace(/\{\{invoice_date\}\}/g, formatDate(invoice.invoiceDate))
    .replace(/\{\{amount\}\}/g, formatAmount(invoice.amount))
    .replace(/\{\{client_reference\}\}/g, invoice.clientReference || '')
    .replace(/\{\{firm_reference\}\}/g, invoice.firmReference || '')
    .replace(/\{\{case_name\}\}/g, invoice.caseName || '')
    .replace(/\{\{client_salutation\}\}/g, invoice.clientSalutation || 'Madame, Monsieur')
    .replace(/\{\{client_name\}\}/g, invoice.clientName)
    .replace(/\{\{due_date\}\}/g, invoice.dueDate ? formatDate(invoice.dueDate) : '');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function getReminderSettings(): Promise<ReminderSettings> {
  const { data } = await supabase
    .from('reminder_settings')
    .select('*')
    .eq('is_active', true)
    .single();

  return {
    firstReminderDays: data?.first_reminder_days || 14,
    secondReminderDays: data?.second_reminder_days || 14,
    thirdReminderDays: data?.third_reminder_days || 7,
    subsequentReminderDays: data?.subsequent_reminder_days || 7,
    phoneCallAfterReminder: data?.phone_call_after_reminder || 3,
    escalateToPartnerAfter: data?.escalate_to_partner_after || 4,
    legalActionAfterDays: data?.legal_action_after_days || 90,
    alwaysCcEmails: data?.always_cc_emails ? JSON.parse(data.always_cc_emails) : [],
  };
}

function calculateNextReminderDate(
  fromDate: Date,
  currentReminderCount: number,
  settings: ReminderSettings
): Date {
  let daysToAdd: number;

  switch (currentReminderCount) {
    case 0:
      daysToAdd = settings.firstReminderDays;
      break;
    case 1:
      daysToAdd = settings.secondReminderDays;
      break;
    case 2:
      daysToAdd = settings.thirdReminderDays;
      break;
    default:
      daysToAdd = settings.subsequentReminderDays;
  }

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

function mapDbToInvoice(db: Record<string, unknown>): UnpaidInvoice {
  return {
    id: db.id as string,
    invoiceNumber: db.invoice_number as string,
    invoiceDate: new Date(db.invoice_date as string),
    dueDate: db.due_date ? new Date(db.due_date as string) : undefined,
    amount: db.amount as number,
    currency: db.currency as string || 'EUR',
    clientReference: db.client_reference as string,
    firmReference: db.firm_reference as string,
    caseName: db.case_name as string,
    kleosCaseId: db.kleos_case_id as number,
    clientName: db.client_name as string,
    clientEmail: db.client_email as string,
    clientPhone: db.client_phone as string,
    clientSalutation: db.client_salutation as string,
    kleosIdentityId: db.kleos_identity_id as number,
    status: db.status as InvoiceStatus,
    reminderCount: db.reminder_count as number || 0,
    lastReminderAt: db.last_reminder_at ? new Date(db.last_reminder_at as string) : undefined,
    nextReminderAt: db.next_reminder_at ? new Date(db.next_reminder_at as string) : undefined,
    phoneCallRequired: db.phone_call_required as boolean || false,
  };
}

// ============== Excel Import ==============

/**
 * Import invoices from Excel buffer
 */
export async function importInvoicesFromExcel(
  buffer: Buffer,
  userId: string
): Promise<{ imported: number; skipped: number; errors: string[]; batchId: string }> {
  // Dynamically require xlsx to parse Excel files (bypasses TS module resolution)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let xlsx: any;
  try {
    const moduleName = 'xlsx';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    xlsx = require(moduleName);
  } catch {
    throw new Error('xlsx library not installed. Run: pnpm add xlsx');
  }

  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  const batchId = crypto.randomUUID();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Fetch settings once before the loop (not per-row)
  const excelSettings = await getReminderSettings();

  // Column mapping (adjust based on actual Excel structure)
  const columnMap: Record<string, string> = {
    'N° Facture': 'invoiceNumber',
    'Invoice Number': 'invoiceNumber',
    'Numéro': 'invoiceNumber',
    'Date': 'invoiceDate',
    'Invoice Date': 'invoiceDate',
    'Date Facture': 'invoiceDate',
    'Échéance': 'dueDate',
    'Due Date': 'dueDate',
    'Montant': 'amount',
    'Amount': 'amount',
    'Total': 'amount',
    'V. Réfs': 'clientReference',
    'Client Ref': 'clientReference',
    'N. Réfs': 'firmReference',
    'Firm Ref': 'firmReference',
    'Reference': 'firmReference',
    'Dossier': 'caseName',
    'Case': 'caseName',
    'Client': 'clientName',
    'Client Name': 'clientName',
    'Nom': 'clientName',
    'Email': 'clientEmail',
    'E-mail': 'clientEmail',
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Map columns
      const mapped: Record<string, unknown> = {};
      for (const [excelCol, fieldName] of Object.entries(columnMap)) {
        if (row[excelCol] !== undefined) {
          mapped[fieldName] = row[excelCol];
        }
      }

      // Validate required fields
      if (!mapped.invoiceNumber || !mapped.clientName || !mapped.amount) {
        errors.push(`Ligne ${i + 2}: Champs obligatoires manquants (numéro, client, montant)`);
        skipped++;
        continue;
      }

      // Parse amount
      let amount: number;
      if (typeof mapped.amount === 'number') {
        amount = mapped.amount;
      } else {
        const amountStr = String(mapped.amount).replace(/[^\d.,]/g, '').replace(',', '.');
        amount = parseFloat(amountStr);
      }

      if (isNaN(amount)) {
        errors.push(`Ligne ${i + 2}: Montant invalide`);
        skipped++;
        continue;
      }

      // Parse dates
      const invoiceDate = parseDate(String(mapped.invoiceDate || ''));
      if (!invoiceDate) {
        errors.push(`Ligne ${i + 2}: Date de facture invalide`);
        skipped++;
        continue;
      }

      const dueDate = mapped.dueDate ? parseDate(String(mapped.dueDate)) : null;

      // Check for duplicate
      const { data: existing } = await supabase
        .from('unpaid_invoices')
        .select('id')
        .eq('invoice_number', mapped.invoiceNumber)
        .single();

      if (existing) {
        errors.push(`Ligne ${i + 2}: Facture ${mapped.invoiceNumber} déjà importée`);
        skipped++;
        continue;
      }

      // Calculate next reminder date
      const nextReminderAt = calculateNextReminderDate(dueDate || invoiceDate, 0, excelSettings);

      // Insert invoice
      const { error: insertError } = await supabase
        .from('unpaid_invoices')
        .insert({
          invoice_number: mapped.invoiceNumber,
          invoice_date: invoiceDate.toISOString(),
          due_date: dueDate?.toISOString(),
          amount,
          client_reference: mapped.clientReference,
          firm_reference: mapped.firmReference,
          case_name: mapped.caseName,
          client_name: mapped.clientName,
          client_email: mapped.clientEmail,
          client_salutation: determineSalutation(String(mapped.clientName)),
          status: 'pending',
          next_reminder_at: nextReminderAt.toISOString(),
          imported_from: 'excel',
          import_batch_id: batchId,
          created_by: userId,
        });

      if (insertError) {
        errors.push(`Ligne ${i + 2}: ${insertError.message}`);
        skipped++;
        continue;
      }

      imported++;
    } catch (error) {
      errors.push(`Ligne ${i + 2}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      skipped++;
    }
  }

  return { imported, skipped, errors, batchId };
}

/**
 * Enrich invoice with Kleos data (public version)
 */
export async function enrichInvoiceWithKleos(invoice: UnpaidInvoice): Promise<UnpaidInvoice> {
  const enriched = { ...invoice };

  try {
    // Search for case by firm reference
    if (invoice.firmReference) {
      const { cases } = await searchCases(invoice.firmReference, { pageSize: 5 });
      if (cases.length > 0) {
        enriched.kleosCaseId = cases[0].id;
      }
    }

    // Search for contact by client name
    if (invoice.clientName) {
      const { contacts } = await searchContacts(invoice.clientName, { pageSize: 5 });
      if (contacts.length > 0) {
        enriched.kleosIdentityId = contacts[0].id;

        const contact = await getContact(contacts[0].id);
        if (contact) {
          if (!enriched.clientEmail && contact.email) {
            enriched.clientEmail = contact.email;
          }
          enriched.clientSalutation = determineSalutationFromContact(contact);
        }
      }
    }
  } catch (e) {
    console.warn('Kleos enrichment failed:', e);
  }

  return enriched;
}

/**
 * Process and send a reminder for an invoice via Microsoft Graph
 */
export async function processReminder(
  invoiceId: string,
  userId: string,
  options?: {
    templateType?: string;
    customMessage?: string;
    attachInvoice?: boolean;
    accessToken?: string;   // Lawyer's Graph OAuth access token (required to send)
    senderMailbox?: string; // Lawyer's email address used as sender
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get invoice
  const { data: invoice, error } = await supabase
    .from('unpaid_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    return { success: false, error: 'Facture non trouvée' };
  }

  if (!invoice.client_email) {
    return { success: false, error: 'Email client manquant' };
  }

  if (!options?.accessToken || !options?.senderMailbox) {
    return { success: false, error: 'Token d\'accès manquant pour l\'envoi' };
  }

  const mappedInvoice = mapDbToInvoice(invoice);
  const reminderNumber = (invoice.reminder_count || 0) + 1;

  // Generate email content
  const { subject, body } = await generateReminderEmail(mappedInvoice, reminderNumber);
  const finalBody = options.customMessage || body;

  // Fetch CC list from settings
  const settings = await getReminderSettings();
  const ccRecipients = settings.alwaysCcEmails.map((addr: string) => ({
    emailAddress: { address: addr },
  }));

  // Send via Microsoft Graph
  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(options.senderMailbox)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: finalBody },
          toRecipients: [{ emailAddress: { address: invoice.client_email } }],
          ccRecipients,
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!graphResponse.ok) {
    const errText = await graphResponse.text();
    return { success: false, error: `Échec envoi: ${errText}` };
  }

  // Record in DB (Graph sendMail returns 202 with no body — no message ID available)
  await recordReminder(
    invoiceId,
    reminderNumber,
    'email',
    {
      emailTo: invoice.client_email,
      emailSubject: subject,
      emailBody: finalBody,
    },
    userId
  );

  return { success: true };
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
  userId: string,
  options?: {
    notes?: string;
    paymentAmount?: number;
    paymentReference?: string;
  }
): Promise<{ success: boolean; invoice?: UnpaidInvoice }> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  // Handle specific status changes
  if (status === 'paid') {
    updates.payment_received_at = new Date().toISOString();
    if (options?.paymentAmount) updates.payment_amount = options.paymentAmount;
    if (options?.paymentReference) updates.payment_reference = options.paymentReference;
  }

  if (status === 'contested') {
    updates.contested = true;
    updates.contested_at = new Date().toISOString();
    if (options?.notes) updates.contested_reason = options.notes;
  }

  const { data, error } = await supabase
    .from('unpaid_invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { success: true, invoice: mapDbToInvoice(data) };
}

/**
 * Get invoice statistics for dashboard
 */
export async function getInvoiceStats(): Promise<{
  pending: { count: number; amount: number };
  reminded: { count: number; amount: number };
  paid: { count: number; amount: number };
  contested: { count: number; amount: number };
  dueToday: { count: number; amount: number };
  overdue: { count: number; amount: number };
  total: { count: number; amount: number };
}> {
  const { data: stats } = await supabase
    .from('unpaid_invoices')
    .select('status, amount, next_reminder_at, due_date');

  const result = {
    pending: { count: 0, amount: 0 },
    reminded: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
    contested: { count: 0, amount: 0 },
    dueToday: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
    total: { count: 0, amount: 0 },
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of stats || []) {
    const amount = row.amount || 0;
    result.total.count++;
    result.total.amount += amount;

    // By status
    if (row.status === 'pending') {
      result.pending.count++;
      result.pending.amount += amount;
    } else if (row.status === 'reminded') {
      result.reminded.count++;
      result.reminded.amount += amount;
    } else if (row.status === 'paid') {
      result.paid.count++;
      result.paid.amount += amount;
    } else if (row.status === 'contested') {
      result.contested.count++;
      result.contested.amount += amount;
    }

    // Due today
    if (row.next_reminder_at) {
      const nextReminder = new Date(row.next_reminder_at);
      nextReminder.setHours(0, 0, 0, 0);
      if (nextReminder.getTime() === today.getTime() && ['pending', 'reminded'].includes(row.status)) {
        result.dueToday.count++;
        result.dueToday.amount += amount;
      }
    }

    // Overdue
    if (row.due_date && ['pending', 'reminded'].includes(row.status)) {
      const dueDate = new Date(row.due_date);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        result.overdue.count++;
        result.overdue.amount += amount;
      }
    }
  }

  return result;
}
