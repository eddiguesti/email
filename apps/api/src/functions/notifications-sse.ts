/**
 * Server-Sent Events (SSE) for Real-Time Notifications
 *
 * Provides a streaming endpoint for pushing notifications to the frontend.
 * Supports: new emails, processing updates, todo changes, etc.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest, extractSessionToken, decodeSessionToken } from '../utils/auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Active SSE connections per user
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Event types
export type NotificationEvent = {
  type: 'email_received' | 'email_processed' | 'todo_created' | 'todo_updated' | 'system';
  data: {
    id?: string;
    title: string;
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
};

/**
 * Send notification to a specific user's connections
 */
function sendNotification(userId: string, event: NotificationEvent): void {
  const userConnections = connections.get(userId);
  if (!userConnections || userConnections.size === 0) {
    return;
  }

  const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  const encoder = new TextEncoder();

  for (const controller of userConnections) {
    try {
      controller.enqueue(encoder.encode(eventData));
    } catch {
      // Connection closed, will be cleaned up
    }
  }
}

/**
 * Broadcast notification to all connected users
 */
function broadcastNotification(event: NotificationEvent): void {
  for (const userId of connections.keys()) {
    sendNotification(userId, event);
  }
}

/**
 * GET /api/notifications/stream - SSE endpoint for real-time notifications
 */
async function notificationsStream(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  // Create a readable stream for SSE
  let controller: ReadableStreamDefaultController;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      // Register this connection
      if (!connections.has(userId)) {
        connections.set(userId, new Set());
      }
      connections.get(userId)!.add(controller);

      context.log(`SSE connection opened for user ${userId}`);

      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`)
      );

      // Send heartbeat every 30 seconds to keep connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        }
      }, 30000);
    },
    cancel() {
      // Clear heartbeat to prevent memory leak
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      // Cleanup on disconnect
      if (connections.has(userId)) {
        connections.get(userId)!.delete(controller);
        if (connections.get(userId)!.size === 0) {
          connections.delete(userId);
        }
      }
      context.log(`SSE connection closed for user ${userId}`);
    },
  });

  return {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: stream,
  };
}

/**
 * POST /api/notifications/send - Send a notification (internal use)
 * Protected endpoint for backend services to trigger notifications
 */
async function sendNotificationEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Verify internal service key — fail closed when env var is unset
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  const serviceKey = request.headers.get('X-Service-Key');
  if (!expectedKey || serviceKey !== expectedKey) {
    return { status: 403, jsonBody: { error: 'Accès interdit' } };
  }

  try {
    const body = await request.json() as {
      userId?: string;
      broadcast?: boolean;
      event: NotificationEvent;
    };

    if (body.broadcast) {
      broadcastNotification(body.event);
    } else if (body.userId) {
      sendNotification(body.userId, body.event);
    } else {
      return { status: 400, jsonBody: { error: 'userId ou broadcast requis' } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (error) {
    context.error('Send notification error:', error);
    return { status: 500, jsonBody: { error: 'Erreur interne' } };
  }
}

/**
 * GET /api/notifications - Get recent notifications from database
 */
async function getNotifications(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  try {
    const limit = Math.min(parseInt(request.query.get('limit') || '20'), 100);
    const unreadOnly = request.query.get('unread') === 'true';

    // Get recent match logs scoped to this user's mailbox only
    let query = supabase
      .from('match_logs')
      .select('id, action_taken, sender_name, sender_email, received_at, created_at')
      .eq('mailbox', session.email)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter for active/review statuses if needed
    if (unreadOnly) {
      query = query.in('action_taken', ['auto_filed', 'review', 'dry_run']);
    }

    const { data: records, error } = await query;

    if (error) {
      throw error;
    }

    // Transform to notification format
    const notifications = (records || []).map((record) => ({
      id: record.id,
      type: getNotificationType(record.action_taken),
      title: getNotificationTitle(record.action_taken),
      message: record.sender_name || record.sender_email || 'Email traité',
      sender: record.sender_name || record.sender_email,
      timestamp: record.received_at || record.created_at,
      read: !['auto_filed', 'review', 'dry_run'].includes(record.action_taken),
    }));

    return { status: 200, jsonBody: { notifications } };
  } catch (error) {
    context.error('Get notifications error:', error);
    return { status: 500, jsonBody: { error: 'Erreur interne' } };
  }
}

function getNotificationType(actionTaken: string): string {
  switch (actionTaken) {
    case 'auto_filed':
    case 'review':
    case 'dry_run':
      return 'email_processed';
    case 'skipped':
      return 'system';
    default:
      return 'system';
  }
}

function getNotificationTitle(actionTaken: string): string {
  switch (actionTaken) {
    case 'auto_filed':
      return 'Dossier identifié';
    case 'review':
      return 'Email prêt pour révision';
    case 'dry_run':
      return 'Email analysé';
    case 'skipped':
      return 'Email ignoré';
    default:
      return 'Mise à jour';
  }
}

// Register endpoints
app.http('notifications-stream', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/stream',
  handler: notificationsStream,
});

app.http('notifications-send', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/send',
  handler: sendNotificationEndpoint,
});

app.http('notifications-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications',
  handler: getNotifications,
});

// Export for use by other functions (webhook, worker, etc.)
export { sendNotification, broadcastNotification };
