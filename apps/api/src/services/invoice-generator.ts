/**
 * Invoice Generator Service
 *
 * Generates professional PDF invoices from billing items.
 * Alternative to Kleos invoice creation when API is not available.
 *
 * Features:
 * - Generate PDF invoices in French
 * - Professional layout with firm branding
 * - Automatic numbering
 * - Email sending capability
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Firm configuration (should come from settings)
interface FirmConfig {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  siret: string;
  tva: string;
  iban: string;
  bic: string;
  logo?: string; // Base64 or URL
}

const DEFAULT_FIRM_CONFIG: FirmConfig = {
  name: 'Cabinet d\'Avocats',
  address: '1 rue du Palais',
  city: 'Paris',
  postalCode: '75001',
  phone: '01 00 00 00 00',
  email: 'contact@cabinet.fr',
  siret: '000 000 000 00000',
  tva: 'FR00000000000',
  iban: 'FR76 0000 0000 0000 0000 0000 000',
  bic: 'XXXXXXXX',
};

// Invoice line item
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // 0.20 for 20%
  amount: number;  // quantity * unitPrice
}

// Invoice data
export interface InvoiceData {
  // Invoice details
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;

  // Client
  clientName: string;
  clientAddress?: string;
  clientCity?: string;
  clientPostalCode?: string;
  clientEmail?: string;
  clientReference?: string; // "V. Réfs"

  // Case
  caseReference?: string;   // "N. Réfs"
  caseName?: string;

  // Line items
  items: InvoiceLineItem[];

  // Totals (calculated)
  subtotal?: number;
  vatAmount?: number;
  total?: number;

  // Payment
  paymentTerms?: string;
  notes?: string;
}

/**
 * Generate next invoice number
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `F${year}`;

  // Get the last invoice number for this year
  const { data } = await supabase
    .from('generated_invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].invoice_number.replace(prefix, ''));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

/**
 * Calculate invoice totals
 */
function calculateTotals(items: InvoiceLineItem[]): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  // Group VAT by rate
  const vatByRate = items.reduce((acc, item) => {
    const rate = item.vatRate || 0.20;
    acc[rate] = (acc[rate] || 0) + (item.amount * rate);
    return acc;
  }, {} as Record<number, number>);

  const vatAmount = Object.values(vatByRate).reduce((sum, vat) => sum + vat, 0);
  const total = subtotal + vatAmount;

  return { subtotal, vatAmount, total };
}

/**
 * Generate invoice HTML (for PDF conversion)
 */
