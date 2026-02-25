/**
 * Subscription Management
 * Create, renew, and delete Graph subscriptions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import {
  GraphClient,
  createStorageClientFromEnv,
  createKleosClientFromEnv,
  type SubscriptionManageRequest,
  type SubscriptionManageResponse,
  type SubscriptionStatus,
} from '@lb-bot/shared';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const WEBHOOK_CLIENT_STATE = process.env.WEBHOOK_CLIENT_STATE || '';

const RequestSchema = z.object({
  action: z.enum(['create', 'renew', 'delete', 'list']),
  mailbox: z.string().email().optional(),
  subscriptionId: z.string().optional(),
});

/**
 * Manage Graph subscriptions
 * POST /api/subscriptions
 */
export async function subscriptionManage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { success: false, error: 'Non authentifié' } };
  }

  let body: SubscriptionManageRequest & { action: 'create' | 'renew' | 'delete' | 'list' };

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as SubscriptionManageRequest & { action: 'create' | 'renew' | 'delete' | 'list' };
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { success: false, error: 'Invalid request body' },
    };
  }

  if (!WEBHOOK_URL) {
    return {
      status: 500,
      jsonBody: { success: false, error: 'WEBHOOK_URL not configured' },
    };
  }

  try {
    const graphClient = new GraphClient({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    });

    const storageClient = createStorageClientFromEnv();
    const now = new Date().toISOString();

    switch (body.action) {
      case 'create': {
        if (!body.mailbox) {
          return {
            status: 400,
            jsonBody: { success: false, error: 'mailbox is required for create action' },
          };
        }

        // Ownership check — users may only create subscriptions for their own mailbox
        if (body.mailbox !== session.email) {
          return { status: 403, jsonBody: { success: false, error: 'Accès interdit' } };
        }

        const subscription = await graphClient.createSubscription(
          body.mailbox,
          WEBHOOK_URL,
          WEBHOOK_CLIENT_STATE
        );

        // Log the creation
        await storageClient.writeAuditLog({
          timestamp: now,
          action: 'SUBSCRIPTION_CREATED',
          actor: 'user',
          mailbox: body.mailbox,
          details: {
            subscriptionId: subscription.id,
            resource: subscription.resource,
            expirationDateTime: subscription.expirationDateTime,
          },
          success: true,
        });

        context.log(`Created subscription ${subscription.id} for ${body.mailbox}`);

        const status: SubscriptionStatus = {
          id: subscription.id,
          resource: subscription.resource,
          expiresAt: subscription.expirationDateTime,
          status: 'active',
        };

        const response: SubscriptionManageResponse = {
          success: true,
          subscription: status,
        };

        return { status: 200, jsonBody: response };
      }

      case 'renew': {
        if (!body.subscriptionId) {
          return {
            status: 400,
            jsonBody: { success: false, error: 'subscriptionId is required for renew action' },
          };
        }

        const subscription = await graphClient.renewSubscription(body.subscriptionId);

        await storageClient.writeAuditLog({
          timestamp: now,
          action: 'SUBSCRIPTION_RENEWED',
          actor: 'user',
          details: {
            subscriptionId: subscription.id,
            newExpiration: subscription.expirationDateTime,
          },
          success: true,
        });

        context.log(`Renewed subscription ${subscription.id}`);

        const status: SubscriptionStatus = {
          id: subscription.id,
          resource: subscription.resource,
          expiresAt: subscription.expirationDateTime,
          status: 'active',
        };

        const response: SubscriptionManageResponse = {
          success: true,
          subscription: status,
        };

        return { status: 200, jsonBody: response };
      }

      case 'delete': {
        if (!body.subscriptionId) {
          return {
            status: 400,
            jsonBody: { success: false, error: 'subscriptionId is required for delete action' },
          };
        }

        await graphClient.deleteSubscription(body.subscriptionId);

        await storageClient.writeAuditLog({
          timestamp: now,
          action: 'SUBSCRIPTION_DELETED',
          actor: 'user',
          details: {
            subscriptionId: body.subscriptionId,
          },
          success: true,
        });

        context.log(`Deleted subscription ${body.subscriptionId}`);

        const response: SubscriptionManageResponse = {
          success: true,
        };

        return { status: 200, jsonBody: response };
      }

      case 'list': {
        const subscriptions = await graphClient.listSubscriptions();

        const statuses: SubscriptionStatus[] = subscriptions.map(sub => ({
          id: sub.id,
          resource: sub.resource,
          expiresAt: sub.expirationDateTime,
          status: new Date(sub.expirationDateTime) > new Date() ? 'active' : 'expired',
        }));

        return {
          status: 200,
          jsonBody: {
            success: true,
            subscriptions: statuses,
          },
        };
      }

      default:
        return {
          status: 400,
          jsonBody: { success: false, error: 'Invalid action' },
        };
    }
  } catch (error) {
    context.error('Error managing subscription:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: String(error) },
    };
  }
}

app.http('subscription-manage', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'subscriptions',
  handler: subscriptionManage,
});

/**
 * Health check endpoint
 * GET /api/health
 */
export async function health(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const now = new Date().toISOString();

  let graphStatus: 'ok' | 'error' = 'ok';
  let storageStatus: 'ok' | 'error' = 'ok';
  let kleosStatus: 'ok' | 'error' = 'ok';

  // Check Graph API
  try {
    const graphClient = new GraphClient({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    });
    await graphClient.listSubscriptions();
  } catch (error) {
    context.warn('Graph health check failed:', error);
    graphStatus = 'error';
  }

  // Check Storage
  try {
    const storageClient = createStorageClientFromEnv();
    await storageClient.getProcessingRecord('health-check', 'health-check');
  } catch (error) {
    context.warn('Storage health check failed:', error);
    storageStatus = 'error';
  }

  // Check Kleos (real OAuth + API call)
  try {
    const kleosClient = createKleosClientFromEnv();
    const kleosOk = await kleosClient.healthCheck();
    kleosStatus = kleosOk ? 'ok' : 'error';
  } catch (error) {
    context.warn('Kleos health check failed:', error);
    kleosStatus = 'error';
  }

  const overallStatus =
    graphStatus === 'ok' && storageStatus === 'ok' && kleosStatus === 'ok'
      ? 'healthy'
      : graphStatus === 'error' && storageStatus === 'error'
        ? 'unhealthy'
        : 'degraded';

  return {
    status: overallStatus === 'unhealthy' ? 503 : 200,
    jsonBody: {
      status: overallStatus,
      timestamp: now,
      version: '0.1.0',
      components: {
        graph: graphStatus,
        kleos: kleosStatus,
        storage: storageStatus,
        queue: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING ? 'ok' : 'error',
      },
    },
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: health,
});
