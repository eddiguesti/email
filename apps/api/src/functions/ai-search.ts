import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Client } from '@microsoft/microsoft-graph-client';
import { authenticateRequest, checkRateLimit } from '../utils/auth.js';
import {
  searchCases,
  searchContacts,
  isKleosConfigured,
  KleosCase,
  KleosIdentity,
} from '../services/kleos-client.js';

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

    const kleosAvailable = isKleosConfigured();

    const systemPrompt = `Tu es un assistant juridique intelligent pour un cabinet d'avocats français spécialisé en baux commerciaux et immobilier.

Ton rôle est d'aider les avocats à chercher dans TOUTE la boîte mail Microsoft 365 ET dans Kleos (logiciel de gestion de dossiers).
Tu dois:
1. Comprendre les demandes en langage naturel en français
2. Identifier si la question concerne des emails, des dossiers Kleos, ou des contacts
3. Répondre UNIQUEMENT avec un objet JSON structuré (sans texte avant ni après)

${kleosAvailable
  ? 'Tu as accès à: emails Microsoft 365 (TOUS les dossiers — boîte de réception, envoyés, archives, etc.), dossiers/affaires Kleos, contacts Kleos.'
  : 'Tu as accès à: emails Microsoft 365 (TOUS les dossiers — boîte de réception, envoyés, archives, etc.).'}

**Pour rechercher des emails:**
RÈGLE CRITIQUE: search_query doit contenir uniquement des mots-clés de CONTENU (noms, organisations, numéros de dossier). NE PAS mettre "urgent", "non lu", "pièce jointe" dans search_query — utiliser les filtres à la place.
{"action":"search_emails","search_query":"mots-clés de contenu (noms, organisations, références — laisser vide si on filtre seulement)","filters":{"from":null,"subject_contains":null,"date_filter":"today|this_week|this_month|null","has_attachments":true|false|null,"is_unread":true|false|null,"importance":"high|null"},"explanation":"Ce que tu cherches en français"}

Exemples:
- "emails urgents non lus" → search_query:"", filters:{is_unread:true, importance:"high"}
- "emails du tribunal cette semaine" → search_query:"tribunal", filters:{date_filter:"this_week"}
- "emails de Charlotte Liron avec pièces jointes" → search_query:"", filters:{from:"Charlotte Liron", has_attachments:true}
- "dossiers SMABTP" → action:search_dossiers, search_query:"SMABTP"

${kleosAvailable ? `**Pour rechercher des dossiers/affaires dans Kleos:**
{"action":"search_dossiers","search_query":"référence ou nom du dossier ou client","explanation":"Ce que tu cherches"}

