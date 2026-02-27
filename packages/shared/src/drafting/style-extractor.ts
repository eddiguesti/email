/**
 * Style Extractor
 *
 * Fetches a lawyer's sent emails from Microsoft Graph API and uses Grok
 * to extract their personal writing style (greetings, sign-offs, tone, etc.).
 * Results are cached in Supabase to avoid re-fetching every time.
 */

import type { StyleProfile, AIConfig } from './types.js';

interface GraphSentMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
}

/**
 * Fetch sent emails from a lawyer's Outlook mailbox via Graph API.
 */
export async function fetchSentEmails(
  graphToken: string,
  mailbox: string,
  count = 20
): Promise<GraphSentMessage[]> {
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}` +
    `/mailFolders('sentitems')/messages?` +
    `$top=${count}&$select=id,subject,bodyPreview,body,toRecipients` +
    `&$orderby=sentDateTime desc`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${graphToken}` },
  });

  if (!resp.ok) {
    throw new Error(`Graph API error fetching sent emails: ${resp.status}`);
  }

  const data = (await resp.json()) as { value: GraphSentMessage[] };
  return data.value || [];
}

/**
 * Strip HTML tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a writing style profile from sent emails using Grok.
 */
export async function extractStyleProfile(
  sentEmails: GraphSentMessage[],
  lawyerEmail: string,
  displayName: string,
  aiConfig: AIConfig
): Promise<StyleProfile> {
  // Extract plain text samples from sent emails
  const samples: string[] = [];
  for (const email of sentEmails.slice(0, 15)) {
    const body =
      email.body?.contentType === 'html'
        ? stripHtml(email.body.content)
        : email.body?.content || email.bodyPreview || '';
    // Keep only first 500 chars of each email
    if (body.length > 30) {
      samples.push(body.slice(0, 500));
    }
  }

  if (samples.length < 3) {
    // Not enough samples — return a default formal French style
    return defaultStyleProfile(lawyerEmail, displayName);
  }

  const systemPrompt = `You are a writing style analyst. Analyze the following sent emails from a French lawyer and extract their personal writing style.

OUTPUT FORMAT (valid JSON only, no markdown):
{
  "styleSummary": "Brief description of their writing style in 2-3 sentences",
  "sampleGreetings": ["Their typical opening lines, e.g. Maître,"],
  "sampleSignoffs": ["Their typical closing lines, e.g. Bien cordialement,"],
  "formalityLevel": "formal" or "semi-formal",
  "avgReplyLength": estimated average word count per email
}

RULES:
- Extract ACTUAL patterns from the emails, don't invent
- Keep greetings and signoffs in French exactly as written
- Be specific about their style (do they use long sentences? short? bullet points?)`;

  const userPrompt = `Here are ${samples.length} sent emails from ${displayName} (${lawyerEmail}):

${samples.map((s, i) => `--- EMAIL ${i + 1} ---\n${s}`).join('\n\n')}

Analyze their writing style and return ONLY the JSON object.`;

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
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      console.log(`Style extraction API error: ${resp.status}`);
      return defaultStyleProfile(lawyerEmail, displayName);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content || '';
    const jsonStr = raw
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error(
        'Style extraction failed, using default profile. Error:',
        parseErr instanceof Error ? parseErr.message : String(parseErr)
      );
      return defaultStyleProfile(lawyerEmail, displayName);
    }

    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    return {
      email: lawyerEmail,
      displayName,
      styleSummary: typeof parsed.styleSummary === 'string' ? parsed.styleSummary : 'Style professionnel français standard',
      sampleGreetings: Array.isArray(parsed.sampleGreetings)
        ? parsed.sampleGreetings.slice(0, 5)
        : ['Maître,'],
      sampleSignoffs: Array.isArray(parsed.sampleSignoffs)
        ? parsed.sampleSignoffs.slice(0, 5)
        : ['Bien cordialement,'],
      formalityLevel: parsed.formalityLevel === 'semi-formal' ? 'semi-formal' : 'formal',
      avgReplyLength:
        typeof parsed.avgReplyLength === 'number'
          ? parsed.avgReplyLength
          : 150,
      rawSamples: samples.slice(0, 10),
      expiresAt,
    };
  } catch (err) {
    console.error(
      'Style extraction failed, using default profile. Error:',
      err instanceof Error ? err.message : String(err)
    );
    return defaultStyleProfile(lawyerEmail, displayName);
  }
}

function defaultStyleProfile(
  email: string,
  displayName: string
): StyleProfile {
  return {
    email,
    displayName,
    styleSummary:
      'Style professionnel et formel typique d\'un avocat français. Phrases structurées, ton respectueux.',
    sampleGreetings: ['Maître,', 'Cher Maître,', 'Madame, Monsieur,'],
    sampleSignoffs: [
      'Bien cordialement,',
      'Je vous prie d\'agréer, Maître, l\'expression de mes salutations distinguées.',
    ],
    formalityLevel: 'formal',
    avgReplyLength: 150,
    rawSamples: [],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
