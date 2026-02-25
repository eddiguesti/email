/**
 * Chat Endpoint
 * Evidence-based chat that always cites sources
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import {
  createStorageClientFromEnv,
  sanitizeForPrompt,
  containsPromptInjection,
  type ChatRequest,
  type ChatResponse,
  type ChatCitation,
  type ChatAction,
} from '@lb-bot/shared';
import { checkRateLimit, extractSessionToken, decodeSessionToken } from '../utils/auth.js';

const RequestSchema = z.object({
  query: z.string().min(1).max(500),
  mailbox: z.string().email(),
  conversationId: z.string().optional(),
  context: z.object({
    currentMessageId: z.string().optional(),
    currentDossierId: z.string().optional(),
  }).optional(),
});

// Common question patterns
const QUESTION_PATTERNS = {
  ATTACHMENT_SEARCH: /(?:did|has|was|were|is)\s+(?:the\s+)?(?:client|sender|they)\s+(?:send|sent|attach|attached|include|included)\s+(?:a|an|the)?\s*(?:pdf|document|file|attachment)/i,
  DATE_SEARCH: /(?:when|what\s+date)\s+(?:did|was|were)/i,
  SENDER_SEARCH: /(?:who|which\s+(?:person|lawyer|client))\s+(?:sent|emailed|wrote)/i,
  DOSSIER_SEARCH: /(?:which|what)\s+(?:dossier|case|matter|file)/i,
  COUNT_QUERY: /(?:how\s+many|count|number\s+of)/i,
};

/**
 * Chat with evidence-based responses
 * POST /api/chat
 */
