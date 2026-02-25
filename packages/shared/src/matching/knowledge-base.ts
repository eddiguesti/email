/**
 * Knowledge Base Loader
 * Loads and indexes the KLEOS knowledge base for dossier matching.
 */

import { readFileSync } from 'node:fs';
import type { KnowledgeBase, DossierKnowledge, MailboxOwner } from './types.js';

/**
 * Load knowledge base from a JSON file path.
 */
export function loadKnowledgeBase(jsonPath: string): KnowledgeBase {
  const raw = readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw) as KnowledgeBase;
}

/**
 * Load knowledge base from a Buffer (for Azure Blob Storage / bundled deployments).
 */
export function loadKnowledgeBaseFromBuffer(buffer: Buffer): KnowledgeBase {
  return JSON.parse(buffer.toString('utf-8')) as KnowledgeBase;
}

/**
 * Build reverse lookup: dossier ID → dossier knowledge.
 */
export function buildDossierIndex(kb: KnowledgeBase): Map<number, DossierKnowledge> {
  const index = new Map<number, DossierKnowledge>();
  for (const d of kb.dossiers) {
    index.set(d.id, d);
  }
  return index;
}

/**
 * Resolve mailbox email to the lawyer who owns it and their assigned dossiers.
 * Returns null for shared/generic mailboxes (cabinet@, info@, etc.)
 */
export function resolveMailboxOwner(mailbox: string, kb: KnowledgeBase): MailboxOwner | null {
  const prefix = mailbox.split('@')[0].toLowerCase();
  // Skip shared/generic mailboxes — no single lawyer to scope to
  if (['cabinet', 'info', 'contact', 'accueil'].includes(prefix)) return null;

  for (const [lawyerName, dossierIds] of Object.entries(kb.lawyerToDossiers)) {
    const parts = lawyerName.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length < 2) continue;

    const firstName = parts[0].toLowerCase();
    const lastName = parts[parts.length - 1].toLowerCase();
    const initials = firstName[0] + lastName[0];

    if (prefix === initials || prefix === firstName) {
      const dossierSet = new Set(dossierIds);
      const dossiers = kb.dossiers.filter(d => dossierSet.has(d.id));
      return { lawyerName, dossierIds: dossierSet, dossiers };
    }
  }
  return null;
}

/**
 * Map TO/CC recipient emails to their assigned dossier IDs (for recipient boost).
 */
export function resolveRecipientDossiers(
  recipients: Array<{ emailAddress: { name: string; address: string } }>,
  kb: KnowledgeBase
): Set<number> {
  const boostedDossiers = new Set<number>();
  for (const r of recipients) {
    const addr = r.emailAddress?.address?.toLowerCase() || '';
    if (!addr.endsWith('@lbrosset.com')) continue;
    const owner = resolveMailboxOwner(addr, kb);
    if (owner) {
      for (const id of owner.dossierIds) {
        boostedDossiers.add(id);
      }
    }
  }
  return boostedDossiers;
}

/**
 * Get the responsible lawyer (AVR) for a dossier.
 */
export function getLawyer(dossierId: number, dossierById: Map<number, DossierKnowledge>): string {
  const d = dossierById.get(dossierId);
  if (!d) return 'N/A';
  const avr = d.lawyers.find(l => l.role === 'AVR');
  return avr?.name || d.lawyers[0]?.name || 'N/A';
}
