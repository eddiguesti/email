import { create } from 'zustand';
import { colorCodeEmailByStatus, applyEmailCategory } from '../utils/outlook-categories';

// Types from shared package (simplified for add-in)
interface MatchResult {
  dossierId: string;
  dossierName: string;
  dossierRef: string;
  confidence: number;
  reasons: string[];
  source: string;
}

interface AttachmentInfo {
  id: string;
  name: string;
  contentType: string;
  size: number;
  filed: boolean;
}

interface DraftInfo {
  id: string;
  type: string;
  subject: string;
  body: string;
  to: string[];
  createdAt: string;
  insertedAt?: string;
}

interface ProcessingStatus {
  found: boolean;
  record?: {
    status: string;
    chosenDossierId?: string;
    chosenDossierName?: string;
    userApproved: boolean;
  };
  suggestedDossier?: MatchResult;
  alternativeDossiers?: MatchResult[];
  attachments?: AttachmentInfo[];
  drafts?: DraftInfo[];
  canAutoFile: boolean;
  canAutoSend: boolean;
  autoSendBlocked?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    messageId: string;
    subject: string;
    sender: string;
    date: string;
    excerpt: string;
  }>;
  timestamp: Date;
}

interface KleosSearchResult {
  dossierId: string;
  dossierName: string;
  dossierRef: string;
}

interface Store {
  // Status
  status: ProcessingStatus | null;
  loading: boolean;
  error: string | null;

  // Chat
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  // Actions
  fetchStatus: (mailbox: string, messageId: string) => Promise<void>;
  approveDossier: (mailbox: string, messageId: string, dossier: MatchResult) => Promise<void>;
  fileToKleos: (mailbox: string, messageId: string, dossierId: string, attachmentIds: string[]) => Promise<void>;
  generateDrafts: (mailbox: string, messageId: string, types: string[]) => Promise<void>;
  insertDraft: (mailbox: string, messageId: string, draftId: string) => Promise<void>;
  moveToFolder: (mailbox: string, messageId: string, folderName: string) => Promise<void>;
  sendChatMessage: (mailbox: string, query: string) => Promise<void>;
  clearChat: () => void;
  searchKleos: (query: string) => Promise<KleosSearchResult[]>;
}

// API requests are routed through the Next.js web app proxy at the production
// domain. The proxy adds the Azure Functions key server-side, so no secret is
// ever shipped in this client bundle.
//
// Development: set VITE_API_BASE_URL=http://localhost:3001/api/addin in your
// .env.local so the dev Vite server proxies through to the local Next.js app.
// Do NOT fall back to direct Azure Function URLs here — that would re-expose
// the key in the bundle.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'https://app.laurencebrosset-avocats.fr/api/addin';

async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // No x-functions-key header here. Authentication is handled server-side by
  // the Next.js proxy route so the Azure Functions key is never exposed in the
  // client bundle.

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const useStore = create<Store>((set, get) => ({
  status: null,
  loading: false,
  error: null,
  chatMessages: [],
  chatLoading: false,

  fetchStatus: async (mailbox: string, messageId: string) => {
    set({ loading: true, error: null });
    try {
      const status = await apiRequest<ProcessingStatus>(
        `/status/${encodeURIComponent(mailbox)}/${encodeURIComponent(messageId)}`
      );
      set({ status, loading: false });
      colorCodeEmailByStatus(status);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch status',
        loading: false,
      });
    }
  },

  approveDossier: async (mailbox: string, messageId: string, dossier: MatchResult) => {
    set({ loading: true, error: null });
    try {
      await apiRequest('/approve', 'POST', {
        mailbox,
        messageId,
        dossierId: dossier.dossierId,
        dossierName: dossier.dossierName,
        dossierRef: dossier.dossierRef,
        saveAsThreadDefault: true,
      });

      // Apply orange "À revoir" category immediately, then refresh (fetchStatus will re-apply)
      applyEmailCategory('LB - À revoir');

      // Refresh status
      await get().fetchStatus(mailbox, messageId);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to approve dossier',
        loading: false,
      });
    }
  },

  fileToKleos: async (mailbox: string, messageId: string, dossierId: string, attachmentIds: string[]) => {
    set({ loading: true, error: null });
    try {
      await apiRequest('/file', 'POST', {
        mailbox,
        messageId,
        dossierId,
        fileEmail: true,
        fileAttachments: attachmentIds,
      });

      // Refresh status
      await get().fetchStatus(mailbox, messageId);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to file to Kleos',
        loading: false,
      });
    }
  },

  generateDrafts: async (mailbox: string, messageId: string, types: string[]) => {
    set({ loading: true, error: null });
    try {
      await apiRequest('/drafts/generate', 'POST', {
        mailbox,
        messageId,
        draftTypes: types,
      });

      // Refresh status
      await get().fetchStatus(mailbox, messageId);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to generate drafts',
        loading: false,
      });
    }
  },

  insertDraft: async (mailbox: string, messageId: string, draftId: string) => {
    set({ loading: true, error: null });
    try {
      const result = await apiRequest<{ outlookDraftId: string }>('/drafts/insert', 'POST', {
        mailbox,
        messageId,
        draftId,
      });

      // Open the draft in Outlook
      if (result.outlookDraftId) {
        Office.context.mailbox.displayMessageForm(result.outlookDraftId);
      }

      set({ loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to insert draft',
        loading: false,
      });
    }
  },

  moveToFolder: async (mailbox: string, messageId: string, folderName: string) => {
    set({ loading: true, error: null });
    try {
      await apiRequest('/move-to-folder', 'POST', { mailbox, messageId, folderName });
      set({ loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to move email',
        loading: false,
      });
    }
  },

  sendChatMessage: async (mailbox: string, query: string) => {
    const { chatMessages } = get();

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    set({
      chatMessages: [...chatMessages, userMessage],
      chatLoading: true,
    });

    try {
      const response = await apiRequest<{
        answer: string;
        citations: Array<{
          messageId: string;
          subject: string;
          sender: string;
          date: string;
          excerpt: string;
        }>;
      }>('/chat', 'POST', {
        query,
        mailbox,
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        timestamp: new Date(),
      };

      set({
        chatMessages: [...get().chatMessages, assistantMessage],
        chatLoading: false,
      });
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: new Date(),
      };

      set({
        chatMessages: [...get().chatMessages, errorMessage],
        chatLoading: false,
      });
    }
  },

  clearChat: () => {
    set({ chatMessages: [] });
  },

  searchKleos: async (query: string): Promise<KleosSearchResult[]> => {
    if (!query.trim()) return [];
    const data = await apiRequest<{ cases: Array<{ id: number; name: string; reference: string }> }>(
      `/kleos/cases?search=${encodeURIComponent(query)}&pageSize=10`
    );
    return (data.cases || []).map(c => ({
      dossierId: String(c.id),
      dossierName: c.name,
      dossierRef: c.reference,
    }));
  },
}));
