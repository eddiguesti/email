/**
 * LEARN FROM KLEOS
 *
 * Scans all open dossiers in KLEOS and builds a knowledge base:
 * - Which parties belong to which dossier
 * - Which references/RG numbers exist
 * - Which lawyers handle which cases
 * - Sender-to-dossier mappings
 *
 * Saves everything to config/kleos-knowledge.json
 * This knowledge base is then used by the dry-run pipeline for better matching.
 *
 * Usage:
 *   KLEOS_CLIENT_ID=... KLEOS_CLIENT_SECRET=... \
 *   npx ts-node config/scripts/learn-from-kleos.ts
 */

import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KLEOS_CLIENT_ID = process.env.KLEOS_CLIENT_ID;
const KLEOS_CLIENT_SECRET = process.env.KLEOS_CLIENT_SECRET;
const KLEOS_API_BASE = 'https://kleosapp.api.wolterskluwer.cloud';
const KLEOS_TOKEN_URL = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';

const OUTPUT_FILE = join(__dirname, '..', 'kleos-knowledge.json');

// ============= AUTH =============

async function getKleosToken(): Promise<string> {
  if (!KLEOS_CLIENT_ID || !KLEOS_CLIENT_SECRET) {
    throw new Error('Missing KLEOS_CLIENT_ID or KLEOS_CLIENT_SECRET');
  }

  const resp = await fetch(KLEOS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: KLEOS_CLIENT_ID,
      client_secret: KLEOS_CLIENT_SECRET,
      scope: 'kleosStateful kleosLegal kleosLegalApiClient',
    }),
  });

  if (!resp.ok) throw new Error(`Kleos auth failed: ${await resp.text()}`);
  const data = await resp.json() as { access_token: string };
  return data.access_token;
}

// ============= KLEOS API =============

interface KleosCase {
  id: number;
  name: string;
  reference: string;
  description?: string;
  typeName?: string;
  creationDate?: string;
  archived?: boolean;
  externalParties?: Array<{
    typeCode: string;
    identityId: number;
    identityFullName: string;
    reference?: string;
  }>;
  officeMembers?: Array<{
    typeCode: string;
    officeMemberId: number;
    officeMemberFullName: string;
  }>;
}

async function fetchAllCases(token: string): Promise<KleosCase[]> {
  const allCases: KleosCase[] = [];
  let page = 1;
  const pageSize = 50;
  let totalCount = 0;

  do {
    const resp = await fetch(
      `${KLEOS_API_BASE}/api/cases?currentPage=${page}&pageSize=${pageSize}&onlyOpen=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!resp.ok) {
      console.error(`  Error fetching page ${page}: ${resp.status}`);
      break;
    }

    const data = await resp.json() as {
      result: { items: KleosCase[]; totalCount: number };
    };

    totalCount = data.result.totalCount;
    const items = data.result.items || [];
    allCases.push(...items);

    const pct = Math.min(100, Math.round((allCases.length / totalCount) * 100));
    process.stdout.write(`\r  Loading cases... ${allCases.length}/${totalCount} (${pct}%)`);

    if (items.length < pageSize) break;
    page++;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  } while (allCases.length < totalCount);

  console.log();
  return allCases;
}

interface KleosContact {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  type?: string;
}

async function getContactDetails(token: string, contactId: number): Promise<KleosContact | null> {
  try {
    const resp = await fetch(`${KLEOS_API_BASE}/api/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { result: KleosContact };
    return data.result;
  } catch {
    return null;
  }
}

// ============= KNOWLEDGE BASE =============

interface DossierKnowledge {
  id: number;
  reference: string;
  name: string;
  type: string;
  creationDate: string;
  parties: Array<{
    role: string;           // POU=client, CON=opposing, EXP=expert, 2APL=other, AUT=other
    roleLabel: string;
    name: string;
    identityId: number;
    email?: string;
  }>;
  lawyers: Array<{
    role: string;           // AVR=responsible, AVC=collaborator, ORI=originator
    roleLabel: string;
    name: string;
    memberId: number;
  }>;
  keywords: string[];       // Extracted from name and description
}

interface KnowledgeBase {
  generatedAt: string;
  totalDossiers: number;
  dossiers: DossierKnowledge[];
  // Reverse lookups
  partyNameToDossiers: Record<string, Array<{ dossierId: number; dossierRef: string; confidence: number }>>;
  referenceToDossier: Record<string, { dossierId: number; dossierName: string }>;
  lawyerToDossiers: Record<string, number[]>;
  stats: {
    totalParties: number;
    totalLawyers: number;
    uniquePartyNames: number;
    caseTypes: Record<string, number>;
  };
}

const PARTY_ROLE_LABELS: Record<string, string> = {
  'POU': 'Client/Demandeur',
  'CON': 'Partie adverse',
  'EXP': 'Expert',
  'AVR': 'Avocat responsable',
  'AVC': 'Avocat collaborateur',
  'ORI': 'Apporteur',
  '2APL': 'Partie appelée',
  'AUT': 'Autre partie',
  '2NOT': 'Notaire',
  'ASS': 'Assureur',
};

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'en',
    'à', 'au', 'aux', 'par', 'pour', 'avec', 'dans', 'sur', 'sous',
    'sa', 'sas', 'sarl', 'sci', 'sci', 'eurl', 'société', 'monsieur',
    'madame', 'maître', 'cabinet', 'cie', 'compagnie',
  ]);

  return text
    .split(/[\s\/\-\(\)]+/)
    .map(w => w.replace(/[^a-zA-ZàâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g, ''))
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
    .map(w => w.toUpperCase());
}

