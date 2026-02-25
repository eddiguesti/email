/**
 * Kleos Integration API Endpoints
 *
 * Provides access to Kleos law firm management system.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  searchCases,
  getCase,
  searchContacts,
  getContact,
  getDocumentFolders,
  getCaseTypes,
  isKleosConfigured,
  getBillingItems,
  markItemsAsBilled,
  KleosCase,
  KleosBillingItem,
} from '../services/kleos-client.js';
import { getUserIdFromRequest } from '../utils/auth.js';

/**
 * GET /api/kleos/status - Check Kleos integration status
 */
async function kleosStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  return {
    status: 200,
    jsonBody: {
      configured: isKleosConfigured(),
      message: isKleosConfigured()
        ? 'Kleos est connecté'
        : 'Kleos nécessite une configuration',
    },
  };
}

/**
 * GET /api/kleos/health - Test Kleos connection with real API call
 */
async function kleosHealth(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return {
      status: 503,
      jsonBody: {
        healthy: false,
        error: 'Kleos non configuré - KLEOS_CLIENT_ID et KLEOS_CLIENT_SECRET requis',
      },
    };
  }

  try {
    // Test connection by fetching case types (lightweight call)
    const startTime = Date.now();
    const caseTypes = await getCaseTypes({ page: 1, pageSize: 1 });
    const latencyMs = Date.now() - startTime;

    return {
      status: 200,
      jsonBody: {
        healthy: true,
        latencyMs,
        message: 'Connexion Kleos réussie',
        caseTypesCount: caseTypes.length,
      },
    };
  } catch (error) {
    context.error('Kleos health check failed:', error);
    return {
      status: 503,
      jsonBody: {
        healthy: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion Kleos',
      },
    };
  }
}

/**
 * GET /api/kleos/cases - Search for cases
 */
async function searchKleosCases(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const query = request.query.get('q') || '';
    const page = parseInt(request.query.get('page') || '1');
    const pageSize = parseInt(request.query.get('pageSize') || '20');
    const onlyOpen = request.query.get('onlyOpen') === 'true';

    const { cases, total } = await searchCases(query, { page, pageSize, onlyOpen });

    return {
      status: 200,
      jsonBody: { cases, total, page, pageSize },
    };
  } catch (error) {
    context.error('Kleos case search error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la recherche de dossiers' },
    };
  }
}

/**
 * GET /api/kleos/cases/{id} - Get case details
 */
async function getKleosCase(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const caseId = parseInt(request.params.id || '0');
    if (!caseId) {
      return { status: 400, jsonBody: { error: 'ID de dossier requis' } };
    }

    const dossier = await getCase(caseId);
    if (!dossier) {
      return { status: 404, jsonBody: { error: 'Dossier non trouvé' } };
    }

    return { status: 200, jsonBody: { case: dossier } };
  } catch (error) {
    context.error('Kleos get case error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération du dossier' },
    };
  }
}

/**
 * GET /api/kleos/case-types - Get all case types
 */
async function getKleosCaseTypes(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const caseTypes = await getCaseTypes();
    return { status: 200, jsonBody: { caseTypes } };
  } catch (error) {
    context.error('Kleos case types error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des types de dossiers' },
    };
  }
}

/**
 * GET /api/kleos/contacts - Search for contacts
 */
async function searchKleosContacts(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const query = request.query.get('q') || '';
    const page = parseInt(request.query.get('page') || '1');
    const pageSize = parseInt(request.query.get('pageSize') || '20');

    const { contacts, total } = await searchContacts(query, { page, pageSize });

    return {
      status: 200,
      jsonBody: { contacts, total, page, pageSize },
    };
  } catch (error) {
    context.error('Kleos contact search error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la recherche de contacts' },
    };
  }
}

/**
 * GET /api/kleos/contacts/{id} - Get contact details
 */
