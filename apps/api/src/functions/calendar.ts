/**
 * Calendar & Tasks API Endpoints
 *
 * Syncs and correlates calendar events and tasks from Microsoft and local sources.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createClient } from '@supabase/supabase-js';
import {
  getMicrosoftCalendarEvents,
  getMicrosoftTasks,
  getMicrosoftCalendars,
  createMicrosoftCalendarEvent,
  createMicrosoftTask,
  buildUnifiedTimeline,
  UnifiedTask,
} from '../services/calendar-sync.js';
import {
  authenticateRequest,
  errorResponse,
  successResponse,
  logSecurityEvent,
  checkRateLimit,
} from '../utils/auth.js';
import { validateCalendarEventInput } from '../utils/validation.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

/**
 * GET /api/calendar/events - Get calendar events
 */
async function getCalendarEvents(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`calendar:${clientIp}`, 60, 60000)) {
    return errorResponse(429, 'Trop de requêtes, veuillez réessayer plus tard');
  }

  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const startDateParam = request.query.get('startDate');
    const endDateParam = request.query.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return errorResponse(400, 'Dates invalides');
    }

    if (startDate >= endDate) {
      return errorResponse(400, 'La date de début doit être avant la date de fin');
    }

    const events = await getMicrosoftCalendarEvents(auth.user.accessToken, {
      startDate,
      endDate,
      maxResults: 100,
    });

    return successResponse({ events, count: events.length });
  } catch (error) {
    context.error('Calendar events error:', error);
    await logSecurityEvent('calendar_events_error', auth.user.userId, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return errorResponse(500, 'Erreur lors de la récupération des événements');
  }
}

/**
 * GET /api/calendar/tasks - Get Microsoft To Do tasks
 */
async function getMSTasks(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const includeCompleted = request.query.get('includeCompleted') === 'true';

    const tasks = await getMicrosoftTasks(auth.user.accessToken, {
      includeCompleted,
      maxResults: 100,
    });

    return successResponse({ tasks, count: tasks.length });
  } catch (error) {
    context.error('MS Tasks error:', error);
    return errorResponse(500, 'Erreur lors de la récupération des tâches Microsoft');
  }
}

/**
 * GET /api/calendar/calendars - Get all calendars
 */
async function getCalendars(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const calendars = await getMicrosoftCalendars(auth.user.accessToken);
    return successResponse({ calendars });
  } catch (error) {
    context.error('Calendars error:', error);
    return errorResponse(500, 'Erreur lors de la récupération des calendriers');
  }
}

/**
 * GET /api/calendar/unified - Get unified timeline (events + todos + MS tasks)
 */
async function getUnifiedTimeline(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const startDateParam = request.query.get('startDate');
    const endDateParam = request.query.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel with error handling for each
    const [eventsResult, msTasksResult, localTodosResult] = await Promise.allSettled([
      getMicrosoftCalendarEvents(auth.user.accessToken, { startDate, endDate }),
      getMicrosoftTasks(auth.user.accessToken, { includeCompleted: false }),
      supabase
        .from('todos')
        .select('*')
        .eq('lawyer_id', auth.user.userId)
        .neq('status', 'completed')
        .order('due_date', { ascending: true }),
    ]);

    // Extract results with fallbacks
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
    const msTasks = msTasksResult.status === 'fulfilled' ? msTasksResult.value : [];
    const localTodosData = localTodosResult.status === 'fulfilled'
      ? localTodosResult.value.data || []
      : [];

    // Log any failures (but don't fail the whole request)
    if (eventsResult.status === 'rejected') {
      context.warn('Failed to fetch calendar events:', eventsResult.reason);
    }
    if (msTasksResult.status === 'rejected') {
      context.warn('Failed to fetch MS tasks:', msTasksResult.reason);
    }

    // Convert local todos to UnifiedTask format
    const localTasks: UnifiedTask[] = localTodosData.map((todo: Record<string, unknown>) => ({
      id: String(todo.id),
      source: 'local' as const,
      title: String(todo.title || ''),
      description: todo.description ? String(todo.description) : undefined,
      status: todo.status as UnifiedTask['status'],
      priority: todo.priority as UnifiedTask['priority'],
      dueDate: todo.due_date ? String(todo.due_date) : undefined,
      createdAt: String(todo.created_at),
      caseId: todo.dossier_id ? parseInt(String(todo.dossier_id), 10) : undefined,
      caseName: todo.dossier_name ? String(todo.dossier_name) : undefined,
      caseReference: todo.dossier_rg ? String(todo.dossier_rg) : undefined,
      emailMessageId: todo.email_message_id ? String(todo.email_message_id) : undefined,
    }));

    // Combine all tasks and build timeline
    const allTasks = [...msTasks, ...localTasks];
    const timeline = buildUnifiedTimeline(events, allTasks);

    return successResponse({
      timeline,
      stats: {
        events: events.length,
        microsoftTasks: msTasks.length,
        localTodos: localTasks.length,
        total: timeline.length,
      },
    });
  } catch (error) {
    context.error('Unified timeline error:', error);
    return errorResponse(500, 'Erreur lors de la récupération du calendrier unifié');
  }
}

/**
 * POST /api/calendar/events - Create a calendar event
 */
async function createCalendarEventHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const body = await request.json();
    const validation = validateCalendarEventInput(body);

    if (!validation.valid) {
      return errorResponse(400, validation.errors.join(', '));
    }

    const { subject, body: eventBody, start, end, location, attendees, isAllDay } = validation.data;

    const eventId = await createMicrosoftCalendarEvent(auth.user.accessToken, {
      subject,
      body: eventBody,
      start: new Date(start),
      end: new Date(end),
      location,
      attendees,
      isAllDay,
    });

    await logSecurityEvent('calendar_event_created', auth.user.userId, request, {
      eventId,
      subject,
    });

    return successResponse({ success: true, eventId }, 201);
  } catch (error) {
    context.error('Create event error:', error);
    return errorResponse(500, "Erreur lors de la création de l'événement");
  }
}

/**
 * POST /api/calendar/tasks - Create a Microsoft To Do task
 */
async function createMSTaskHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.status, auth.error);
  }

  try {
    const body = await request.json() as {
      title?: string;
      body?: string;
      dueDate?: string;
      importance?: 'low' | 'normal' | 'high';
    };

    if (!body.title || typeof body.title !== 'string') {
      return errorResponse(400, 'Titre requis');
    }

    if (body.title.length > 500) {
      return errorResponse(400, 'Le titre doit faire 500 caractères maximum');
    }

    const taskId = await createMicrosoftTask(auth.user.accessToken, {
      title: body.title.trim(),
      body: body.body?.slice(0, 10000),
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      importance: body.importance,
    });

    await logSecurityEvent('ms_task_created', auth.user.userId, request, {
      taskId,
      title: body.title,
    });

    return successResponse({ success: true, taskId }, 201);
  } catch (error) {
    context.error('Create MS task error:', error);
    return errorResponse(500, 'Erreur lors de la création de la tâche');
  }
}

// Register endpoints
app.http('calendar-events', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar/events',
  handler: getCalendarEvents,
});

app.http('calendar-tasks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar/tasks',
  handler: getMSTasks,
});

app.http('calendar-calendars', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar/calendars',
  handler: getCalendars,
});

app.http('calendar-unified', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar/unified',
  handler: getUnifiedTimeline,
});

app.http('calendar-create-event', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'calendar/events',
  handler: createCalendarEventHandler,
});

app.http('calendar-create-task', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'calendar/tasks',
  handler: createMSTaskHandler,
});
