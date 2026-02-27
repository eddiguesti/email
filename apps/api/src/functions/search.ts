/**
 * Search Endpoint
 * Evidence-based search across processed emails
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import {
  createStorageClientFromEnv,
  type SearchRequest,
  type SearchResponse,
  type SearchResultItem,
} from '@lb-bot/shared';
import { extractSessionToken, decodeSessionToken } from '../utils/auth.js';

const RequestSchema = z.object({
  query: z.string().min(1),
  mailbox: z.string().email().optional(),
  filters: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sender: z.string().optional(),
    hasAttachments: z.boolean().optional(),
    dossierId: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

/**
 * Search processed emails
 * POST /api/search
 */
export async function search(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Authenticate the session before processing any request
  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  let body: SearchRequest;

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as SearchRequest;
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { error: 'Invalid request body' },
    };
  }

  // Always scope searches to the authenticated user's own mailbox
  body = { ...body, mailbox: session.email };

  try {
    const storageClient = createStorageClientFromEnv();

    // For now, we'll do a simple in-memory search
    // In production, this should use Azure Cognitive Search or similar
    const results: SearchResultItem[] = [];
    const queryLower = body.query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

    // Get records - in production, this would be a proper search index query
    // This is a simplified implementation that scans table storage
    // TODO: Replace with Azure Cognitive Search for production

    // For demo purposes, we'll search recent records
    const statuses: Array<'EXTRACTED' | 'MATCHED' | 'READY_FOR_REVIEW' | 'READY_TO_FILE' | 'FILED' | 'DONE'> =
      ['EXTRACTED', 'MATCHED', 'READY_FOR_REVIEW', 'READY_TO_FILE', 'FILED', 'DONE'];

    for (const status of statuses) {
      const records = await storageClient.getRecordsByStatus(status, body.mailbox, 50);

      for (const record of records) {
        // Skip if doesn't match filters
        if (body.filters?.dateFrom && record.timestamps.received < body.filters.dateFrom) continue;
        if (body.filters?.dateTo && record.timestamps.received > body.filters.dateTo) continue;
        if (body.filters?.sender && record.extractedSignals?.senderEmail !== body.filters.sender) continue;
        if (body.filters?.hasAttachments !== undefined &&
            record.extractedSignals?.hasAttachments !== body.filters.hasAttachments) continue;
        if (body.filters?.dossierId && record.chosenDossierId !== body.filters.dossierId) continue;

        // Score the record against query terms
        const matchedOn: string[] = [];
        let score = 0;

        const signals = record.extractedSignals;
        if (signals) {
          // Check subject
          if (signals.subject.toLowerCase().includes(queryLower)) {
            score += 10;
            matchedOn.push('subject');
          }

          // Check individual terms in subject
          for (const term of queryTerms) {
            if (signals.subject.toLowerCase().includes(term)) {
              score += 2;
            }
          }

          // Check sender
          if (signals.senderEmail.toLowerCase().includes(queryLower)) {
            score += 8;
            matchedOn.push('sender');
          }

          // Check body preview
          if (signals.bodyPreview.toLowerCase().includes(queryLower)) {
            score += 5;
            matchedOn.push('body');
          }

          // Check RG numbers
          for (const rg of signals.rgNumbers) {
            if (rg.toLowerCase().includes(queryLower)) {
              score += 15;
              matchedOn.push('rg_number');
              break;
            }
          }

          // Check entities
          for (const entity of signals.entities) {
            if (entity.value.toLowerCase().includes(queryLower)) {
              score += 5;
              matchedOn.push(`entity:${entity.type}`);
              break;
            }
          }
        }

        // Check attachments
        for (const attachment of record.attachments) {
          if (attachment.name.toLowerCase().includes(queryLower)) {
            score += 7;
            matchedOn.push('attachment');
            break;
          }
        }

        // Check dossier name if matched
        if (record.chosenDossierName?.toLowerCase().includes(queryLower)) {
          score += 8;
          matchedOn.push('dossier');
        }

        // Only include if has some relevance
        if (score > 0 || matchedOn.length > 0) {
          results.push({
            messageId: record.messageId,
            subject: signals?.subject || 'No Subject',
            sender: signals?.senderEmail || 'Unknown',
            receivedAt: record.timestamps.received,
            bodyPreview: signals?.bodyPreview || '',
            attachmentNames: record.attachments.map(a => a.name),
            dossierId: record.chosenDossierId,
            dossierName: record.chosenDossierName,
            confidence: record.matchResults[0]?.confidence,
            matchedOn: [...new Set(matchedOn)],
          });
        }
      }
    }

    // Sort by relevance (this is simplified - real implementation would score better)
    results.sort((a, b) => {
      // Prioritize more matched fields
      return b.matchedOn.length - a.matchedOn.length;
    });

    // Apply pagination
    const offset = body.offset ?? 0;
    const limit = body.limit ?? 20;
    const paginatedResults = results.slice(offset, offset + limit);

    const response: SearchResponse = {
      results: paginatedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
      query: body.query,
    };

    return { status: 200, jsonBody: response };
  } catch (error) {
    context.error('Error searching:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('search', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'search',
  handler: search,
});
