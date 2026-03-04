import type { MatchLog, PipelineRun, SenderHistoryEntry, PipelineStats, MatchLogFilters, AccuracyStats, UserPreferences, DraftReplyResult, ActivityLog } from '@/types/pipeline';

async function pipelineFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/pipeline${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function getPipelineRuns(params?: { limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set('limit', String(params.limit));
  return pipelineFetch<{ runs: PipelineRun[]; total: number }>(`/runs?${sp}`);
}

export async function getMatchLogs(filters: MatchLogFilters) {
  const sp = new URLSearchParams();
  // mailbox is enforced server-side from the session — never sent by the client
  if (filters.matched !== undefined) sp.set('matched', String(filters.matched));
  if (filters.confidence_min !== undefined) sp.set('confidence_min', String(filters.confidence_min));
  if (filters.confidence_max !== undefined) sp.set('confidence_max', String(filters.confidence_max));
  if (filters.source) sp.set('source', filters.source);
  if (filters.handler) sp.set('handler', filters.handler);
  if (filters.date_from) sp.set('date_from', filters.date_from);
  if (filters.date_to) sp.set('date_to', filters.date_to);
  if (filters.reviewed) sp.set('reviewed', filters.reviewed);
  if (filters.category) sp.set('category', filters.category);
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.per_page) sp.set('per_page', String(filters.per_page));
  return pipelineFetch<{ matches: MatchLog[]; total: number; page: number; per_page: number }>(`/matches?${sp}`);
}

export async function reviewMatch(id: string, approved: boolean) {
  return pipelineFetch<{ match: MatchLog }>(`/matches/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ approved }),
  });
}

export async function getSenderHistory(params?: { minCount?: number; limit?: number; search?: string }) {
  const sp = new URLSearchParams();
  if (params?.minCount) sp.set('min_count', String(params.minCount));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.search) sp.set('search', params.search);
  return pipelineFetch<{ senders: SenderHistoryEntry[]; total: number }>(`/senders?${sp}`);
}

export async function getPipelineStats(params?: { days?: number }) {
  const sp = new URLSearchParams();
  if (params?.days) sp.set('days', String(params.days));
  // mailbox is enforced server-side from the session — never sent by the client
  return pipelineFetch<PipelineStats>(`/stats?${sp}`);
}

export async function getAccuracyStats(params?: { days?: number }) {
  const sp = new URLSearchParams();
  if (params?.days) sp.set('days', String(params.days));
  // mailbox is enforced server-side from the session — never sent by the client
  return pipelineFetch<AccuracyStats>(`/accuracy?${sp}`);
}

export async function getUserPreferences() {
  return pipelineFetch<{ preferences: UserPreferences | null }>('/preferences');
}

export async function saveUserPreferences(prefs: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'email'>>) {
  // user_id and email are derived from the session server-side — never sent by the client
  return pipelineFetch<{ preferences: UserPreferences }>('/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
}

export async function generateDraftReply(matchId: string) {
  return pipelineFetch<DraftReplyResult>('/draft-reply', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  });
}

export async function getActivityLogs(params?: { page?: number; per_page?: number }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.per_page) sp.set('per_page', String(params.per_page));
  // user_id is enforced server-side from the session
  return pipelineFetch<{ logs: ActivityLog[]; total: number; page: number; per_page: number }>(`/activity?${sp}`);
}
