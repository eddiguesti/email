/**
 * Reply Generator
 *
 * Uses Grok to generate a draft reply that matches the lawyer's writing style.
 */

import type { StyleProfile, DraftReplyInput, DraftReplyResult, AIConfig } from './types.js';

/**
 * Generate a draft reply using the lawyer's style profile and the email context.
 */
export async function generateDraftReply(
  style: StyleProfile,
  input: DraftReplyInput,
  aiConfig: AIConfig
): Promise<DraftReplyResult> {
  const systemPrompt = `You are a legal email assistant for LAURENCE BROSSET AVOCATS, a French construction and insurance law firm.

YOUR TASK: Write a reply draft that matches the lawyer's personal writing style exactly.

LAWYER'S WRITING STYLE:
${style.styleSummary}

Typical greetings they use: ${style.sampleGreetings.join(' / ')}
Typical sign-offs they use: ${style.sampleSignoffs.join(' / ')}
Formality level: ${style.formalityLevel}
Average reply length: ~${style.avgReplyLength} words

RULES:
1. Write the entire reply in French
2. Match the lawyer's EXACT tone, greeting style, and sign-off style
3. Reference the dossier naturally if one is matched
4. Be professional and legally appropriate
5. Do NOT include the subject line — only the email body
6. Sign with the lawyer's name: ${style.displayName}
7. Keep it around ${style.avgReplyLength} words
8. Output ONLY the email body text, nothing else — no JSON, no markdown code blocks`;

  const dossierContext = input.dossierRef
    ? `Dossier: [${input.dossierRef}] ${input.dossierName || ''}\nClassification: ${input.matchSource || 'unknown'}\nDetails: ${input.matchReasons.join(', ')}`
    : 'No dossier matched — this may be a new matter or a general inquiry.';

  const userPrompt = `Write a reply to this email:

FROM: ${input.senderName} <${input.senderEmail}>
${input.isEBarreau ? 'NOTE: This is an e-Barreau (French legal electronic messaging system) message.\n' : ''}
CONTEXT:
${dossierContext}

Generate the reply now, using the lawyer's style.`;

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
        temperature: 0.4,
        max_tokens: 800,
      }),
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
