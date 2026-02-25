/**
 * Kleos API Client
 *
 * Integrates with Wolters Kluwer Kleos law firm management system.
 * Uses OAuth2 Client Credentials flow for authentication.
 */

const KLEOS_API_BASE = 'https://kleosapp.api.wolterskluwer.cloud';
const KLEOS_TOKEN_URL = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';

// Kleos credentials from environment
const KLEOS_CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const KLEOS_CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth2 access token using Client Credentials flow
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  if (!KLEOS_CLIENT_ID || !KLEOS_CLIENT_SECRET) {
    throw new Error('Kleos credentials not configured');
  }

  const response = await fetch(KLEOS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: KLEOS_CLIENT_ID,
      client_secret: KLEOS_CLIENT_SECRET,
      scope: 'kleosStateful kleosLegal kleosLegalApiClient',
      // Note: All 3 scopes required. If auth fails, check that the service account has API access enabled.
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kleos auth failed: ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

/**
 * Make authenticated request to Kleos API
 */
async function kleosRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${KLEOS_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kleos API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}

// ============== Types ==============

export interface KleosCase {
  id: number;
  name: string;
  reference: string;
  description?: string;
  typeName?: string;
  creationDate?: string;
  archived?: boolean;
}

export interface KleosIdentity {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  type?: 'N' | 'L'; // Natural or Legal
  vatNumber?: string;
}

export interface KleosDocumentFolder {
  id: number;
  name: string;
  parentId?: number;
  caseId: number;
  children?: KleosDocumentFolder[];
}

export interface KleosCaseType {
  id: number;
  name: string;
  defaultRegister?: number;
}

interface KleosPagedResponse<T> {
  success: boolean;
  result: {
    items: T[];
    totalCount: number;
    currentPage: number;
  };
}

interface KleosSingleResponse<T> {
  success: boolean;
  result: T;
}

interface KleosListResponse<T> {
  success: boolean;
  result: T[];
}

// ============== API Functions ==============

/**
 * Search for cases (dossiers) in Kleos
 */
export async function searchCases(
  query: string,
  options: { page?: number; pageSize?: number; onlyOpen?: boolean } = {}
): Promise<{ cases: KleosCase[]; total: number }> {
  const params = new URLSearchParams({
    search: query,
    currentPage: String(options.page || 1),
    pageSize: String(options.pageSize || 20),
  });

  if (options.onlyOpen !== undefined) {
    params.set('onlyOpen', String(options.onlyOpen));
  }

  const response = await kleosRequest<KleosPagedResponse<KleosCase>>(
    `/api/cases?${params}`
  );

  return {
    cases: response.result.items || [],
    total: response.result.totalCount,
  };
}

/**
 * Get case details by ID
 */
export async function getCase(caseId: number): Promise<KleosCase | null> {
  try {
    const response = await kleosRequest<KleosSingleResponse<KleosCase>>(
      `/api/cases/${caseId}`
    );
    return response.result;
  } catch {
    return null;
  }
}

/**
 * Get all case types
 */
export async function getCaseTypes(
  options: { page?: number; pageSize?: number } = {}
): Promise<KleosCaseType[]> {
  const params = new URLSearchParams({
    currentPage: String(options.page || 1),
    pageSize: String(options.pageSize || 100),
  });

  const response = await kleosRequest<KleosPagedResponse<KleosCaseType>>(
    `/api/caseTypes?${params}`
  );

  return response.result.items || [];
}

/**
 * Search for contacts/identities in Kleos
 */
export async function searchContacts(
  query: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ contacts: KleosIdentity[]; total: number }> {
  const params = new URLSearchParams({
    search: query,
    currentPage: String(options.page || 1),
    pageSize: String(options.pageSize || 20),
  });

  const response = await kleosRequest<KleosPagedResponse<KleosIdentity>>(
    `/api/contacts?${params}`
  );

  return {
    contacts: response.result.items || [],
    total: response.result.totalCount,
  };
}

/**
 * Get contact details by ID
 */
export async function getContact(contactId: number): Promise<KleosIdentity | null> {
  try {
    const response = await kleosRequest<KleosSingleResponse<KleosIdentity>>(
      `/api/contacts/${contactId}`
    );
    return response.result;
  } catch {
    return null;
  }
}

/**
 * Get document folders for a case
 */
export async function getDocumentFolders(
  caseId: number,
  maxLevels?: number
): Promise<KleosDocumentFolder[]> {
  const params = maxLevels ? `?maxLevels=${maxLevels}` : '';

  const response = await kleosRequest<KleosListResponse<KleosDocumentFolder>>(
    `/api/documentfolders/${caseId}${params}`
  );

  return response.result || [];
}

/**
 * Upload a document to Kleos
 */
export async function uploadDocument(
  caseId: number,
  folderId: number | undefined,
  file: {
    content: Buffer;
    filename: string;
    mimeType: string;
  },
  metadata: {
    title: string;
    description?: string;
    readOnly?: boolean;
  }
): Promise<number> {
  const token = await getAccessToken();

  // Create form data
  const formData = new FormData();

  // Add document metadata as JSON
  const documentDto = {
    id: 0,
    title: metadata.title,
    description: metadata.description || '',
    caseId: caseId,
    folderId: folderId || 0,
    readOnly: metadata.readOnly || false,
  };

  formData.append('document', JSON.stringify(documentDto));

  // Add file content
  const blob = new Blob([file.content], { type: file.mimeType });
  formData.append('Content', blob, file.filename);

  const response = await fetch(`${KLEOS_API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Document upload failed: ${error}`);
  }

  const result = await response.json() as { result: number };
  return result.result; // Returns document ID
}