// ============= MAIN =============

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  LEARN FROM KLEOS — Building Knowledge Base');
  console.log('='.repeat(70));

  // Auth
  console.log('\n📡 Authenticating with KLEOS...');
  const token = await getKleosToken();
  console.log('  ✅ Connected\n');

  // Fetch all open cases
  console.log('📂 Fetching all open dossiers...');
  const cases = await fetchAllCases(token);
  console.log(`  ✅ Loaded ${cases.length} open dossiers\n`);

  // Build knowledge
  console.log('🧠 Building knowledge base...');

  const dossiers: DossierKnowledge[] = [];
  const partyNameToDossiers: Record<string, Array<{ dossierId: number; dossierRef: string; confidence: number }>> = {};
  const referenceToDossier: Record<string, { dossierId: number; dossierName: string }> = {};
  const lawyerToDossiers: Record<string, number[]> = {};
  const caseTypes: Record<string, number> = {};

  let totalParties = 0;
  let totalLawyers = 0;

  for (const c of cases) {
    const dossier: DossierKnowledge = {
      id: c.id,
      reference: c.reference,
      name: c.name,
      type: c.typeName || 'Unknown',
      creationDate: c.creationDate || '',
      parties: [],
      lawyers: [],
      keywords: extractKeywords(`${c.name} ${c.description || ''}`),
    };

    // Count case types
    caseTypes[dossier.type] = (caseTypes[dossier.type] || 0) + 1;

    // Reference mapping
    referenceToDossier[c.reference] = { dossierId: c.id, dossierName: c.name };

    // Process parties
    for (const party of c.externalParties || []) {
      const cleanName = party.identityFullName.replace(/^\s+/, '').trim();
      if (!cleanName || cleanName.length < 2) continue;

      dossier.parties.push({
        role: party.typeCode,
        roleLabel: PARTY_ROLE_LABELS[party.typeCode] || party.typeCode,
        name: cleanName,
        identityId: party.identityId,
      });
      totalParties++;

      // Reverse lookup — normalize name
      const normalizedName = cleanName.toUpperCase().replace(/\s+/g, ' ');
      if (!partyNameToDossiers[normalizedName]) {
        partyNameToDossiers[normalizedName] = [];
      }

      // Higher confidence for clients (POU) and opposing parties (CON)
      let confidence = 0.6;
      if (party.typeCode === 'POU') confidence = 0.85;
      else if (party.typeCode === 'CON') confidence = 0.8;
      else if (party.typeCode === 'EXP') confidence = 0.75;
      else if (party.typeCode === 'ASS') confidence = 0.7;

      partyNameToDossiers[normalizedName].push({
        dossierId: c.id,
        dossierRef: c.reference,
        confidence,
      });
    }

    // Process lawyers
    for (const member of c.officeMembers || []) {
      const cleanName = member.officeMemberFullName.replace(/^\s+/, '').trim();
      if (!cleanName) continue;

      dossier.lawyers.push({
        role: member.typeCode,
        roleLabel: PARTY_ROLE_LABELS[member.typeCode] || member.typeCode,
        name: cleanName,
        memberId: member.officeMemberId,
      });
      totalLawyers++;

      // Lawyer lookup
      if (!lawyerToDossiers[cleanName]) {
        lawyerToDossiers[cleanName] = [];
      }
      if (!lawyerToDossiers[cleanName].includes(c.id)) {
        lawyerToDossiers[cleanName].push(c.id);
      }
    }

    dossiers.push(dossier);
  }

  const uniquePartyNames = Object.keys(partyNameToDossiers).length;

  const knowledgeBase: KnowledgeBase = {
    generatedAt: new Date().toISOString(),
    totalDossiers: dossiers.length,
    dossiers,
    partyNameToDossiers,
    referenceToDossier,
    lawyerToDossiers,
    stats: {
      totalParties,
      totalLawyers,
      uniquePartyNames,
      caseTypes,
    },
  };

  // Save
  writeFileSync(OUTPUT_FILE, JSON.stringify(knowledgeBase, null, 2), 'utf-8');

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('  KNOWLEDGE BASE SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Dossiers scanned:        ${dossiers.length}`);
  console.log(`  Total parties found:     ${totalParties}`);
  console.log(`  Unique party names:      ${uniquePartyNames}`);
  console.log(`  Total lawyer assignments: ${totalLawyers}`);
  console.log(`  Unique lawyers:          ${Object.keys(lawyerToDossiers).length}`);
  console.log(`\n  Case types:`);
  for (const [type, count] of Object.entries(caseTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count} dossiers`);
  }

  // Show top parties (most dossiers)
  const topParties = Object.entries(partyNameToDossiers)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);
  console.log(`\n  Top 15 parties (most dossiers):`);
  for (const [name, dossierList] of topParties) {
    console.log(`    ${name}: ${dossierList.length} dossiers`);
  }

  console.log(`\n  📁 Saved to: ${OUTPUT_FILE}`);
  console.log(`  📏 File size: ${(statSync(OUTPUT_FILE).size / 1024).toFixed(0)} KB\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message || err);
  process.exit(1);
});
