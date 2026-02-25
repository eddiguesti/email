/**
 * Kleos API Client
 *
 * Integrates with Wolters Kluwer Kleos (kleosapp.api.wolterskluwer.cloud).
 * Uses OAuth2 Client Credentials flow via the Kleos Identity Server.
 */

import type {
  KleosDossier,
  KleosDocument,
  KleosFolder,
  KleosSearchQuery,
  KleosSearchResult,
  KleosCreateDocumentRequest,
  KleosCreateDocumentResponse,
  KleosCreateFolderRequest,
  KleosClientConfig,
  KleosApiResponse,
} from '../types/kleos.js';

const KLEOS_API_BASE = 'https://kleosapp.api.wolterskluwer.cloud';
const KLEOS_TOKEN_URL = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';

// Real Kleos API response shapes
interface KleosPagedResult<T> {
  success: boolean;
  result: { items: T[]; totalCount: number; currentPage: number };
}
interface KleosSingleResult<T> {
  success: boolean;
  result: T;
}
interface KleosListResult<T> {
  success: boolean;
  result: T[];
}

interface KleosRawCase {
  id: number;
  name: string;
  reference: string;
  description?: string;
  typeName?: string;
  creationDate?: string;
  archived?: boolean;
}

interface KleosRawFolder {
  id: number;
  name: string;
  parentId?: number;
  caseId: number;
}

export class KleosClient {
  private clientId?: string;
  private clientSecret?: string;
  private timeout: number;
  private retryCount: number;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(config: KleosClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.timeout = config.timeout ?? 30000;
    this.retryCount = config.retryCount ?? 3;
  }

  // ============= Private Helpers =============

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (5-min buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 300000) {
      return this.cachedToken.token;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Kleos credentials not configured (KLEOS_CLIENT_ID / KLEOS_CLIENT_SECRET)');
    }

