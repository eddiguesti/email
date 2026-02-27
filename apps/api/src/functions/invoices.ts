/**
 * Invoice Reminder API Endpoints
 *
 * Handles unpaid invoice import, reminder management, and dashboard data.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createClient } from '@supabase/supabase-js';
import {
  importInvoicesFromExcel,
  enrichInvoiceWithKleos,
  getInvoicesDueForReminder,
  processReminder,
  getInvoiceStats,
  updateInvoiceStatus,
  UnpaidInvoice,
} from '../services/reminder-service.js';
import { getUserIdFromRequest, authenticateRequest } from '../utils/auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * POST /api/invoices/import - Import unpaid invoices from Excel/CSV
 */
async function importInvoices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return { status: 400, jsonBody: { error: 'Fichier requis' } };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await importInvoicesFromExcel(buffer, userId);

      return {
        status: 200,
        jsonBody: {
          success: true,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
          batchId: result.batchId,
          message: `${result.imported} facture(s) importée(s), ${result.skipped} ignorée(s)`,
        },
      };
    }

    // Handle JSON data (manual entry or API integration)
    if (contentType.includes('application/json')) {
      const body = await request.json() as { invoices: Partial<UnpaidInvoice>[] };

      if (!body.invoices || !Array.isArray(body.invoices)) {
        return { status: 400, jsonBody: { error: 'invoices array requis' } };
      }

      const batchId = crypto.randomUUID();
      const results = { imported: 0, skipped: 0, errors: [] as string[] };

      for (const invoice of body.invoices) {
        try {
          // Enrich with Kleos data if possible
          const enriched = await enrichInvoiceWithKleos(invoice as UnpaidInvoice);

          await supabase.from('unpaid_invoices').insert({
            invoice_number: enriched.invoiceNumber,
            invoice_date: enriched.invoiceDate?.toISOString(),
            due_date: enriched.dueDate?.toISOString(),
            amount: enriched.amount,
            currency: enriched.currency,
            client_reference: enriched.clientReference,
            firm_reference: enriched.firmReference,
            case_name: enriched.caseName,
            kleos_case_id: enriched.kleosCaseId,
            client_name: enriched.clientName,
            client_email: enriched.clientEmail,
            client_phone: enriched.clientPhone,
            client_salutation: enriched.clientSalutation,
            kleos_identity_id: enriched.kleosIdentityId,
            status: enriched.status || 'pending',
            import_batch_id: batchId,
            created_by: userId,
          });
          results.imported++;
        } catch (error) {
          results.errors.push(
            `Facture ${invoice.invoiceNumber}: ${error instanceof Error ? error.message : 'Erreur'}`
          );
          results.skipped++;
        }
      }

      return {
        status: 200,
        jsonBody: {
          success: true,
          ...results,
          batchId,
        },
      };
    }

    return { status: 400, jsonBody: { error: 'Content-Type non supporté' } };
  } catch (error) {
    context.error('Import invoices error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de l\'importation' },
    };
  }
}

/**
 * GET /api/invoices - List unpaid invoices with filters
 */
async function listInvoices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const status = request.query.get('status');
    const search = request.query.get('search');
    const page = parseInt(request.query.get('page') || '1');
    const pageSize = parseInt(request.query.get('pageSize') || '20');
    const sortBy = request.query.get('sortBy') || 'next_reminder_at';
    const sortOrder = request.query.get('sortOrder') || 'asc';

    let query = supabase
      .from('unpaid_invoices')
      .select('*', { count: 'exact' })
      .eq('created_by', userId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `invoice_number.ilike.%${search}%,client_name.ilike.%${search}%,case_name.ilike.%${search}%`
      );
    }

    // Apply sorting — allowlist to prevent column injection
    const SORTABLE_FIELDS = new Set(['next_reminder_at', 'due_date', 'invoice_date', 'created_at', 'amount', 'client_name', 'invoice_number', 'status']);
    const safeSortBy = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'next_reminder_at';
    query = query.order(safeSortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      status: 200,
      jsonBody: {
        invoices: data,
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  } catch (error) {
    context.error('List invoices error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des factures' },
    };
  }
}

/**
 * GET /api/invoices/{id} - Get single invoice details
 */
async function getInvoice(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const invoiceId = request.params.id;

    const { data, error } = await supabase
      .from('unpaid_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('created_by', userId)
      .single();

    if (error || !data) {
      return { status: 404, jsonBody: { error: 'Facture non trouvée' } };
    }

    // Get reminder history
    const { data: history } = await supabase
      .from('reminder_history')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sent_at', { ascending: false });

    return {
      status: 200,
      jsonBody: {
        invoice: data,
        reminderHistory: history || [],
      },
    };
  } catch (error) {
    context.error('Get invoice error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération de la facture' },
    };
  }
}

/**
 * PATCH /api/invoices/{id} - Update invoice
 */
