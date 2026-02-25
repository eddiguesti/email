/**
 * Input Validation Utilities
 *
 * Centralized validation for API inputs.
 */

// Types for validation results
export type ValidationResult<T> = {
  valid: true;
  data: T;
} | {
  valid: false;
  errors: string[];
};

// Todo input validation
export interface TodoInput {
  title: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  email_message_id?: string;
  email_subject?: string;
  email_sender?: string;
  email_received_at?: string;
  dossier_id?: string;
  dossier_name?: string;
  dossier_rg?: string;
}

const VALID_TODO_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
const VALID_TODO_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export function validateTodoInput(input: unknown): ValidationResult<TodoInput> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Invalid input'] };
  }

  const data = input as Record<string, unknown>;

  // Title is required
  if (!data.title || typeof data.title !== 'string') {
    errors.push('Title is required and must be a string');
  } else if (data.title.length > 500) {
    errors.push('Title must be 500 characters or less');
  }

  // Status validation
  if (data.status !== undefined) {
    if (!VALID_TODO_STATUSES.includes(data.status as typeof VALID_TODO_STATUSES[number])) {
      errors.push(`Status must be one of: ${VALID_TODO_STATUSES.join(', ')}`);
    }
  }

  // Priority validation
  if (data.priority !== undefined) {
    if (!VALID_TODO_PRIORITIES.includes(data.priority as typeof VALID_TODO_PRIORITIES[number])) {
      errors.push(`Priority must be one of: ${VALID_TODO_PRIORITIES.join(', ')}`);
    }
  }

  // Due date validation
  if (data.due_date !== undefined && data.due_date !== null) {
    if (typeof data.due_date !== 'string' || isNaN(Date.parse(data.due_date))) {
      errors.push('Due date must be a valid ISO date string');
    }
  }

  // Description length
  if (data.description !== undefined && typeof data.description === 'string' && data.description.length > 10000) {
    errors.push('Description must be 10000 characters or less');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      title: sanitize(data.title as string, 500),
      description: data.description ? sanitize(data.description as string, 10000) : undefined,
      status: data.status as TodoInput['status'],
      priority: data.priority as TodoInput['priority'],
      due_date: data.due_date as string | undefined,
      email_message_id: data.email_message_id ? sanitize(data.email_message_id as string, 255) : undefined,
      email_subject: data.email_subject ? sanitize(data.email_subject as string, 500) : undefined,
      email_sender: data.email_sender ? sanitize(data.email_sender as string, 255) : undefined,
      email_received_at: data.email_received_at as string | undefined,
      dossier_id: data.dossier_id ? sanitize(data.dossier_id as string, 255) : undefined,
      dossier_name: data.dossier_name ? sanitize(data.dossier_name as string, 255) : undefined,
      dossier_rg: data.dossier_rg ? sanitize(data.dossier_rg as string, 50) : undefined,
    },
  };
}

// Calendar event input validation
export interface CalendarEventInput {
  subject: string;
  body?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: Array<{ email: string; name?: string }>;
  isAllDay?: boolean;
}

export function validateCalendarEventInput(input: unknown): ValidationResult<CalendarEventInput> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Invalid input'] };
  }

  const data = input as Record<string, unknown>;

  // Subject is required
  if (!data.subject || typeof data.subject !== 'string') {
    errors.push('Subject is required');
  } else if (data.subject.length > 500) {
    errors.push('Subject must be 500 characters or less');
  }

  // Start/End validation
  if (!data.start || typeof data.start !== 'string' || isNaN(Date.parse(data.start))) {
    errors.push('Start date is required and must be valid');
  }
  if (!data.end || typeof data.end !== 'string' || isNaN(Date.parse(data.end))) {
    errors.push('End date is required and must be valid');
  }

  // Validate start is before end
  if (data.start && data.end) {
    const startDate = new Date(data.start as string);
    const endDate = new Date(data.end as string);
    if (startDate >= endDate) {
      errors.push('Start date must be before end date');
    }
  }

  // Attendees validation
  if (data.attendees !== undefined) {
    if (!Array.isArray(data.attendees)) {
      errors.push('Attendees must be an array');
    } else {
      for (const attendee of data.attendees) {
        if (!attendee.email || typeof attendee.email !== 'string' || !isValidEmail(attendee.email)) {
          errors.push('Each attendee must have a valid email');
          break;
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      subject: sanitize(data.subject as string, 500),
      body: data.body ? sanitize(data.body as string, 50000) : undefined,
      start: data.start as string,
      end: data.end as string,
      location: data.location ? sanitize(data.location as string, 255) : undefined,
      attendees: (data.attendees as CalendarEventInput['attendees'])?.map(a => ({
        email: a.email.toLowerCase().trim(),
        name: a.name ? sanitize(a.name, 255) : undefined,
      })),
      isAllDay: Boolean(data.isAllDay),
    },
  };
}

// Kleos search input validation
export interface KleosSearchInput {
  query: string;
  page?: number;
  pageSize?: number;
  onlyOpen?: boolean;
}

export function validateKleosSearchInput(input: Record<string, string | null>): ValidationResult<KleosSearchInput> {
  const errors: string[] = [];

  const query = input.q || input.query || '';
  const page = input.page ? parseInt(input.page, 10) : 1;
  const pageSize = input.pageSize ? parseInt(input.pageSize, 10) : 20;
  const onlyOpen = input.onlyOpen === 'true';

  if (query.length > 200) {
    errors.push('Search query must be 200 characters or less');
  }

  if (isNaN(page) || page < 1) {
    errors.push('Page must be a positive integer');
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    errors.push('Page size must be between 1 and 100');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      query: sanitize(query, 200),
      page,
      pageSize,
      onlyOpen,
    },
  };
}

// Helper functions
function sanitize(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function parsePositiveInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}
