/**
 * Category Classifier
 *
 * Assigns an Outlook-style color category to each processed email.
 * Same rules for everyone — no per-user customization.
 *
 * Categories:
 *   Green  — "LB - Classé"         — matched >= 85% (auto-file)
 *   Orange — "LB - À vérifier"     — matched 60-85% (needs review)
 *   Red    — "LB - Non classé"     — no match found
 *   Blue   — "LB - eBarreau"       — e-Barreau message
 *   Grey   — "LB - Ignoré"         — spam, newsletters, system emails (skipped)
 *   Purple — "LB - Nouveau contact" — no match + never seen this sender before
 */

export interface CategoryResult {
  label: string;
  color: 'green' | 'orange' | 'red' | 'blue' | 'grey' | 'purple';
}

export interface CategoryInput {
  matched: boolean;
  confidence: number | null;
  isEBarreau: boolean;
  skipped: boolean;
  hasSenderHistory: boolean;
}

export function classifyCategory(input: CategoryInput): CategoryResult {
  // Priority order matters

  // 1. Skipped emails (spam, newsletters, system) → Grey
  if (input.skipped) {
    return { label: 'LB - Ignoré', color: 'grey' };
  }

  // 2. e-Barreau → Blue (even if matched — it's a distinct category)
  if (input.isEBarreau) {
    return { label: 'LB - eBarreau', color: 'blue' };
  }

  // 3. Matched with high confidence → Green
  if (input.matched && input.confidence !== null && input.confidence >= 0.85) {
    return { label: 'LB - Classé', color: 'green' };
  }

  // 4. Matched with medium confidence → Orange
  if (input.matched && input.confidence !== null && input.confidence >= 0.60) {
    return { label: 'LB - À vérifier', color: 'orange' };
  }

  // 5. No match + no sender history → Purple (new contact)
  if (!input.matched && !input.hasSenderHistory) {
    return { label: 'LB - Nouveau contact', color: 'purple' };
  }

  // 6. No match → Red
  return { label: 'LB - Non classé', color: 'red' };
}