async function updateInvoice(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const invoiceId = request.params.id;
    const body = await request.json() as Record<string, unknown>;

    // Map camelCase to snake_case for database
    const updates: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      invoiceNumber: 'invoice_number',
      invoiceDate: 'invoice_date',
      dueDate: 'due_date',
      clientReference: 'client_reference',
      firmReference: 'firm_reference',
      caseName: 'case_name',
      kleosCaseId: 'kleos_case_id',
      clientName: 'client_name',
      clientEmail: 'client_email',
      clientPhone: 'client_phone',
      clientSalutation: 'client_salutation',
      kleosIdentityId: 'kleos_identity_id',
    };

    for (const [key, value] of Object.entries(body)) {
      // Only allow explicitly whitelisted fields — reject unknown keys
      if (!fieldMap[key]) continue;
      updates[fieldMap[key]] = value;
    }

    updates.updated_at = new Date().toISOString();
    updates.updated_by = userId;

    const { data, error } = await supabase
      .from('unpaid_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .eq('created_by', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      status: 200,
      jsonBody: { invoice: data },
    };
  } catch (error) {
    context.error('Update invoice error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la mise à jour de la facture' },
    };
  }
}

/**
 * POST /api/invoices/{id}/status - Update invoice status
 */
async function changeInvoiceStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const invoiceId = request.params.id;
    const body = await request.json() as {
      status: string;
      notes?: string;
      paymentAmount?: number;
      paymentReference?: string;
    };

    const result = await updateInvoiceStatus(invoiceId, body.status, userId, {
      notes: body.notes,
      paymentAmount: body.paymentAmount,
      paymentReference: body.paymentReference,
    });

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('Change invoice status error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors du changement de statut' },
    };
  }
}

/**
 * GET /api/invoices/due - Get invoices due for reminder
 */
async function getDueInvoices(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const invoices = await getInvoicesDueForReminder();
    return {
      status: 200,
      jsonBody: { invoices },
    };
  } catch (error) {
    context.error('Get due invoices error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des factures à relancer' },
    };
  }
}

/**
 * POST /api/invoices/{id}/remind - Send reminder for invoice
 */
async function sendReminder(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Need full auth to get the access token for Graph email sending
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return { status: auth.status, jsonBody: { error: auth.error } };
  }

  try {
    const invoiceId = request.params.id;
    const body = await request.json() as {
      templateType?: string;
      customMessage?: string;
      attachInvoice?: boolean;
    };

    const result = await processReminder(invoiceId, auth.user.userId, {
      templateType: body.templateType,
      customMessage: body.customMessage,
      attachInvoice: body.attachInvoice,
      accessToken: auth.user.accessToken,
      senderMailbox: auth.user.email,
    });

    return {
      status: result.success ? 200 : 422,
      jsonBody: result,
    };
  } catch (error) {
    context.error('Send reminder error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de l\'envoi de la relance' },
    };
  }
}

/**
 * GET /api/invoices/stats - Get invoice statistics for dashboard
 */
async function getStats(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const stats = await getInvoiceStats(userId);
    return {
      status: 200,
      jsonBody: stats,
    };
  } catch (error) {
    context.error('Get stats error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des statistiques' },
    };
  }
}

/**
 * GET /api/invoices/templates - Get reminder templates
 */
async function getTemplates(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const { data, error } = await supabase
      .from('reminder_templates')
      .select('*')
      .eq('is_active', true)
      .order('template_type');

    if (error) throw error;

    return {
      status: 200,
      jsonBody: { templates: data },
    };
  } catch (error) {
    context.error('Get templates error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des templates' },
    };
  }
}

/**
 * GET /api/invoices/settings - Get reminder settings
 */
async function getSettings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const { data, error } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return {
      status: 200,
      jsonBody: { settings: data || null },
    };
  } catch (error) {
    context.error('Get settings error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des paramètres' },
    };
  }
}

/**
 * PUT /api/invoices/settings - Update reminder settings
 */
async function updateSettings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const settings = await request.json() as Record<string, unknown>;

    // Look up existing active record to reuse its id (prevents INSERT on every PUT)
    const { data: existing } = await supabase
      .from('reminder_settings')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    // Upsert settings — include id so Supabase updates the existing row instead of inserting
    const { data, error } = await supabase
      .from('reminder_settings')
      .upsert({
        ...settings,
        id: existing?.id || crypto.randomUUID(),
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      status: 200,
      jsonBody: { settings: data },
    };
  } catch (error) {
    context.error('Update settings error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la mise à jour des paramètres' },
    };
  }
}

/**
 * DELETE /api/invoices/{id} - Delete invoice
 */
async function deleteInvoice(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const invoiceId = request.params.id;

    const { error } = await supabase
      .from('unpaid_invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('created_by', userId);

    if (error) throw error;

    return {
      status: 200,
      jsonBody: { success: true, message: 'Facture supprimée' },
    };
  } catch (error) {
    context.error('Delete invoice error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la suppression' },
    };
  }
}

// Register endpoints
app.http('invoices-import', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invoices/import',
  handler: importInvoices,
});

app.http('invoices-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invoices',
  handler: listInvoices,
});

app.http('invoices-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invoices/{id}',
  handler: getInvoice,
});

app.http('invoices-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'invoices/{id}',
  handler: updateInvoice,
});

app.http('invoices-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'invoices/{id}',
  handler: deleteInvoice,
});

app.http('invoices-status', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invoices/{id}/status',
  handler: changeInvoiceStatus,
});

app.http('invoices-due', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invoices/due',
  handler: getDueInvoices,
});

app.http('invoices-remind', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invoices/{id}/remind',
  handler: sendReminder,
});

app.http('invoices-stats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invoices/stats',
  handler: getStats,
});

app.http('invoices-templates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invoices/templates',
  handler: getTemplates,
});

app.http('invoices-settings-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'invoices/settings',
  handler: getSettings,
});

app.http('invoices-settings-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'invoices/settings',
  handler: updateSettings,
});
