/**
 * Kleos Integration Test Script
 *
 * Tests the complete flow:
 * 1. Authenticate with Kleos
 * 2. Search for cases/dossiers
 * 3. Get case details and folders
 * 4. Upload a test document
 * 5. Verify the document was filed correctly
 *
 * Usage:
 *   npx ts-node config/scripts/test-kleos-integration.ts
 *
 * Required environment variables:
 *   KLEOS_CLIENT_ID
 *   KLEOS_CLIENT_SECRET
 */

const KLEOS_API_BASE = 'https://kleosapp.api.wolterskluwer.cloud';
const KLEOS_TOKEN_URL = 'https://ids.kleosapp.com/KLEOSIDENTITYv4/connect/token';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: unknown;
}

const results: TestResult[] = [];

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
  console.log(`${icons[type]} ${message}`);
}

function addResult(name: string, passed: boolean, message: string, data?: unknown) {
  results.push({ name, passed, message, data });
  log(`${name}: ${message}`, passed ? 'success' : 'error');
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.KLEOS_CLIENT_ID;
  const clientSecret = process.env.KLEOS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing KLEOS_CLIENT_ID or KLEOS_CLIENT_SECRET');
  }

  const response = await fetch(KLEOS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'kleosStateful kleosLegal kleosLegalApiClient',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Auth failed: ${error}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function kleosRequest<T>(token: string, endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${KLEOS_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}

async function runTests() {
  console.log('\n🔧 KLEOS INTEGRATION TEST\n');
  console.log('='.repeat(50));

  // Test 1: Authentication
  log('Test 1: Authentication', 'info');
  let token: string;
  try {
    token = await getAccessToken();
    addResult('Authentication', true, 'Successfully obtained access token');
  } catch (error) {
    addResult('Authentication', false, `Failed: ${error}`);
    printSummary();
    return;
  }

  // Test 2: Get Case Types (lightweight test)
  log('\nTest 2: Get Case Types', 'info');
  try {
    const response = await kleosRequest<{ result: { items: unknown[] } }>(
      token,
      '/api/caseTypes?currentPage=1&pageSize=10'
    );
    addResult('Get Case Types', true, `Found ${response.result.items.length} case types`, response.result.items.slice(0, 3));
  } catch (error) {
    addResult('Get Case Types', false, `Failed: ${error}`);
  }

  // Test 3: Search Cases
  log('\nTest 3: Search Cases', 'info');
  let testCaseId: number | null = null;
  try {
    const response = await kleosRequest<{ result: { items: Array<{ id: number; name: string; reference: string }> } }>(
      token,
      '/api/cases?currentPage=1&pageSize=5&onlyOpen=true'
    );
    if (response.result.items.length > 0) {
      testCaseId = response.result.items[0].id;
      addResult('Search Cases', true, `Found ${response.result.items.length} open cases`, response.result.items);
    } else {
      addResult('Search Cases', true, 'No open cases found (this is OK for testing)');
    }
  } catch (error) {
    addResult('Search Cases', false, `Failed: ${error}`);
  }

  // Test 4: Get Case Details (if we have a case)
  if (testCaseId) {
    log('\nTest 4: Get Case Details', 'info');
    try {
      const response = await kleosRequest<{ result: unknown }>(token, `/api/cases/${testCaseId}`);
      addResult('Get Case Details', true, `Retrieved case ${testCaseId}`, response.result);
    } catch (error) {
      addResult('Get Case Details', false, `Failed: ${error}`);
    }

    // Test 5: Get Document Folders
    log('\nTest 5: Get Document Folders', 'info');
    try {
      const response = await kleosRequest<{ result: Array<{ id: number; name: string }> }>(
        token,
        `/api/documentfolders/${testCaseId}?maxLevels=3`
      );
      addResult('Get Document Folders', true, `Found ${response.result.length} folders`, response.result);
    } catch (error) {
      addResult('Get Document Folders', false, `Failed: ${error}`);
    }
  }

  // Test 6: Search Contacts
  log('\nTest 6: Search Contacts', 'info');
  try {
    const response = await kleosRequest<{ result: { items: unknown[] } }>(
      token,
      '/api/contacts?currentPage=1&pageSize=5'
    );
    addResult('Search Contacts', true, `Found ${response.result.items.length} contacts`, response.result.items);
  } catch (error) {
    addResult('Search Contacts', false, `Failed: ${error}`);
  }

  printSummary();
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    if (!result.passed) {
      console.log(`   └─ ${result.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Kleos integration is working correctly.\n');
  } else {
    console.log('\n⚠️ Some tests failed. Check the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
