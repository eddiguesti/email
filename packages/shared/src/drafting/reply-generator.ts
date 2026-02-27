/**
 * Reply Generator
 *
 * Uses Grok to generate a draft reply that matches the lawyer's writing style.
 */

import type { StyleProfile, DraftReplyInput, DraftReplyResult, AIConfig } from './types.js';
import { sanitizeForPrompt } from '../utils/sanitization.js';

/**
 * Generate a draft reply using the lawyer's style profile and the email context.
 */
export async function generateDraftReply(
  style: StyleProfile,
  input: DraftReplyInput,
  aiConfig: AIConfig
): Promise<DraftReplyResult> {
  // Validate that we have a recipient address before generating any draft
  if (!input.senderEmail || input.senderEmail.trim() === '') {
    throw new Error('Cannot generate draft: sender email not extracted from original message');
  }

  const systemPrompt = `Tu es l'assistant juridique de LAURENCE BROSSET AVOCATS, cabinet d'avocats spécialisé en droit de la construction et droit des assurances.

TON RÔLE : Rédiger un brouillon de réponse à l'email ci-dessous, en imitant fidèlement le style d'écriture de l'avocate.

STYLE D'ÉCRITURE DE L'AVOCATE :
${sanitizeForPrompt(style.styleSummary)}

Formules d'introduction habituelles : ${sanitizeForPrompt(style.sampleGreetings.join(' / '))}
Formules de clôture habituelles : ${sanitizeForPrompt(style.sampleSignoffs.join(' / '))}
Niveau de formalité : ${style.formalityLevel === 'formal' ? 'formel' : 'semi-formel'}
Longueur moyenne de ses réponses : ~${style.avgReplyLength} mots

RÈGLES IMPÉRATIVES :
1. Rédige UNIQUEMENT le corps de l'email — pas d'objet, pas de balises Markdown
2. Réponds précisément au contenu de l'email reçu (questions posées, demandes formulées, points soulevés)
3. Adopte le style EXACT de l'avocate : ses formules d'introduction, son ton, ses formules de clôture
4. Mentionne le dossier naturellement si un dossier est associé
5. Signe avec le nom de l'avocate : ${sanitizeForPrompt(style.displayName)}
6. Longueur cible : ${style.avgReplyLength} mots environ
7. Langue : français uniquement`;

  const dossierContext = input.dossierRef
    ? `Dossier associé : [${sanitizeForPrompt(input.dossierRef)}] ${sanitizeForPrompt(input.dossierName || '')}\nSource de classement : ${input.matchSource || 'inconnu'}\nRaisons : ${input.matchReasons.join(', ')}`
    : "Aucun dossier associé — il peut s'agir d'une nouvelle affaire ou d'une demande générale.";

  const emailSection = input.subject || input.emailBody
    ? `OBJET : ${sanitizeForPrompt(input.subject || '(sans objet)')}

CONTENU DE L'EMAIL REÇU :
${sanitizeForPrompt((input.emailBody || '').slice(0, 2000) || '(contenu non disponible)')}`
    : "CONTENU DE L'EMAIL REÇU : (non disponible — rédige une réponse de courtoisie générale)";

  const userPrompt = `Rédige une réponse à l'email suivant :

DE : ${sanitizeForPrompt(input.senderName || input.senderEmail)} <${input.senderEmail}>
${input.isEBarreau ? "NOTE : Cet email provient du système e-Barreau (messagerie électronique du barreau français).\n" : ''}
${emailSection}

CONTEXTE DOSSIER :
${dossierContext}

Rédige maintenant la réponse en adoptant le style de l'avocate.`;

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
        temperature: 0.3,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      throw new Error(`Grok API error: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const draft = data.choices?.[0]?.message?.content?.trim() || '';

    if (!draft) {
      throw new Error('Empty response from AI');
    }

    // Clean up any accidental markdown wrapping
    const cleanDraft = draft
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    return {
      draft: cleanDraft,
      confidence: input.dossierRef ? 'high' : 'medium',
      styleMatch: `Basé sur ${style.rawSamples.length} emails envoyés par ${style.displayName}`,
    };
  } catch (err) {
    throw new Error(
      `Échec de la génération: ${(err as Error).message?.slice(0, 100)}`
    );
  }
}
