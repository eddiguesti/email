/**
 * Outlook Category Color-Coding
 * Applies LB-BOT Outlook categories to emails based on their processing status.
 * Uses the Office.js item.categories API (requires ReadWriteMailbox permission).
 *
 * Color map:
 *   LB - Classé      → Green  (filed / done)
 *   LB - À revoir    → Orange (matched, needs review)
 *   LB - Non classé  → Red    (no match found)
 *   LB - e-Barreau   → Blue   (e-Barreau source)
 *   LB - Ignoré      → Grey   (skipped / spam)
 */

/** All LB category definitions with their Outlook colour presets */
const LB_CATEGORIES: Office.CategoryDetails[] = [
  { displayName: 'LB - Classé',     color: Office.MailboxEnums.CategoryColor.Preset4  }, // Green
  { displayName: 'LB - À revoir',   color: Office.MailboxEnums.CategoryColor.Preset1  }, // Orange
  { displayName: 'LB - Non classé', color: Office.MailboxEnums.CategoryColor.Preset0  }, // Red
  { displayName: 'LB - e-Barreau',  color: Office.MailboxEnums.CategoryColor.Preset7  }, // Blue
  { displayName: 'LB - Ignoré',     color: Office.MailboxEnums.CategoryColor.Preset12 }, // Grey
];

const ALL_LB_NAMES = LB_CATEGORIES.map(c => c.displayName);

/** Determine the right LB category for a given processing status object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCategoryForStatus(status: any): string | null {
  if (!status) return null;

  if (status.found === false) return 'LB - Non classé';

  const record = status.record;
  if (!record) return null;

  if (record.status === 'FILED' || record.status === 'DONE') return 'LB - Classé';
  if (record.status === 'SKIPPED') return 'LB - Ignoré';

  const source: string = (status.suggestedDossier?.source || '').toLowerCase();
  if (source.includes('barreau')) return 'LB - e-Barreau';

  // Approved but not yet filed, or in review queue
  return 'LB - À revoir';
}

/**
 * Apply a colour category to the current Outlook email.
 * Removes any previously applied LB categories first.
 * Safe to call outside Outlook (silently no-ops).
 */
export function applyEmailCategory(category: string): void {
  try {
    if (
      typeof Office === 'undefined' ||
      !Office?.context?.mailbox?.item?.categories ||
      !Office?.context?.mailbox?.masterCategories
    ) return;

    // 1. Ensure all LB categories exist in the master list
    Office.context.mailbox.masterCategories.addAsync(LB_CATEGORIES, masterResult => {
      if (masterResult.status !== Office.AsyncResultStatus.Succeeded) {
        console.error('Office.js category operation failed:', masterResult.error?.message);
        return;
      }

      // 2. Read existing categories on this email
      Office.context.mailbox.item!.categories.getAsync(getResult => {
        if (getResult.status !== Office.AsyncResultStatus.Succeeded) {
          console.error('Office.js category operation failed:', getResult.error?.message);
          return;
        }

        const existingLB = getResult.value
          .filter(c => ALL_LB_NAMES.includes(c.displayName))
          .map(c => c.displayName);

        const addCategory = () => {
          Office.context.mailbox.item!.categories.addAsync([category], addResult => {
            if (addResult.status !== Office.AsyncResultStatus.Succeeded) {
              console.error('Office.js category operation failed:', addResult.error?.message);
            }
          });
        };

        // 3. Remove stale LB categories, then apply the new one
        if (existingLB.length > 0) {
          Office.context.mailbox.item!.categories.removeAsync(existingLB, removeResult => {
            if (removeResult.status !== Office.AsyncResultStatus.Succeeded) {
              console.error('Office.js category operation failed:', removeResult.error?.message);
              return;
            }
            addCategory();
          });
        } else {
          addCategory();
        }
      });
    });
  } catch {
    // Never throw — Office.js errors must not crash the add-in UI
  }
}

/** Convenience: derive and apply the category from a status object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function colorCodeEmailByStatus(status: any): void {
  const category = getCategoryForStatus(status);
  if (category) applyEmailCategory(category);
}