export function generateInvoiceHtml(invoice: InvoiceData, firm: FirmConfig = DEFAULT_FIRM_CONFIG): string {
  const totals = calculateTotals(invoice.items);
  invoice.subtotal = totals.subtotal;
  invoice.vatAmount = totals.vatAmount;
  invoice.total = totals.total;

  const formatAmount = (amount: number) =>
    amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #333;
      padding: 40px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1a365d;
    }

    .firm-info {
      max-width: 300px;
    }

    .firm-name {
      font-size: 18pt;
      font-weight: bold;
      color: #1a365d;
      margin-bottom: 10px;
    }

    .firm-details {
      font-size: 9pt;
      color: #666;
    }

    .invoice-title {
      text-align: right;
    }

    .invoice-title h1 {
      font-size: 24pt;
      color: #1a365d;
      margin-bottom: 10px;
    }

    .invoice-number {
      font-size: 14pt;
      font-weight: bold;
    }

    .invoice-date {
      color: #666;
      margin-top: 5px;
    }

    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }

    .party-box {
      width: 45%;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .party-label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .party-name {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 5px;
    }

    .reference-box {
      margin-bottom: 20px;
      padding: 10px;
      background: #e8f4f8;
      border-left: 3px solid #1a365d;
    }

    .reference-label {
      font-size: 9pt;
      color: #666;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    th {
      background: #1a365d;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: normal;
      font-size: 9pt;
      text-transform: uppercase;
    }

    th:last-child {
      text-align: right;
    }

    td {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }

    td:last-child {
      text-align: right;
    }

    .totals {
      margin-left: auto;
      width: 300px;
    }

    .totals table {
      margin-bottom: 0;
    }

    .totals td {
      padding: 8px 10px;
    }

    .totals .total-row {
      font-weight: bold;
      font-size: 12pt;
      background: #1a365d;
      color: white;
    }

    .payment-info {
      margin-top: 30px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .payment-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #1a365d;
    }

    .bank-details {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 5px;
      font-size: 9pt;
    }

    .bank-label {
      color: #666;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }

    .notes {
      margin-top: 20px;
      padding: 10px;
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="firm-info">
      <div class="firm-name">${firm.name}</div>
      <div class="firm-details">
        ${firm.address}<br>
        ${firm.postalCode} ${firm.city}<br>
        Tél: ${firm.phone}<br>
        Email: ${firm.email}
      </div>
    </div>
    <div class="invoice-title">
      <h1>FACTURE</h1>
      <div class="invoice-number">N° ${invoice.invoiceNumber}</div>
      <div class="invoice-date">Date: ${formatDate(invoice.invoiceDate)}</div>
      <div class="invoice-date">Échéance: ${formatDate(invoice.dueDate)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <div class="party-label">Émetteur</div>
      <div class="party-name">${firm.name}</div>
      <div>${firm.address}</div>
      <div>${firm.postalCode} ${firm.city}</div>
      <div style="margin-top: 10px; font-size: 9pt;">
        SIRET: ${firm.siret}<br>
        TVA: ${firm.tva}
      </div>
    </div>
    <div class="party-box">
      <div class="party-label">Client</div>
      <div class="party-name">${invoice.clientName}</div>
      ${invoice.clientAddress ? `<div>${invoice.clientAddress}</div>` : ''}
      ${invoice.clientPostalCode || invoice.clientCity ? `<div>${invoice.clientPostalCode || ''} ${invoice.clientCity || ''}</div>` : ''}
      ${invoice.clientReference ? `<div style="margin-top: 10px; font-size: 9pt;">Réf. client: ${invoice.clientReference}</div>` : ''}
    </div>
  </div>

  ${invoice.caseReference || invoice.caseName ? `
  <div class="reference-box">
    ${invoice.clientReference ? `<div class="reference-label">V. Réfs: ${invoice.clientReference}</div>` : ''}
    <div class="reference-label">N. Réfs: ${invoice.caseReference || ''} ${invoice.caseName ? `– ${invoice.caseName}` : ''}</div>
  </div>
  ` : ''}

  <table>
    <thead>
      <tr>
        <th style="width: 50%">Description</th>
        <th style="width: 10%; text-align: center;">Qté</th>
        <th style="width: 15%; text-align: right;">Prix unit. HT</th>
        <th style="width: 10%; text-align: center;">TVA</th>
        <th style="width: 15%; text-align: right;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${formatAmount(item.unitPrice)} €</td>
        <td style="text-align: center;">${(item.vatRate * 100).toFixed(0)}%</td>
        <td style="text-align: right;">${formatAmount(item.amount)} €</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td>Total HT</td>
        <td>${formatAmount(invoice.subtotal!)} €</td>
      </tr>
      <tr>
        <td>TVA (20%)</td>
        <td>${formatAmount(invoice.vatAmount!)} €</td>
      </tr>
      <tr class="total-row">
        <td>Total TTC</td>
        <td>${formatAmount(invoice.total!)} €</td>
      </tr>
    </table>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <strong>Notes:</strong> ${invoice.notes}
  </div>
  ` : ''}

  <div class="payment-info">
    <div class="payment-title">Informations de paiement</div>
    <div class="bank-details">
      <span class="bank-label">IBAN:</span>
      <span>${firm.iban}</span>
      <span class="bank-label">BIC:</span>
      <span>${firm.bic}</span>
    </div>
    <div style="margin-top: 10px; font-size: 9pt;">
      ${invoice.paymentTerms || 'Paiement à réception de facture. Tout retard de paiement entraînera des pénalités de retard au taux de 3 fois le taux d\'intérêt légal.'}
    </div>
  </div>

  <div class="footer">
    ${firm.name} – SIRET: ${firm.siret} – TVA: ${firm.tva}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create invoice from billing items
 */
export interface CreateInvoiceFromBillingParams {
  clientName: string;
  clientEmail?: string;
  clientReference?: string;
  caseReference?: string;
  caseName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
  }>;
  dueInDays?: number;
  notes?: string;
}

export async function createInvoiceFromBilling(
  params: CreateInvoiceFromBillingParams,
  userId: string
): Promise<{ invoiceNumber: string; html: string; total: number }> {
  const invoiceNumber = await generateInvoiceNumber();
  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (params.dueInDays || 30));

  const items: InvoiceLineItem[] = params.items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate || 0.20,
    amount: item.quantity * item.unitPrice,
  }));

  const invoiceData: InvoiceData = {
    invoiceNumber,
    invoiceDate,
    dueDate,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    clientReference: params.clientReference,
    caseReference: params.caseReference,
    caseName: params.caseName,
    items,
    notes: params.notes,
  };

  const html = generateInvoiceHtml(invoiceData);
  const totals = calculateTotals(items);

  // Save invoice record
  await supabase.from('generated_invoices').insert({
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate.toISOString(),
    due_date: dueDate.toISOString(),
    client_name: params.clientName,
    client_email: params.clientEmail,
    case_reference: params.caseReference,
    case_name: params.caseName,
    subtotal: totals.subtotal,
    vat_amount: totals.vatAmount,
    total: totals.total,
    status: 'created',
    created_by: userId,
  });

  return {
    invoiceNumber,
    html,
    total: totals.total,
  };
}
