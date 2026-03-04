/**
 * API client for frontend
 *
 * All data calls go through the Next.js proxy at /api/azure/* so that:
 * - The HttpOnly lb_session cookie is read server-side (not document.cookie)
 * - The Azure Functions URL is never exposed to the browser
 * - No CORS issue: browser talks to same-origin Next.js, which calls Azure s2s
 *
 * Auth calls (/api/auth/*) go directly to the Next.js auth routes which
 * manage the session cookie natively.
 */

// Proxy base — all Azure data calls route through here
const AZURE_PROXY = '/api/azure';
// Auth base — handled natively by Next.js
const AUTH_BASE = '/api/auth';

// Types
export interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  preview: string;
  flag: {
    flagStatus: string;
  };
}

export interface Todo {
  id: string;
  handler_id: string;
  email_message_id?: string;
  email_subject?: string;
  email_sender?: string;
  email_received_at?: string;
  dossier_id?: string;
  dossier_name?: string;
  dossier_rg?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

// Fetch wrapper for Azure data calls (through /api/azure/* proxy)
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AZURE_PROXY}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // credentials: 'include' is implicit for same-origin, but explicit is fine
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Error ${response.status}`);
  }

  return response.json();
}

// Auth — handled by Next.js native routes, not the Azure proxy
export async function getCurrentUser(): Promise<User | null> {
  try {
    const data = await fetch(`${AUTH_BASE}/me`, { credentials: 'include' });
    if (!data.ok) return null;
    return data.json();
  } catch {
    return null;
  }
}

export function loginWithMicrosoft(redirect: string = '/dashboard/review') {
  window.location.href = `${AUTH_BASE}/login?redirect=${encodeURIComponent(redirect)}`;
}

export async function logout(): Promise<void> {
  await fetch(`${AUTH_BASE}/logout`, { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
}

// Folders
export async function getFolders(): Promise<MailFolder[]> {
  const data = await apiFetch<{ folders: MailFolder[] }>('/folders');
  return data.folders;
}

// Emails
export async function getEmails(folderId: string = 'inbox', skip = 0, top = 25): Promise<{
  emails: EmailMessage[];
  total: number;
}> {
  const params = new URLSearchParams({ folderId, skip: skip.toString(), top: top.toString() });
  return apiFetch(`/emails?${params}`);
}

// Todos
export async function getTodos(status?: string): Promise<Todo[]> {
  const params = status ? `?status=${status}` : '';
  const data = await apiFetch<{ todos: Todo[] }>(`/todos${params}`);
  return data.todos;
}

export async function createTodo(todo: Partial<Todo>): Promise<Todo> {
  const data = await apiFetch<{ todo: Todo }>('/todos', {
    method: 'POST',
    body: JSON.stringify(todo),
  });
  return data.todo;
}

export async function updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
  const data = await apiFetch<{ todo: Todo }>(`/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return data.todo;
}

export async function deleteTodo(id: string): Promise<void> {
  await apiFetch(`/todos/${id}`, { method: 'DELETE' });
}

// Create todo from email
export async function createTodoFromEmail(email: EmailMessage, title?: string): Promise<Todo> {
  return createTodo({
    title: title || `Traiter: ${email.subject}`,
    email_message_id: email.id,
    email_subject: email.subject,
    email_sender: email.from.email,
    email_received_at: email.receivedDateTime,
    priority: email.importance === 'high' ? 'high' : 'normal',
  });
}

// ============== Kleos Integration ==============

export interface KleosCase {
  id: number;
  name: string;
  reference: string;
  description?: string;
  typeName?: string;
  creationDate?: string;
  archived?: boolean;
}

export interface KleosContact {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  type?: 'N' | 'L';
  vatNumber?: string;
}

export interface KleosCaseType {
  id: number;
  name: string;
  defaultRegister?: number;
}

export interface KleosFolder {
  id: number;
  name: string;
  parentId?: number;
  caseId: number;
  children?: KleosFolder[];
}

export async function getKleosStatus(): Promise<{ configured: boolean; message: string }> {
  return apiFetch('/kleos/status');
}

