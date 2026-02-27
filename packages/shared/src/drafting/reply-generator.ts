/**
 * Reply Generator
 *
 * Uses Grok to generate a draft reply that matches the lawyer's writing style.
 * The model first analyses what the email is asking, then drafts accordingly.
 */

import type { StyleProfile, DraftReplyInput, DraftReplyResult, AIConfig } from './types.js';
import { sanitizeForPrompt } from '../utils/sanitization.js';

export async function generateDraftReply(
  style: StyleProfile,
  input: DraftReplyInput,
  aiConfig: AIConfig
): Promise<DraftReplyResult> {
  if (!input.senderEmail?.trim()) {
    throw new Error('Cannot generate draft: sender email not extracted from original message');
  }

  // ── Style context ────────────────────────────────────────────────────────
  const greetingExamples = style.sampleGreetings.slice(0, 3)
    .map((g, i) => `${i + 1}. "${sanitizeForPrompt(g)}"`)
    .join('\n');
  const signoffExamples = style.sampleSignoffs.slice(0, 3)
    .map((s, i) => `${i + 1}. "${sanitizeForPrompt(s)}"`)
    .join('\n');

  // Include raw email samples so the model can absorb the actual voice
  const rawSampleBlock = style.rawSamples.length > 0
    ? `\nEXEMPLES D'EMAILS RÉELS ENVOYÉS PAR L'AVOCATE (pour imiter la voix exacte) :\n` +
      style.rawSamples.slice(0, 4).map((s, i) =>
        `[Exemple ${i + 1}]\n${sanitizeForPrompt(s.slice(0, 500))}`
      ).join('\n\n')
    : '';

  // ── Conversation thread ──────────────────────────────────────────────────
  const threadBlock = input.conversationHistory && input.conversationHistory.length > 0
    ? `\nFIL DE CONVERSATION (messages précédents, du plus ancien au plus récent) :\n` +
      input.conversationHistory.map(m =>
        `• ${m.date} — ${sanitizeForPrompt(m.from)} :\n  ${sanitizeForPrompt(m.bodyPreview.slice(0, 300))}`
      ).join('\n')
    : '';

  // ── Dossier context ──────────────────────────────────────────────────────
  const dossierBlock = input.dossierRef
    ? `Dossier : [${sanitizeForPrompt(input.dossierRef)}] ${sanitizeForPrompt(input.dossierName || '')}${
        input.kleosCase?.typeName ? ` (${sanitizeForPrompt(input.kleosCase.typeName)})` : ''
      }
Source de classement : ${input.matchSource || 'inconnu'}
Raisons de classement : ${input.matchReasons.join(', ')}`
    : "Aucun dossier associé — peut-être une nouvelle affaire ou une demande générale.";

  // ── Email content ────────────────────────────────────────────────────────
  const emailBlock = input.subject || input.emailBody
    ? `OBJET : ${sanitizeForPrompt(input.subject || '(sans objet)')}

CONTENU DE L'EMAIL À TRAITER :
${sanitizeForPrompt((input.emailBody || '').slice(0, 3000) || '(contenu non disponible)')}`
    : "CONTENU DE L'EMAIL : (non disponible — rédiger une réponse de courtoisie générale)";

  // ── System prompt ────────────────────────────────────────────────────────
  const systemPrompt = `Tu es l'assistant juridique personnel de LAURENCE BROSSET AVOCATS, cabinet d'avocats spécialisé en droit de la construction et droit des assurances en France.

MISSION : Rédiger un brouillon de réponse email qui semble avoir été écrit directement par l'avocate. La réponse doit traiter précisément le contenu de l'email reçu et correspondre parfaitement à son style personnel.

══════════ PROFIL DE STYLE DE L'AVOCATE ══════════
${sanitizeForPrompt(style.styleSummary)}

Formules d'introduction habituelles :
${greetingExamples}

Formules de clôture habituelles :
${signoffExamples}

Niveau de formalité : ${style.formalityLevel === 'formal' ? 'formel' : 'semi-formel'}
Longueur moyenne de ses réponses : ~${style.avgReplyLength} mots
${rawSampleBlock}

══════════ MÉTHODE DE RÉDACTION ══════════
Avant de rédiger, identifie mentalement :
1. Le TYPE d'email reçu (confirmation de réunion / demande de document / question juridique / convocation / relance / autre)
2. CE QUI EST DEMANDÉ ou communiqué (chaque point doit recevoir une réponse)
3. Le TON APPROPRIÉ (urgent, informatif, rassurant, formel…)
4. Les ÉLÉMENTS DU DOSSIER à mentionner si pertinents

Puis rédige une réponse qui :
- Traite chaque point de l'email, sans en oublier aucun
- Utilise les formules d'introduction et de clôture exactes de l'avocate
- Mentionne le dossier naturellement si c'est pertinent
- Est en français, même si l'email contient de l'anglais

══════════ RÈGLES IMPÉRATIVES ══════════
• Rédige UNIQUEMENT le corps de l'email — pas d'objet, pas de balises Markdown
• La signature doit être : ${sanitizeForPrompt(style.displayName)}
• Longueur cible : ${style.avgReplyLength} mots environ
• Aucune invention : ne mentionne que ce qui est connu du contexte
• Si l'email est une convocation judiciaire (e-Barreau), accusé de réception formel obligatoire`;

  // ── User prompt ──────────────────────────────────────────────────────────
  const userPrompt = `Rédige la réponse à l'email suivant :

DE : ${sanitizeForPrompt(input.senderName || input.senderEmail)} <${input.senderEmail}>
${input.isEBarreau ? 'SOURCE : Messagerie e-Barreau (courrier officiel du barreau)\n' : ''}
${emailBlock}

CONTEXTE DOSSIER :
${dossierBlock}
${threadBlock}

Rédige maintenant la réponse complète en adoptant fidèlement le style de l'avocate.`;

  try {
    const resp = await fetch(aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.45,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!resp.ok) {
      throw new Error(`Grok API error: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const draft = data.choices?.[0]?.message?.content?.trim() || '';
    if (!draft) throw new Error('Empty response from AI');

    // Strip any accidental markdown wrapping
    const cleanDraft = draft
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const sampleCount = style.rawSamples.length;
    const threadInfo = input.conversationHistory?.length
      ? `, fil de ${input.conversationHistory.length} message${input.conversationHistory.length > 1 ? 's' : ''}`
      : '';
    const kleosInfo = input.kleosCase ? ` · Kleos: ${input.kleosCase.typeName ?? 'dossier'}` : '';

    return {
      draft: cleanDraft,
      confidence: input.dossierRef ? 'high' : 'medium',
      styleMatch: `Style basé sur ${sampleCount} emails de ${style.displayName}${threadInfo}${kleosInfo}`,
    };
  } catch (err) {
    throw new Error(
      `Échec de la génération: ${(err as Error).message?.slice(0, 100)}`
    );
  }
}