/**
 * Get cases where a contact is involved as a party
 */
export async function getCasesByContact(
  contactId: number,
  onlyOpen: boolean = false
): Promise<KleosCase[]> {
  const params = new URLSearchParams({
    identityId: String(contactId),
    onlyOpen: String(onlyOpen),
  });

  const response = await kleosRequest<KleosSingleResponse<{
    partyDetails: Record<string, { caseName: string; caseReference: string }[]>;
  }>>(`/api/cases/getCasesByInvolvedParty?${params}`);

  // Flatten the party details into a list of cases
  const cases: KleosCase[] = [];
  const partyDetails = response.result.partyDetails || {};

  for (const partyType in partyDetails) {
    for (const detail of partyDetails[partyType]) {
      cases.push({
        id: 0, // ID not available in this endpoint
        name: detail.caseName,
        reference: detail.caseReference,
      });
    }
  }

  return cases;
}

/**
 * Check if Kleos integration is configured
 */
export function isKleosConfigured(): boolean {
  return !!(KLEOS_CLIENT_ID && KLEOS_CLIENT_SECRET);
}

// ============== Billing / Export ==============

export interface KleosBillingItem {
  id: number;
  caseId?: number;
  caseName?: string;
  caseReference?: string;
  identityId?: number;
  identityName?: string;
  description?: string;
  amount?: number;
  quantity?: number;
  unitPrice?: number;
  date?: string;
  billingStatus?: string;  // 'NotBilled', 'Billed', 'ManuallyBilled'
  invoiceNumber?: string;
  invoiceDate?: string;
  // Additional fields that may be returned
  [key: string]: unknown;
}

/**
 * Get billing items (timesheets/prestations) within a date range
 * This is the closest we have to an invoice export
 */
export async function getBillingItems(
  startDate: Date,
  endDate: Date
): Promise<KleosBillingItem[]> {
  const params = new URLSearchParams({
    utcStarDate: startDate.toISOString(),
    utcEndDate: endDate.toISOString(),
  });

  const response = await kleosRequest<{ result: KleosBillingItem[] }>(
    `/api/Billing/GetActionsAndBillingItems?${params}`
  );

  return response.result || [];
}

/**
 * Mark billing items as manually billed
 */
export async function markItemsAsBilled(itemIds: number[]): Promise<void> {
  await kleosRequest<{ success: boolean }>(
    '/api/Billing/SetBillingItemsAsBilled',
    {
      method: 'POST',
      body: JSON.stringify(itemIds),
    }
  );
}

/**
 * Get deleted billing item IDs within a date range
 * Useful for syncing/reconciliation
 */
export async function getDeletedBillingItemIds(
  startDate: Date,
  endDate: Date
): Promise<number[]> {
  const params = new URLSearchParams({
    utcStarDate: startDate.toISOString(),
    utcEndDate: endDate.toISOString(),
  });

  const response = await kleosRequest<{ result: number[] }>(
    `/api/Billing/GetDeletedBillingItemIDs?${params}`
  );

  return response.result || [];
}
