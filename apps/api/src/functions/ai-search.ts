import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Client } from '@microsoft/microsoft-graph-client';
import { authenticateRequest, checkRateLimit } from '../utils/auth.js';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function aiSearch(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Rate limit: 20 AI search queries per IP per minute
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(`ai-search:${clientIp}`, 20, 60000)) {
    return { status: 429, jsonBody: { error: 'Trop de requêtes, réessayez dans 1 minute' } };
  }

  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return { status: auth.status, jsonBody: { error: auth.error } };
    }

    const body = await request.json() as { query: string; conversationHistory?: ChatMessage[] };
    const { query, conversationHistory = [] } = body;

    if (!query) {
      return { status: 400, jsonBody: { error: 'La requête est requise' } };
    }

    // Create Graph client using the decrypted, auto-refreshed access token
    const graphClient = Client.init({
      authProvider: (done: (error: Error | null, token: string | null) => void) => {
        done(null, auth.user.accessToken);
      },
    });

    // First, use AI to understand the search intent and generate a Graph API search query
    const systemPrompt = `Tu es un assistant juridique intelligent pour un cabinet d'avocats français spécialisé en baux commerciaux et immobilier.

Ton rôle est d'aider les avocats à chercher et comprendre leurs emails. Tu dois:
1. Comprendre les demandes en langage naturel en français
2. Identifier les critères de recherche (expéditeur, sujet, date, mots-clés)
3. Reformuler les recherches de manière structurée

Quand l'utilisateur demande de chercher des emails, réponds avec un JSON structuré:
{
  "action": "search",
  "search_query": "mots clés à chercher",
  "filters": {
    "from": "email ou nom de l'expéditeur si mentionné",
    "subject_contains": "mots dans le sujet si mentionné",
    "date_filter": "today|this_week|this_month|null",
    "has_attachments": true/false/null
  },
  "explanation": "Explication de ce que tu cherches"
}

Si l'utilisateur pose une question générale ou veut de l'aide, réponds naturellement en français.

Catégories d'emails courants:
- tribunaux: Tribunaux, greffes, cours d'appel, convocations
- confreres: Autres avocats, cabinets
- clients: Communications clients
- expertises: Experts judiciaires, rapports
- huissiers: Huissiers de justice
- notaires: Notaires
- bailleurs: Propriétaires, bailleurs, SCI
- locataires: Locataires, preneurs
- assurances: Compagnies d'assurance`;

    const xaiApiKey = process.env.XAI_API_KEY;
    if (!xaiApiKey) {
      return { status: 500, jsonBody: { error: 'Configuration IA manquante' } };
    }

    // Call xAI Grok API to understand the query
    const xaiResponse = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-10), // Keep last 10 messages for context
          { role: 'user', content: query },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!xaiResponse.ok) {
      const errorText = await xaiResponse.text();
      context.error('xAI API error:', errorText);
      return { status: 500, jsonBody: { error: 'Erreur de l\'assistant IA' } };
    }

    const xaiData = await xaiResponse.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const aiMessage = xaiData.choices[0]?.message?.content || '';

    // Try to parse as JSON for search action
    let searchResults: any[] = [];
    let aiAction: any = null;

    try {
      // Check if the response contains a JSON search command
      const jsonMatch = aiMessage.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        aiAction = JSON.parse(jsonMatch[0]);

        if (aiAction.action === 'search' && aiAction.search_query) {
          // Build Microsoft Graph search query
          let graphQuery = aiAction.search_query;

          // Add filters
          const filters: string[] = [];
          if (aiAction.filters?.from) {
            filters.push(`from:${aiAction.filters.from}`);
          }
          if (aiAction.filters?.has_attachments) {
            filters.push('hasAttachments:true');
          }

          const searchQuery = filters.length > 0
            ? `${graphQuery} ${filters.join(' ')}`
            : graphQuery;

          // Search emails using Microsoft Graph
          try {
            const searchResponse = await graphClient
              .api('/me/messages')
              .search(`"${searchQuery}"`)
              .select('id,subject,from,receivedDateTime,bodyPreview,hasAttachments,importance')
              .top(10)
              .orderby('receivedDateTime desc')
              .get();

            searchResults = searchResponse.value.map((msg: any) => ({
              id: msg.id,
              subject: msg.subject || '(Sans objet)',
              from: {
                name: msg.from?.emailAddress?.name || 'Inconnu',
                email: msg.from?.emailAddress?.address || '',
              },
              receivedDateTime: msg.receivedDateTime,
              preview: msg.bodyPreview || '',
              hasAttachments: msg.hasAttachments || false,
              importance: msg.importance || 'normal',
            }));
          } catch (graphError) {
            context.error('Graph search error:', graphError);
          }
        }
      }
    } catch (parseError) {
      // Response is not JSON, it's a natural language response
    }

    context.log(`AI search for user ${auth.user.email}: "${query}" -> ${searchResults.length} results`);

    return {
      status: 200,
      jsonBody: {
        message: aiMessage,
        action: aiAction,
        results: searchResults,
        resultsCount: searchResults.length,
      },
    };
  } catch (error) {
    context.error('Error in AI search:', error);
    return {
      status: 500,
      jsonBody: { error: 'Erreur lors de la recherche' },
    };
  }
}

app.http('ai-search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/search',
  handler: aiSearch,
});
