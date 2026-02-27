import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/auth-server';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_MODEL = 'grok-3-latest';

interface KleosCase {
  id: number;
  name: string;
  reference: string;
  description?: string;
  typeName?: string;
  creationDate?: string;
  archived?: boolean;
}

async function fetchKleosCase(caseId: number): Promise<KleosCase | null> {
  const azureUrl = process.env.AZURE_API_URL;
  const azureKey = process.env.AZURE_FUNCTIONS_KEY;
  if (!azureUrl || !azureKey) return null;

  try {
    const res = await fetch(`${azureUrl}/api/kleos/cases/${caseId}`, {
      headers: { 'x-functions-key': azureKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { case?: KleosCase };
    return data.case ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { matchId?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { matchId, question } = body;
  if (!matchId || !question?.trim()) {
    return NextResponse.json({ error: 'matchId and question are required' }, { status: 400 });
  }

  // Load the match
  const { data: match } = await supabaseAdmin
    .from('match_logs')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  if (!user.isAdmin && match.mailbox !== user.email) {
    return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
  }

  if (!match.dossier_id || !match.matched) {
    return NextResponse.json({
      answer: "Ce message n'est pas classé dans un dossier Kleos. Je ne peux pas répondre à des questions sur le dossier.",
    });
  }

  // Fetch in parallel: Kleos case, recent emails for dossier, calendar suggestions
  const [kleosCase, recentEmailsResult, calendarResult] = await Promise.allSettled([
    fetchKleosCase(match.dossier_id as number),
    supabaseAdmin
      .from('match_logs')
      .select('sender_email, sender_name, received_at, review_approved, match_reasons')
      .eq('dossier_id', match.dossier_id)
      .order('received_at', { ascending: false })
      .limit(15),
    supabaseAdmin
      .from('calendar_suggestions')
      .select('title, start_at, end_at, status, description, attendees')
      .eq('mailbox', match.mailbox)
      .in('status', ['pending', 'accepted'])
      .gte('start_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
      .order('start_at', { ascending: false })
      .limit(8),
  ]);

  const kCase = kleosCase.status === 'fulfilled' ? kleosCase.value : null;
  const recentEmails = recentEmailsResult.status === 'fulfilled' ? (recentEmailsResult.value.data ?? []) : [];
  const calendarEvents = calendarResult.status === 'fulfilled' ? (calendarResult.value.data ?? []) : [];

  // Build context blocks
  const caseCtx = kCase
    ? `Dossier Kleos : "${kCase.name}" (réf. ${kCase.reference})
Type : ${kCase.typeName ?? 'Non spécifié'}
Créé le : ${kCase.creationDate ? new Date(kCase.creationDate).toLocaleDateString('fr-FR') : 'Inconnu'}
Statut : ${kCase.archived ? 'Archivé' : 'Actif'}${kCase.description ? `\nDescription : ${kCase.description.slice(0, 300)}` : ''}`
    : `Dossier : "${match.dossier_name}" (réf. ${match.dossier_ref})`;

  const emailCtx = recentEmails.length > 0
    ? `Derniers emails classés dans ce dossier (${recentEmails.length}) :\n` +
      recentEmails.map((e: { sender_name?: string; sender_email: string; received_at: string; review_approved: boolean | null }) =>
        `- ${e.received_at ? new Date(e.received_at).toLocaleDateString('fr-FR') : '?'} : ${e.sender_name ?? e.sender_email}${e.review_approved === true ? ' [approuvé]' : e.review_approved === false ? ' [rejeté]' : ''}`
      ).join('\n')
    : "Aucun historique d'emails pour ce dossier dans les 90 derniers jours.";

  const calCtx = calendarEvents.length > 0
    ? `Réunions / rendez-vous pour la boîte "${match.mailbox}" (90 derniers jours) :\n` +
      calendarEvents.map((e: { title: string; start_at: string; end_at?: string; status: string; description?: string }) => {
        const date = e.start_at ? new Date(e.start_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'date inconnue';
        return `- ${date} : "${e.title}" [${e.status}]${e.description ? ' — ' + e.description.slice(0, 100) : ''}`;
      }).join('\n')
    : "Aucune réunion enregistrée via l'assistant calendrier pour cette boîte.";

  const currentCtx = `Email en cours de traitement : de ${match.sender_name ?? match.sender_email} <${match.sender_email}>, reçu le ${match.received_at ? new Date(match.received_at).toLocaleDateString('fr-FR') : 'date inconnue'}. Avocat responsable : ${match.lawyer ?? 'Non assigné'}.`;

  const systemPrompt = `Tu es un assistant juridique IA pour un cabinet d'avocats français. Tu aides les avocats à consulter rapidement les informations sur leurs dossiers directement depuis leur messagerie, sans avoir à ouvrir Kleos.

Réponds de manière concise et factuelle en français. Si une information n'est pas disponible dans le contexte fourni, dis-le clairement plutôt que de supposer. Ne dépasse pas 3-4 phrases sauf si la question l'exige.

--- CONTEXTE DU DOSSIER ---
${caseCtx}

--- HISTORIQUE EMAILS ---
${emailCtx}

--- CALENDRIER ---
${calCtx}

--- EMAIL ACTUEL ---
${currentCtx}`;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'XAI_API_KEY non configuré' }, { status: 500 });
  }

  try {
    const xaiRes = await fetch(process.env.XAI_API_URL ?? XAI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.XAI_MODEL ?? XAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question.trim() },
        ],
        max_tokens: 400,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!xaiRes.ok) {
      const errText = await xaiRes.text().catch(() => '');
      console.error('[dossier-ask] xAI error:', xaiRes.status, errText);
      return NextResponse.json({ error: 'Erreur du service IA' }, { status: 500 });
    }

    const xaiData = await xaiRes.json() as { choices?: Array<{ message: { content: string } }> };
    const answer = xaiData.choices?.[0]?.message?.content?.trim() ?? 'Aucune réponse générée.';
    return NextResponse.json({ answer });
  } catch (err) {
    console.error('[dossier-ask]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
