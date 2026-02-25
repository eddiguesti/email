/**
 * Kleos Browser Automation (RPA)
 *
 * Automates invoice creation in Kleos web interface using Playwright.
 * This is needed because Kleos API doesn't support invoice creation.
 *
 * Features:
 * - Login to Kleos web interface
 * - Create invoices from billing items
 * - Download invoice PDFs
 * - Mark items as billed
 *
 * Required: pnpm add playwright (optional - only if using browser automation)
 */

// Minimal type definitions for Playwright (to avoid requiring the package at compile time)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BrowserContext = any;

// Kleos URLs
const KLEOS_BASE_URL = 'https://app.kleos.fr'; // Adjust for your region
const KLEOS_LOGIN_URL = `${KLEOS_BASE_URL}/Account/Login`;

// Credentials from environment
const KLEOS_USERNAME = process.env.KLEOS_WEB_USERNAME;
const KLEOS_PASSWORD = process.env.KLEOS_WEB_PASSWORD;

// Browser instance (reused for performance)
let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * Load Playwright dynamically
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPlaywright(): Promise<any> {
  try {
    // Dynamic import - Playwright is optional
    // Using variable to bypass TypeScript module resolution
    const moduleName = 'playwright';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(moduleName);
  } catch {
    throw new Error(
      'Playwright is not installed. Run: pnpm add playwright\n' +
      'Browser automation features require Playwright to be installed.'
    );
  }
}

/**
 * Initialize browser instance
 */