**Pour rechercher des contacts dans Kleos:**
{"action":"search_contacts","search_query":"nom ou email","explanation":"Ce que tu cherches"}` : ''}

**Pour une réponse directe sans recherche:**
{"action":"answer","explanation":"Ta réponse en français"}

Catégories emails courants: tribunaux, greffes, cours d'appel, confrères/avocats, clients, experts judiciaires, huissiers, notaires, bailleurs/SCI, locataires, assurances.`;

    const xaiApiKey = process.env.XAI_API_KEY;
    if (!xaiApiKey) {
      return { status: 500, jsonBody: { error: 'Configuration IA manquante' } };
    }

    // Call xAI Grok to understand query intent
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
          ...conversationHistory.slice(-10),
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!xaiResponse.ok) {
      const errorText = await xaiResponse.text();
      context.error('xAI API error:', errorText);
      return { status: 500, jsonBody: { error: "Erreur de l'assistant IA" } };
    }

    const xaiData = await xaiResponse.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const aiMessage = xaiData.choices[0]?.message?.content || '';

    // Execute action based on AI intent
    let emailResults: any[] = [];
    let dossierResults: KleosCase[] = [];
    let contactResults: KleosIdentity[] = [];
    let aiAction: any = null;
    let explanation = '';

    try {
      const jsonMatch = aiMessage.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        aiAction = JSON.parse(jsonMatch[0]);
        explanation = aiAction.explanation || '';

        if (aiAction.action === 'search_emails') {
          // Build KQL search query — search across ALL mail folders via /me/messages
          const parts: string[] = [];
          // Content keywords (free-text)
          if (aiAction.search_query?.trim()) {
            parts.push(aiAction.search_query.trim());
          }
          // Metadata filters as proper KQL properties
          if (aiAction.filters?.from) {
            parts.push(`from:${aiAction.filters.from}`);
          }
          if (aiAction.filters?.subject_contains) {
            parts.push(`subject:${aiAction.filters.subject_contains}`);
          }
          if (aiAction.filters?.has_attachments === true) {
            parts.push('hasAttachments:true');
          }
          if (aiAction.filters?.is_unread === true) {
            parts.push('isRead:false');
          }
          if (aiAction.filters?.importance === 'high') {
            parts.push('importance:high');
          }
          // If no filters at all, reject rather than returning the entire mailbox
          if (parts.length === 0) {
            explanation = "Pouvez-vous préciser votre recherche ? Par exemple : « emails du tribunal cette semaine » ou « messages de Charlotte Liron ».";
          }
          const kqlQuery = parts.join(' ');

          // Optional OData date filter (applied after Graph KQL search via client-side filter
          // because .search() and .filter() cannot be combined in Graph)
          let cutoff: Date | null = null;
          if (aiAction.filters?.date_filter === 'today') {
            cutoff = new Date();
            cutoff.setHours(0, 0, 0, 0);
          } else if (aiAction.filters?.date_filter === 'this_week') {
            cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
          } else if (aiAction.filters?.date_filter === 'this_month') {
            cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
          }

          if (!auth.user.accessToken) {
            explanation = "Impossible d'accéder à vos emails : la session ne contient pas de jeton Microsoft valide. Veuillez vous reconnecter.";
          } else if (kqlQuery) {
            try {
              // /me/messages searches ALL folders (inbox, sent, archives, archived, etc.)
              // Fetch more than needed to allow for conversation deduplication
              const searchResponse = await graphClient
                .api('/me/messages')
                .search(`"${kqlQuery}"`)
                .select('id,subject,from,receivedDateTime,bodyPreview,hasAttachments,importance,conversationId')
                .top(50)
                .orderby('receivedDateTime desc')
                .get();

              const allMsgs = searchResponse.value || [];

              // Apply date filter client-side (Graph search + filter cannot be combined)
              const afterCutoff = cutoff
                ? allMsgs.filter((m: any) => new Date(m.receivedDateTime) >= cutoff!)
                : allMsgs;

              // Deduplicate by conversationId — keep at most 2 messages per thread
              // so results span different email chains rather than one long thread
              const seenConversations = new Map<string, number>();
              const deduped = afterCutoff.filter((m: any) => {
                const convId = m.conversationId || m.id;
                const count = seenConversations.get(convId) ?? 0;
                if (count >= 2) return false;
                seenConversations.set(convId, count + 1);
                return true;
              });

              emailResults = deduped.slice(0, 15).map((msg: any) => ({
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

              if (emailResults.length === 0) {
                explanation = `${aiAction.explanation || 'Recherche effectuée'} — aucun email trouvé pour cette requête.`;
              }
            } catch (graphError: any) {
              context.error('Graph search error:', graphError);
              const status = graphError?.statusCode ?? graphError?.status;
              if (status === 401) {
                explanation = "Session Microsoft expirée. Veuillez vous déconnecter et vous reconnecter pour renouveler l'accès aux emails.";
              } else {
                explanation = `Erreur lors de l'accès à la boîte mail (${status ?? 'inconnue'}). Vérifiez que votre compte Microsoft 365 est correctement connecté.`;
              }
            }
          }

        } else if (aiAction.action === 'search_dossiers' && aiAction.search_query && kleosAvailable) {
          try {
            const result = await searchCases(aiAction.search_query, { pageSize: 10 });
            dossierResults = result.cases;
            if (dossierResults.length === 0) {
              explanation = `${aiAction.explanation || 'Recherche effectuée'} — aucun dossier trouvé dans Kleos.`;
            }
          } catch (kleosError) {
            context.error('Kleos dossier search error:', kleosError);
            explanation = "Erreur lors de l'accès à Kleos. Vérifiez que le service est disponible.";
          }

        } else if (aiAction.action === 'search_contacts' && aiAction.search_query && kleosAvailable) {
          try {
            const result = await searchContacts(aiAction.search_query, { pageSize: 10 });
            contactResults = result.contacts;
            if (contactResults.length === 0) {
              explanation = `${aiAction.explanation || 'Recherche effectuée'} — aucun contact trouvé dans Kleos.`;
            }
          } catch (kleosError) {
            context.error('Kleos contact search error:', kleosError);
            explanation = "Erreur lors de l'accès aux contacts Kleos.";
          }
        }
        // 'answer' action: explanation is used as-is
      }
    } catch {
      // Not valid JSON — fall back to raw message text
      explanation = aiMessage;
    }

    if (!explanation) {
      explanation = aiMessage;
    }

    context.log(
      `AI search user=${auth.user.email} query="${query}" emails=${emailResults.length} dossiers=${dossierResults.length} contacts=${contactResults.length}`
    );

    return {
      status: 200,
      jsonBody: {
        message: explanation,
        action: aiAction,
        results: emailResults,
        resultsCount: emailResults.length,
        dossierResults,
        contactResults,
      },
    };
  } catch (error) {
    context.error('Error in AI search:', error);
    return { status: 500, jsonBody: { error: 'Erreur lors de la recherche' } };
  }
}

app.http('ai-search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/search',
  handler: aiSearch,
});