async function getKleosContact(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const contactId = parseInt(request.params.id || '0');
    if (!contactId) {
      return { status: 400, jsonBody: { error: 'ID de contact requis' } };
    }

    const contact = await getContact(contactId);
    if (!contact) {
      return { status: 404, jsonBody: { error: 'Contact non trouvé' } };
    }

    return { status: 200, jsonBody: { contact } };
  } catch (error) {
    context.error('Kleos get contact error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération du contact' },
    };
  }
}

/**
 * GET /api/kleos/cases/{id}/folders - Get document folders for a case
 */
async function getKleosFolders(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const caseId = parseInt(request.params.id || '0');
    if (!caseId) {
      return { status: 400, jsonBody: { error: 'ID de dossier requis' } };
    }

    const maxLevels = parseInt(request.query.get('maxLevels') || '3');
    const folders = await getDocumentFolders(caseId, maxLevels);

    return { status: 200, jsonBody: { folders } };
  } catch (error) {
    context.error('Kleos folders error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des dossiers' },
    };
  }
}

// Register endpoints
app.http('kleos-status', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/status',
  handler: kleosStatus,
});

app.http('kleos-health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/health',
  handler: kleosHealth,
});

app.http('kleos-search-cases', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/cases',
  handler: searchKleosCases,
});

app.http('kleos-get-case', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/cases/{id}',
  handler: getKleosCase,
});

app.http('kleos-case-types', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/case-types',
  handler: getKleosCaseTypes,
});

app.http('kleos-search-contacts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/contacts',
  handler: searchKleosContacts,
});

app.http('kleos-get-contact', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/contacts/{id}',
  handler: getKleosContact,
});

app.http('kleos-get-folders', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/cases/{id}/folders',
  handler: getKleosFolders,
});

/**
 * GET /api/kleos/billing - Get billing items (timesheets/prestations)
 * Query params:
 *   - startDate: ISO date string (default: 1 year ago)
 *   - endDate: ISO date string (default: today)
 *   - status: filter by billing status (NotBilled, Billed, ManuallyBilled)
 */
async function getKleosBilling(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    // Parse date range (default: last year)
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setFullYear(defaultStart.getFullYear() - 1);

    const startDateParam = request.query.get('startDate');
    const endDateParam = request.query.get('endDate');
    const statusFilter = request.query.get('status');

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : now;

    // Fetch billing items from Kleos
    let items = await getBillingItems(startDate, endDate);

    // Filter by status if requested
    if (statusFilter) {
      items = items.filter(item => item.billingStatus === statusFilter);
    }

    // Group by status for summary
    const summary = {
      total: items.length,
      notBilled: items.filter(i => i.billingStatus === 'NotBilled').length,
      billed: items.filter(i => i.billingStatus === 'Billed').length,
      manuallyBilled: items.filter(i => i.billingStatus === 'ManuallyBilled').length,
      totalAmount: items.reduce((sum, i) => sum + (i.amount || 0), 0),
    };

    return {
      status: 200,
      jsonBody: {
        items,
        summary,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    };
  } catch (error) {
    context.error('Kleos billing fetch error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la récupération des prestations' },
    };
  }
}

/**
 * POST /api/kleos/billing/mark-billed - Mark items as manually billed
 */
async function markKleosBillingAsBilled(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  if (!isKleosConfigured()) {
    return { status: 503, jsonBody: { error: 'Kleos non configuré' } };
  }

  try {
    const body = await request.json() as { itemIds: number[] };

    if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
      return { status: 400, jsonBody: { error: 'itemIds requis (array de nombres)' } };
    }

    await markItemsAsBilled(body.itemIds);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `${body.itemIds.length} élément(s) marqué(s) comme facturé(s)`,
      },
    };
  } catch (error) {
    context.error('Kleos mark billed error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors du marquage des prestations' },
    };
  }
}

app.http('kleos-get-billing', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'kleos/billing',
  handler: getKleosBilling,
});

app.http('kleos-mark-billed', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'kleos/billing/mark-billed',
  handler: markKleosBillingAsBilled,
});