export async function chat(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Rate limit: 30 chat queries per IP per minute
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`chat:${clientIp}`, 30, 60000)) {
    return { status: 429, jsonBody: { error: 'Trop de requêtes, réessayez dans 1 minute' } };
  }

  const token = extractSessionToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!session) {
    return { status: 401, jsonBody: { error: 'Non authentifié' } };
  }

  let body: ChatRequest;

  try {
    const rawBody = await request.json();
    body = RequestSchema.parse(rawBody) as ChatRequest;
  } catch (error) {
    context.error('Invalid request body:', error);
    return {
      status: 400,
      jsonBody: { error: 'Invalid request body' },
    };
  }

  // Always scope queries to the authenticated user's mailbox
  body = { ...body, mailbox: session.email };

  // Security check - detect potential prompt injection
  if (containsPromptInjection(body.query)) {
    context.warn('Potential prompt injection detected:', body.query);
    return {
      status: 400,
      jsonBody: { error: 'Invalid query format' },
    };
  }

  try {
    const storageClient = createStorageClientFromEnv();
    const sanitizedQuery = sanitizeForPrompt(body.query);

    // Analyze the query to understand intent
    const queryLower = sanitizedQuery.toLowerCase();
    const citations: ChatCitation[] = [];
    const actions: ChatAction[] = [];
    let answer = '';

    // Search for relevant records
    const statuses: Array<'EXTRACTED' | 'MATCHED' | 'READY_FOR_REVIEW' | 'READY_TO_FILE' | 'FILED' | 'DONE'> =
      ['FILED', 'DONE', 'READY_TO_FILE', 'MATCHED', 'EXTRACTED'];

    const relevantRecords: Array<{
      record: Awaited<ReturnType<typeof storageClient.getProcessingRecord>>;
      score: number;
    }> = [];

    // Extract key terms from query
    const searchTerms = queryLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !['the', 'and', 'for', 'was', 'did', 'has', 'they', 'send', 'sent'].includes(t));

    for (const status of statuses) {
      const records = await storageClient.getRecordsByStatus(status, body.mailbox, 30);

      for (const record of records) {
        if (!record) continue;

        let score = 0;
        const signals = record.extractedSignals;

        // Match against search terms
        for (const term of searchTerms) {
          if (signals?.subject.toLowerCase().includes(term)) score += 5;
          if (signals?.senderEmail.toLowerCase().includes(term)) score += 3;
          if (signals?.bodyPreview.toLowerCase().includes(term)) score += 2;

          for (const att of record.attachments) {
            if (att.name.toLowerCase().includes(term)) score += 4;
          }
        }

        // Boost if in current conversation
        if (body.context?.currentMessageId === record.messageId) score += 10;
        if (body.conversationId === record.conversationId) score += 5;
        if (body.context?.currentDossierId === record.chosenDossierId) score += 3;

        if (score > 0) {
          relevantRecords.push({ record, score });
        }
      }
    }

    // Sort by relevance
    relevantRecords.sort((a, b) => b.score - a.score);
    const topResults = relevantRecords.slice(0, 5);

    // Handle specific question types
    if (QUESTION_PATTERNS.ATTACHMENT_SEARCH.test(queryLower)) {
      // Looking for attachments
      const attachmentMatches = topResults.filter(r =>
        r.record?.attachments.some(a =>
          a.name.toLowerCase().includes('pdf') ||
          searchTerms.some(t => a.name.toLowerCase().includes(t))
        )
      );

      if (attachmentMatches.length > 0) {
        const firstMatch = attachmentMatches[0].record!;
        const matchedAttachments = firstMatch.attachments.filter(a =>
          searchTerms.some(t => a.name.toLowerCase().includes(t)) ||
          a.name.toLowerCase().includes('pdf')
        );

        answer = `Yes, I found ${attachmentMatches.length} email(s) with relevant attachments. `;
        answer += `The most recent is from ${firstMatch.extractedSignals?.senderEmail} on ${firstMatch.timestamps.received.split('T')[0]}, `;
        answer += `with attachment(s): ${matchedAttachments.map(a => a.name).join(', ')}.`;

        for (const match of attachmentMatches.slice(0, 3)) {
          const r = match.record!;
          citations.push({
            messageId: r.messageId,
            subject: r.extractedSignals?.subject || 'No Subject',
            sender: r.extractedSignals?.senderEmail || 'Unknown',
            date: r.timestamps.received,
            excerpt: `Attachments: ${r.attachments.map(a => a.name).join(', ')}`,
            relevanceScore: match.score,
          });
        }

        actions.push({
          type: 'view_email',
          label: 'View Email',
          params: { messageId: firstMatch.messageId, mailbox: body.mailbox },
        });
      } else if (topResults.length > 0) {
        answer = `I searched ${topResults.length} relevant emails but couldn't find attachments matching your query. `;
        answer += `The search terms I used were: ${searchTerms.join(', ')}.`;
      } else {
        answer = `I couldn't find any emails matching your search. Try different search terms or check the mailbox filter.`;
      }
    } else if (QUESTION_PATTERNS.COUNT_QUERY.test(queryLower)) {
      // Count query
      answer = `I found ${relevantRecords.length} email(s) matching your query.`;

      if (relevantRecords.length > 0) {
        const byDossier = new Map<string, number>();
        for (const { record } of relevantRecords) {
          if (record?.chosenDossierId) {
            byDossier.set(
              record.chosenDossierId,
              (byDossier.get(record.chosenDossierId) || 0) + 1
            );
          }
        }

        if (byDossier.size > 0) {
          answer += ` Broken down by dossier: `;
          const dossierCounts = Array.from(byDossier.entries())
            .map(([id, count]) => {
              const record = relevantRecords.find(r => r.record?.chosenDossierId === id)?.record;
              return `${record?.chosenDossierName || id}: ${count}`;
            });
          answer += dossierCounts.join(', ');
        }
      }
    } else {
      // General search
      if (topResults.length > 0) {
        answer = `I found ${relevantRecords.length} relevant email(s). Here are the top results:`;

        for (const { record, score } of topResults.slice(0, 3)) {
          if (!record) continue;

          citations.push({
            messageId: record.messageId,
            subject: record.extractedSignals?.subject || 'No Subject',
            sender: record.extractedSignals?.senderEmail || 'Unknown',
            date: record.timestamps.received,
            excerpt: record.extractedSignals?.bodyPreview?.slice(0, 150) || '',
            attachmentName: record.attachments[0]?.name,
            relevanceScore: score,
          });

          actions.push({
            type: 'view_email',
            label: `View: ${(record.extractedSignals?.subject || 'Email').slice(0, 30)}...`,
            params: { messageId: record.messageId, mailbox: body.mailbox },
          });
        }
      } else {
        answer = `I couldn't find any emails matching "${sanitizedQuery}". `;
        answer += `Try broader search terms or check if the email has been processed.`;
      }
    }

    // Generate follow-up questions
    const followUpQuestions: string[] = [];
    if (citations.length > 0) {
      followUpQuestions.push('What attachments were included in these emails?');
      followUpQuestions.push('When was the most recent email in this thread?');
      followUpQuestions.push('Which dossier are these emails filed under?');
    }

    const response: ChatResponse = {
      answer,
      citations,
      hasResults: citations.length > 0,
      followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined,
      actions: actions.length > 0 ? actions : undefined,
    };

    return { status: 200, jsonBody: response };
  } catch (error) {
    context.error('Error in chat:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('chat', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'chat',
  handler: chat,
});
