/**
 * Calendar & Tasks Sync Service
 *
 * Syncs calendar events from Microsoft and correlates with todos.
 */

import { Client } from '@microsoft/microsoft-graph-client';

// Types
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
  // Correlation fields
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
  // Correlation fields
  caseId?: number;
  caseName?: string;
  caseReference?: string;
  linkedEventId?: string;
  emailMessageId?: string;
}

/**
 * Create Microsoft Graph client from access token
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Fetch calendar events from Microsoft Graph
 */
export async function getMicrosoftCalendarEvents(
  accessToken: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    maxResults?: number;
  } = {}
): Promise<CalendarEvent[]> {
  const client = createGraphClient(accessToken);

  const startDate = options.startDate || new Date();
  const endDate = options.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const response = await client
    .api('/me/calendar/events')
    .query({
      $filter: `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`,
      $orderby: 'start/dateTime',
      $top: options.maxResults || 100,
      $select: 'id,subject,body,start,end,location,isAllDay,attendees,categories,importance',
    })
    .get();

  return (response.value || []).map((event: any) => ({
    id: event.id,
    source: 'microsoft' as const,
    subject: event.subject || 'Sans titre',
    body: event.body?.content,
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    location: event.location?.displayName,
    isAllDay: event.isAllDay || false,
    attendees: (event.attendees || []).map((a: any) => ({
      name: a.emailAddress?.name,
      email: a.emailAddress?.address,
    })),
    categories: event.categories || [],
    importance: event.importance || 'normal',
  }));
}

/**
 * Fetch tasks from Microsoft To Do
 */
export async function getMicrosoftTasks(
  accessToken: string,
  options: {
    includeCompleted?: boolean;
    maxResults?: number;
  } = {}
): Promise<UnifiedTask[]> {
  const client = createGraphClient(accessToken);

  try {
    // Get default task list
    const listsResponse = await client.api('/me/todo/lists').get();
    const lists = listsResponse.value || [];

    const allTasks: UnifiedTask[] = [];

    for (const list of lists) {
      let apiPath = `/me/todo/lists/${list.id}/tasks`;
      const query: any = {
        $top: options.maxResults || 100,
        $orderby: 'createdDateTime desc',
      };

      if (!options.includeCompleted) {
        query.$filter = "status ne 'completed'";
      }

      const tasksResponse = await client.api(apiPath).query(query).get();

      const tasks = (tasksResponse.value || []).map((task: any) => ({
        id: `ms-${task.id}`,
        source: 'microsoft' as const,
        title: task.title || 'Sans titre',
        description: task.body?.content,
        status: task.status === 'completed' ? 'completed' as const :
                task.status === 'inProgress' ? 'in_progress' as const : 'pending' as const,
        priority: task.importance === 'high' ? 'high' as const :
                  task.importance === 'low' ? 'low' as const : 'normal' as const,
        dueDate: task.dueDateTime?.dateTime,
        createdAt: task.createdDateTime,
      }));

      allTasks.push(...tasks);
    }

    return allTasks;
  } catch (error) {
    console.error('Error fetching Microsoft tasks:', error);
    return [];
  }
}

/**
 * Get all calendars from Microsoft
 */
export async function getMicrosoftCalendars(
  accessToken: string
): Promise<{ id: string; name: string; color: string }[]> {
  const client = createGraphClient(accessToken);

  const response = await client
    .api('/me/calendars')
    .select('id,name,color')
    .get();

  return (response.value || []).map((cal: any) => ({
    id: cal.id,
    name: cal.name,
    color: cal.color || 'auto',
  }));
}

/**
 * Create a calendar event in Microsoft
 */
export async function createMicrosoftCalendarEvent(
  accessToken: string,
  event: {
    subject: string;
    body?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: { email: string; name?: string }[];
    isAllDay?: boolean;
  }
): Promise<string> {
  const client = createGraphClient(accessToken);

  const newEvent = {
    subject: event.subject,
    body: event.body ? {
      contentType: 'Text',
      content: event.body,
    } : undefined,
    start: {
      dateTime: event.start.toISOString(),
      timeZone: 'Europe/Paris',
    },
    end: {
      dateTime: event.end.toISOString(),
      timeZone: 'Europe/Paris',
    },
    location: event.location ? { displayName: event.location } : undefined,
    attendees: event.attendees?.map(a => ({
      emailAddress: { address: a.email, name: a.name },
      type: 'required',
    })),
    isAllDay: event.isAllDay || false,
  };

  const response = await client.api('/me/calendar/events').post(newEvent);
  return response.id;
}

/**
 * Create a task in Microsoft To Do
 */
export async function createMicrosoftTask(
  accessToken: string,
  task: {
    title: string;
    body?: string;
    dueDate?: Date;
    importance?: 'low' | 'normal' | 'high';
  }
): Promise<string> {
  const client = createGraphClient(accessToken);

  // Get the default task list
  const listsResponse = await client.api('/me/todo/lists').get();
  const defaultList = listsResponse.value?.[0];

  if (!defaultList) {
    throw new Error('No task list found');
  }

  const newTask = {
    title: task.title,
    body: task.body ? {
      contentType: 'text',
      content: task.body,
    } : undefined,
    dueDateTime: task.dueDate ? {
      dateTime: task.dueDate.toISOString(),
      timeZone: 'Europe/Paris',
    } : undefined,
    importance: task.importance || 'normal',
  };

  const response = await client
    .api(`/me/todo/lists/${defaultList.id}/tasks`)
    .post(newTask);

  return response.id;
}

/**
 * Correlate events with cases based on subject/attendees
 */
export function correlateWithCases(
  events: CalendarEvent[],
  cases: { id: number; name: string; reference: string; clients?: string[] }[]
): CalendarEvent[] {
  return events.map(event => {
    // Try to find a matching case by reference in subject
    for (const c of cases) {
      if (event.subject.includes(c.reference) || event.subject.toLowerCase().includes(c.name.toLowerCase())) {
        return {
          ...event,
          caseId: c.id,
          caseName: c.name,
          caseReference: c.reference,
        };
      }
    }
    return event;
  });
}

/**
 * Build a unified timeline of events and tasks
 */
export function buildUnifiedTimeline(
  events: CalendarEvent[],
  tasks: UnifiedTask[]
): (CalendarEvent | UnifiedTask)[] {
  const timeline: (CalendarEvent & { type: 'event' } | UnifiedTask & { type: 'task' })[] = [];

  // Add events
  for (const event of events) {
    timeline.push({ ...event, type: 'event' });
  }

  // Add tasks with due dates
  for (const task of tasks) {
    if (task.dueDate) {
      timeline.push({ ...task, type: 'task' });
    }
  }

  // Sort by date
  return timeline.sort((a, b) => {
    const dateA = 'start' in a ? new Date(a.start) : new Date(a.dueDate!);
    const dateB = 'start' in b ? new Date(b.start) : new Date(b.dueDate!);
    return dateA.getTime() - dateB.getTime();
  });
}
