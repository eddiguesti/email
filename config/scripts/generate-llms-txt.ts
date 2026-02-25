/**
 * Generate llms.txt from Webflow CMS
 *
 * Pulls all published blog posts from the Webflow Actualités collection
 * and generates an up-to-date llms.txt file.
 *
 * Usage:
 *   set -a && source config/.env && set +a
 *   pnpm generate:llms
 *
 * Requires WEBFLOW_API_TOKEN in environment.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const ACTUALITES_COLLECTION_ID = '648ef243a96e5e16f4ac7dcf';
const SITE_URL = 'https://www.laurencebrosset-avocats.fr';
const OUTPUT_PATH = resolve(import.meta.dirname, '../../llms.txt');

const WEBFLOW_LIMIT = 100; // Webflow API v2 max per page
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

interface WebflowItem {
  id: string;
  isArchived: boolean;
  isDraft: boolean;
  fieldData: {
    name: string;
    slug: string;
    description?: string;
  };
}

interface WebflowResponse {
  items: WebflowItem[];
  pagination: { limit: number; offset: number; total: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchPage(offset: number, attempt = 1): Promise<WebflowResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      `https://api.webflow.com/v2/collections/${ACTUALITES_COLLECTION_ID}/items?limit=${WEBFLOW_LIMIT}&offset=${offset}`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          accept: 'application/json',
        },
      }
    );
  } catch (err) {
    clearTimeout(timer);
    if (attempt < MAX_RETRIES) {
      const wait = attempt * 1_000;
      console.warn(`  Fetch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${wait}ms...`);
      await sleep(wait);
      return fetchPage(offset, attempt + 1);
    }
    throw err;
  }
  clearTimeout(timer);

  // Rate limit — back off and retry
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') ?? 2) * 1_000;
    if (attempt < MAX_RETRIES) {
      console.warn(`  Rate limited. Waiting ${retryAfter}ms before retry ${attempt}/${MAX_RETRIES}...`);
      await sleep(retryAfter);
      return fetchPage(offset, attempt + 1);
    }
    throw new Error('Webflow rate limit exceeded after max retries');
  }

  if (!res.ok) {
    throw new Error(`Webflow API error: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<WebflowResponse>;
}

async function fetchCollectionItems(): Promise<WebflowItem[]> {
  // First page gives us the total count
  const firstPage = await fetchPage(0);
  const { total } = firstPage.pagination;
  const allItems: WebflowItem[] = [...firstPage.items];

  // Fetch remaining pages in parallel
  if (total > WEBFLOW_LIMIT) {
    const offsets: number[] = [];
    for (let offset = WEBFLOW_LIMIT; offset < total; offset += WEBFLOW_LIMIT) {
      offsets.push(offset);
    }
    const pages = await Promise.all(offsets.map((offset) => fetchPage(offset)));
    for (const page of pages) allItems.push(...page.items);
  }

  return allItems.filter((item) => !item.isDraft && !item.isArchived);
}

function sanitize(text: string): string {
  return text.trim().replace(/[\r\n\t]+/g, ' ');
}

function generateLlmsTxt(blogPosts: WebflowItem[]): string {
  const blogLines = blogPosts
    .map((post) => {
      const title = sanitize(post.fieldData.name);
      const slug = encodeURIComponent(post.fieldData.slug);
      const desc = post.fieldData.description ? sanitize(post.fieldData.description) : '';
      const url = `${SITE_URL}/detail_actualites/${slug}`;
      return `- [${title}](${url})${desc ? `: ${desc}` : ''}`;
    })
    .join('\n');

  return `# SELARL BROSSET-TECHER

> Cabinet d'avocats spécialisé en droit de la construction, assurances, urbanisme et commande publique à Paris. Accompagnement sur-mesure des acteurs de l'immobilier.

## Pages

- [Accueil](${SITE_URL}/): Cabinet d'avocats spécialisé en droit de la construction, assurances, urbanisme et commande publique à Paris.
- [Le Cabinet](${SITE_URL}/cabinet): Histoire, valeurs et expertise en droit immobilier, construction, urbanisme et droit public.
- [Compétences](${SITE_URL}/competences): Domaines d'expertise — droit de la construction, assurance construction, urbanisme, commande publique et gestion locative.
- [L'Équipe](${SITE_URL}/equipe): Présentation des avocats du cabinet, experts en droit de la construction et immobilier.
- [Actualités](${SITE_URL}/actualites): Index de tous les articles et analyses juridiques. Contenu régulièrement mis à jour.
- [Contact](${SITE_URL}/contact): Coordonnées et formulaire de contact pour prendre rendez-vous.

## Actualités (${blogPosts.length} articles)

${blogLines}

## Informations légales

- [Mentions Légales](${SITE_URL}/mention-legal): Informations juridiques et administratives du cabinet.
- [Politique de Confidentialité](${SITE_URL}/politique-de-confidentialite): Protection des données personnelles et normes de confidentialité.
`;
}

async function main() {
  if (!WEBFLOW_API_TOKEN) {
    console.error('Missing WEBFLOW_API_TOKEN in environment variables.');
    console.error('Run: set -a && source config/.env && set +a');
    process.exit(1);
  }

  console.log('Fetching blog posts from Webflow CMS...');
  const posts = await fetchCollectionItems();
  console.log(`Found ${posts.length} published blog posts.`);

  const content = generateLlmsTxt(posts);

  // Skip write if nothing changed
  try {
    const existing = readFileSync(OUTPUT_PATH, 'utf-8');
    if (existing === content) {
      console.log('llms.txt is already up to date — no changes written.');
      return;
    }
  } catch {
    // File doesn't exist yet, proceed with write
  }

  writeFileSync(OUTPUT_PATH, content, 'utf-8');
  console.log(`llms.txt generated at ${OUTPUT_PATH}`);
  console.log('\nUpload this file to Webflow: Site Settings → LLMs.txt → Upload');
}

main().catch((err) => {
  console.error('Failed to generate llms.txt:', err);
  process.exit(1);
});