async function initBrowser(): Promise<void> {
  const { chromium } = await loadPlaywright();

  if (!browser) {
    browser = await chromium.launch({
      headless: true, // Set to false for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    });
  }
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Login to Kleos web interface
 */
async function login(page: Page): Promise<boolean> {
  if (!KLEOS_USERNAME || !KLEOS_PASSWORD) {
    throw new Error('KLEOS_WEB_USERNAME and KLEOS_WEB_PASSWORD required');
  }

  try {
    await page.goto(KLEOS_LOGIN_URL, { waitUntil: 'networkidle' });

    // Fill login form
    await page.fill('input[name="Username"], input[id="Username"]', KLEOS_USERNAME);
    await page.fill('input[name="Password"], input[id="Password"]', KLEOS_PASSWORD);

    // Submit
    await page.click('button[type="submit"], input[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/Dashboard**', { timeout: 30000 });

    return true;
  } catch (error) {
    console.error('Kleos login failed:', error);
    return false;
  }
}

/**
 * Check if already logged in
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Try to access a protected page
    await page.goto(`${KLEOS_BASE_URL}/Dashboard`, { waitUntil: 'networkidle', timeout: 10000 });
    return !page.url().includes('Login');
  } catch {
    return false;
  }
}

/**
 * Navigate to billing/invoicing section
 */
async function navigateToBilling(page: Page): Promise<void> {
  // Click on Facturation menu (adjust selector based on actual Kleos UI)
  await page.click('text=Facturation, a:has-text("Facturation")');
  await page.waitForLoadState('networkidle');
}

/**
 * Create invoice from billing items
 */
export interface CreateInvoiceParams {
  caseId?: number;
  clientId?: number;
  billingItemIds?: number[];
  invoiceDate?: Date;
  dueDate?: Date;
  notes?: string;
}

export interface CreateInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  invoiceId?: number;
  pdfPath?: string;
  error?: string;
}

/**
 * Create an invoice in Kleos via browser automation
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  await initBrowser();

  const page = await context!.newPage();

  try {
    // Login if needed
    if (!(await isLoggedIn(page))) {
      const loggedIn = await login(page);
      if (!loggedIn) {
        return { success: false, error: 'Login failed' };
      }
    }

    // Navigate to billing
    await navigateToBilling(page);

    // The following steps depend on Kleos UI structure
    // This is a template that needs to be adapted to actual Kleos interface

    // 1. Go to "Créer une facture" or similar
    await page.click('text=Nouvelle facture, button:has-text("Créer")');
    await page.waitForLoadState('networkidle');

    // 2. Select case/client if specified
    if (params.caseId) {
      await page.fill('input[placeholder*="dossier"], input[name="caseSearch"]', String(params.caseId));
      await page.waitForTimeout(500);
      await page.click('.search-result:first-child, .autocomplete-item:first-child');
    }

    // 3. Select billing items to include
    if (params.billingItemIds && params.billingItemIds.length > 0) {
      for (const itemId of params.billingItemIds) {
        await page.click(`input[data-item-id="${itemId}"], tr[data-id="${itemId}"] input[type="checkbox"]`);
      }
    } else {
      // Select all unbilled items
      await page.click('input[name="selectAll"], th input[type="checkbox"]');
    }

    // 4. Set invoice date
    if (params.invoiceDate) {
      const dateStr = params.invoiceDate.toISOString().split('T')[0];
      await page.fill('input[name="invoiceDate"], input[type="date"]', dateStr);
    }

    // 5. Add notes if provided
    if (params.notes) {
      await page.fill('textarea[name="notes"], textarea[name="comments"]', params.notes);
    }

    // 6. Create/Save invoice
    await page.click('button:has-text("Créer"), button:has-text("Enregistrer"), button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // 7. Get invoice number from success message or redirect
    const invoiceNumber = await page.textContent('.invoice-number, .success-message strong');

    // 8. Download PDF
    let pdfPath: string | undefined;
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }),
        page.click('button:has-text("PDF"), a:has-text("Télécharger")'),
      ]);
      pdfPath = await download.path();
    } catch {
      // PDF download optional
    }

    return {
      success: true,
      invoiceNumber: invoiceNumber?.trim(),
      pdfPath,
    };
  } catch (error) {
    console.error('Create invoice failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await page.close();
  }
}

/**
 * Batch create invoices for multiple cases/clients
 */
export async function batchCreateInvoices(
  items: Array<{ caseId: number; clientId?: number; billingItemIds?: number[] }>
): Promise<CreateInvoiceResult[]> {
  const results: CreateInvoiceResult[] = [];

  for (const item of items) {
    const result = await createInvoice(item);
    results.push(result);

    // Small delay between invoices to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

/**
 * Get unbilled items grouped by case for invoice creation
 */
export interface UnbilledItemsGroup {
  caseId: number;
  caseName: string;
  caseReference: string;
  clientId?: number;
  clientName?: string;
  items: Array<{
    id: number;
    description: string;
    amount: number;
    date: string;
  }>;
  totalAmount: number;
}

/**
 * Download invoice PDF by invoice number
 */
export async function downloadInvoicePdf(invoiceNumber: string): Promise<Buffer | null> {
  await initBrowser();

  const page = await context!.newPage();

  try {
    if (!(await isLoggedIn(page))) {
      const loggedIn = await login(page);
      if (!loggedIn) {
        throw new Error('Login failed');
      }
    }

    // Navigate to invoice
    await page.goto(`${KLEOS_BASE_URL}/Billing/Invoice/${invoiceNumber}`, { waitUntil: 'networkidle' });

    // Click download PDF
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("PDF"), a:has-text("Télécharger PDF")'),
    ]);

    const path = await download.path();
    if (path) {
      const fs = await import('fs/promises');
      return await fs.readFile(path);
    }

    return null;
  } catch (error) {
    console.error('Download PDF failed:', error);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Check if Kleos web automation is configured
 */
export function isKleosAutomationConfigured(): boolean {
  return !!(KLEOS_USERNAME && KLEOS_PASSWORD);
}

/**
 * Check if Playwright is available
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    await loadPlaywright();
    return true;
  } catch {
    return false;
  }
}

/**
 * Test Kleos web login
 */
export async function testKleosLogin(): Promise<{ success: boolean; error?: string }> {
  await initBrowser();

  const page = await context!.newPage();

  try {
    const loggedIn = await login(page);
    return { success: loggedIn };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await page.close();
  }
}