    const response = await fetch(KLEOS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'kleosStateful kleosLegal kleosLegalApiClient',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kleos auth failed: ${error}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.cachedToken.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isFormData = false
  ): Promise<KleosApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const token = await this.getAccessToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        };
        if (!isFormData) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${KLEOS_API_BASE}${path}`, {
          method,
          headers,
          body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData: { message?: string } = {};
          try { errorData = JSON.parse(errorText); } catch { errorData = { message: errorText }; }

          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error: { code: `HTTP_${response.status}`, message: errorData.message || response.statusText },
            };
          }
          throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data: data as T };
      } catch (error) {
        lastError = error as Error;
        if ((error as Error).name === 'AbortError') break;
        if (attempt < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    return {
      success: false,
      error: { code: 'REQUEST_FAILED', message: lastError?.message || 'Request failed after retries' },
    };
  }

  // ============= Dossier Operations =============

  async searchDossiers(query: KleosSearchQuery): Promise<KleosApiResponse<KleosSearchResult>> {
    const params = new URLSearchParams();
    const searchTerm = query.reference || query.query || query.clientName || '';
    if (searchTerm) params.set('search', searchTerm);
    params.set('currentPage', String(Math.floor((query.offset || 0) / (query.limit || 20)) + 1));
    params.set('pageSize', String(query.limit || 20));

    const result = await this.request<KleosPagedResult<KleosRawCase>>(
      'GET',
      `/api/cases?${params.toString()}`
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const items = result.data.result?.items || [];
    const total = result.data.result?.totalCount || 0;

    return {
      success: true,
      data: {
        dossiers: items.map(mapCaseToDossier),
        total,
        hasMore: items.length < total,
      },
    };
  }

  async getDossier(dossierId: string): Promise<KleosApiResponse<KleosDossier>> {
    const result = await this.request<KleosSingleResult<KleosRawCase>>(
      'GET',
      `/api/cases/${dossierId}`
    );

    if (!result.success || !result.data?.result) {
      return { success: false, error: result.error };
    }

    return { success: true, data: mapCaseToDossier(result.data.result) };
  }

  async searchByRgNumber(rgNumber: string): Promise<KleosApiResponse<KleosSearchResult>> {
    return this.searchDossiers({ reference: rgNumber });
  }

  // ============= Document Operations =============

  async createDocument(
    request: KleosCreateDocumentRequest
  ): Promise<KleosApiResponse<KleosCreateDocumentResponse>> {
    const token = await this.getAccessToken();
    const caseId = parseInt(request.dossierId, 10);
    const folderId = request.folderId ? parseInt(request.folderId, 10) : 0;

    const formData = new FormData();
    formData.append('document', JSON.stringify({
      id: 0,
      title: request.name,
      description: request.description || '',
      caseId,
      folderId,
      readOnly: false,
    }));

    const fileContent =
      typeof request.file.content === 'string'
        ? new Blob([Buffer.from(request.file.content, 'base64')], { type: request.file.mimeType })
        : new Blob([request.file.content], { type: request.file.mimeType });

    formData.append('Content', fileContent, request.file.originalName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${KLEOS_API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        return { success: false, data: { success: false, error } };
      }

      const result = await response.json() as { result: number };

      return {
        success: true,
        data: {
          success: true,
          document: {
            id: String(result.result),
            dossierId: request.dossierId,
            name: request.name,
            documentType: request.documentType,
            mimeType: request.file.mimeType,
            size: 0,
            sourceType: request.sourceType,
            sourceMessageId: request.sourceMessageId,
            sourceEmailSubject: request.sourceEmailSubject,
            sourceEmailDate: request.sourceEmailDate,
            sourceEmailSender: request.sourceEmailSender,
            contentHash: request.contentHash,
            createdAt: new Date().toISOString(),
            createdBy: 'lb-bot',
            version: 1,
          },
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return { success: false, data: { success: false, error: (error as Error).message } };
    }
  }

  async findDocumentByHash(
    _dossierId: string,
    _contentHash: string
  ): Promise<KleosApiResponse<KleosDocument | null>> {
    // Kleos API does not expose a content-hash lookup — always upload fresh
    return { success: true, data: null };
  }

  async getDossierDocuments(
    _dossierId: string,
    _options?: { folderId?: string; limit?: number; offset?: number }
  ): Promise<KleosApiResponse<{ documents: KleosDocument[]; total: number }>> {
    return { success: true, data: { documents: [], total: 0 } };
  }

  // ============= Folder Operations =============

  async getDossierFolders(dossierId: string): Promise<KleosApiResponse<KleosFolder[]>> {
    const result = await this.request<KleosListResult<KleosRawFolder>>(
      'GET',
      `/api/documentfolders/${dossierId}`
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: (result.data.result || []).map(f => mapFolderToShared(f, dossierId)),
    };
  }

  async createFolder(
    _request: KleosCreateFolderRequest
  ): Promise<KleosApiResponse<KleosFolder>> {
    // Kleos does not expose a folder-creation endpoint via the public API
    return {
      success: false,
      error: { code: 'NOT_SUPPORTED', message: 'Folder creation is not supported via the Kleos API' },
    };
  }

  async findOrCreateFolder(
    dossierId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<KleosApiResponse<KleosFolder>> {
    const foldersResult = await this.getDossierFolders(dossierId);

    if (foldersResult.success && foldersResult.data) {
      const existing = foldersResult.data.find(
        f => f.name === folderName && f.parentFolderId === parentFolderId
      );
      if (existing) {
        return { success: true, data: existing };
      }
    }

    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `Folder "${folderName}" not found in dossier ${dossierId}` },
    };
  }

  // ============= Health Check =============

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.request<KleosPagedResult<KleosRawCase>>(
        'GET',
        '/api/cases?currentPage=1&pageSize=1'
      );
      return result.success;
    } catch {
      return false;
    }
  }
}

// ============= Mapping Helpers =============

function mapCaseToDossier(c: KleosRawCase): KleosDossier {
  return {
    id: String(c.id),
    reference: c.reference || '',
    name: c.name || '',
    description: c.description,
    clientId: '',
    clientName: '',
    status: c.archived ? 'archived' : 'active',
    createdAt: c.creationDate || new Date().toISOString(),
    updatedAt: c.creationDate || new Date().toISOString(),
  };
}

function mapFolderToShared(f: KleosRawFolder, dossierId: string): KleosFolder {
  return {
    id: String(f.id),
    dossierId,
    name: f.name,
    parentFolderId: f.parentId ? String(f.parentId) : undefined,
    path: f.name,
    documentCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a Kleos client from environment variables
 */
export function createKleosClientFromEnv(): KleosClient {
  return new KleosClient({
    clientId: process.env.KLEOS_CLIENT_ID,
    clientSecret: process.env.KLEOS_CLIENT_SECRET,
    timeout: parseInt(process.env.KLEOS_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.KLEOS_RETRY_COUNT || '3', 10),
  });
}