export async function searchKleosCases(
  query: string,
  options: { page?: number; pageSize?: number; onlyOpen?: boolean } = {}
): Promise<{ cases: KleosCase[]; total: number }> {
  const params = new URLSearchParams({ q: query });
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.onlyOpen) params.set('onlyOpen', 'true');
  return apiFetch(`/kleos/cases?${params}`);
}

export async function getKleosCase(caseId: number): Promise<KleosCase> {
  const data = await apiFetch<{ case: KleosCase }>(`/kleos/cases/${caseId}`);
  return data.case;
}

export async function getKleosCaseTypes(): Promise<KleosCaseType[]> {
  const data = await apiFetch<{ caseTypes: KleosCaseType[] }>('/kleos/case-types');
  return data.caseTypes;
}

export async function searchKleosContacts(
  query: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ contacts: KleosContact[]; total: number }> {
  const params = new URLSearchParams({ q: query });
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  return apiFetch(`/kleos/contacts?${params}`);
}

export async function getKleosContact(contactId: number): Promise<KleosContact> {
  const data = await apiFetch<{ contact: KleosContact }>(`/kleos/contacts/${contactId}`);
  return data.contact;
}

export async function getKleosFolders(caseId: number, maxLevels: number = 3): Promise<KleosFolder[]> {
  const data = await apiFetch<{ folders: KleosFolder[] }>(
    `/kleos/cases/${caseId}/folders?maxLevels=${maxLevels}`
  );
  return data.folders;
}

// ============== Calendar & Tasks Sync ==============

export interface CalendarEvent {
  id: string;
  source: 'microsoft' | 'kleos';
  subject: string;
  body?: string;
  start: string;
  end: string;
  location?: string;
  isAllDay: boolean;
  attendees?: { name: string; email: string }[];
  categories?: string[];
  importance?: 'low' | 'normal' | 'high';
  caseId?: number;
  caseName?: string;
  caseReference?: string;
  linkedTodoId?: string;
}

export interface UnifiedTask {
  id: string;
  source: 'local' | 'microsoft' | 'kleos';
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  createdAt: string;
  caseId?: number;
  caseName?: string;
  caseReference?: string;
  linkedEventId?: string;
  emailMessageId?: string;
}

export interface UnifiedTimelineItem {
  type: 'event' | 'task';
  id: string;
  source: string;
  subject?: string;
  start?: string;
  end?: string;
  location?: string;
  isAllDay?: boolean;
  title?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  caseId?: number;
  caseName?: string;
  caseReference?: string;
}

export async function getCalendarEvents(options: {
  startDate?: string;
  endDate?: string;
} = {}): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  const data = await apiFetch<{ events: CalendarEvent[] }>(`/calendar/events?${params}`);
  return data.events;
}

export async function getMicrosoftTasks(includeCompleted = false): Promise<UnifiedTask[]> {
  const params = new URLSearchParams();
  if (includeCompleted) params.set('includeCompleted', 'true');
  const data = await apiFetch<{ tasks: UnifiedTask[] }>(`/calendar/tasks?${params}`);
  return data.tasks;
}

export async function getCalendars(): Promise<{ id: string; name: string; color: string }[]> {
  const data = await apiFetch<{ calendars: { id: string; name: string; color: string }[] }>('/calendar/calendars');
  return data.calendars;
}

export async function getUnifiedTimeline(options: {
  startDate?: string;
  endDate?: string;
} = {}): Promise<{
  timeline: UnifiedTimelineItem[];
  stats: { events: number; microsoftTasks: number; localTodos: number; total: number };
}> {
  const params = new URLSearchParams();
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  return apiFetch(`/calendar/unified?${params}`);
}

export async function createCalendarEvent(event: {
  subject: string;
  body?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: { email: string; name?: string }[];
  isAllDay?: boolean;
}): Promise<{ eventId: string }> {
  return apiFetch('/calendar/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function createMicrosoftTask(task: {
  title: string;
  body?: string;
  dueDate?: string;
  importance?: 'low' | 'normal' | 'high';
}): Promise<{ taskId: string }> {
  return apiFetch('/calendar/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}
