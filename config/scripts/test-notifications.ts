/**
 * Notification System Test Script
 *
 * Tests:
 * 1. SSE connection
 * 2. Sending notifications via API
 * 3. Notification persistence
 *
 * Usage:
 *   npx ts-node config/scripts/test-notifications.ts
 *
 * Required:
 *   - API running at localhost:7071
 *   - Valid session token
 */

const API_BASE = process.env.API_URL || 'http://localhost:7071';

interface NotificationEvent {
  type: 'email_received' | 'email_processed' | 'todo_created' | 'todo_updated' | 'system';
  data: {
    id?: string;
    title: string;
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
  console.log(`${icons[type]} ${message}`);
}

async function testSSEConnection(sessionToken: string): Promise<boolean> {
  log('Testing SSE connection...', 'info');

  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      log('SSE connection timeout after 10s', 'error');
      resolve(false);
    }, 10000);

    fetch(`${API_BASE}/api/notifications/stream`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Accept': 'text/event-stream',
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          clearTimeout(timeout);
          log(`SSE connection failed: ${response.status}`, 'error');
          resolve(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          clearTimeout(timeout);
          log('No response body reader available', 'error');
          resolve(false);
          return;
        }

        // Read the first chunk (should be connection event)
        const { value } = await reader.read();
        clearTimeout(timeout);

        if (value) {
          const text = new TextDecoder().decode(value);
          if (text.includes('event: connected')) {
            log('SSE connection established successfully', 'success');
            resolve(true);
          } else {
            log(`Unexpected SSE data: ${text}`, 'warn');
            resolve(true); // Still connected
          }
        }

        reader.cancel();
      })
      .catch((error) => {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
          return; // Already handled by timeout
        }
        log(`SSE connection error: ${error.message}`, 'error');
        resolve(false);
      });
  });
}

async function testSendNotification(serviceKey: string): Promise<boolean> {
  log('Testing notification sending...', 'info');

  const notification: { broadcast: boolean; event: NotificationEvent } = {
    broadcast: true,
    event: {
      type: 'system',
      data: {
        id: `test-${Date.now()}`,
        title: 'Test Notification',
        message: 'This is a test notification from the test script',
        timestamp: new Date().toISOString(),
      },
    },
  };

  try {
    const response = await fetch(`${API_BASE}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': serviceKey,
      },
      body: JSON.stringify(notification),
    });

    if (response.ok) {
      log('Notification sent successfully', 'success');
      return true;
    } else {
      const error = await response.text();
      log(`Failed to send notification: ${error}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Send notification error: ${error}`, 'error');
    return false;
  }
}

async function testGetNotifications(sessionToken: string): Promise<boolean> {
  log('Testing notification list endpoint...', 'info');

  try {
    const response = await fetch(`${API_BASE}/api/notifications?limit=5`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json() as { notifications: unknown[] };
      log(`Retrieved ${data.notifications.length} notifications`, 'success');
      return true;
    } else {
      const error = await response.text();
      log(`Failed to get notifications: ${error}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Get notifications error: ${error}`, 'error');
    return false;
  }
}

async function runTests() {
  console.log('\n🔔 NOTIFICATION SYSTEM TEST\n');
  console.log('='.repeat(50));

  // Check for required tokens
  const sessionToken = process.env.TEST_SESSION_TOKEN;
  const serviceKey = process.env.INTERNAL_SERVICE_KEY;

  if (!sessionToken) {
    log('TEST_SESSION_TOKEN environment variable required', 'error');
    log('Create a session by logging in, then set the token from localStorage', 'info');
    process.exit(1);
  }

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: SSE Connection
  results.push({
    name: 'SSE Connection',
    passed: await testSSEConnection(sessionToken),
  });

  // Test 2: Send Notification (if service key available)
  if (serviceKey) {
    results.push({
      name: 'Send Notification',
      passed: await testSendNotification(serviceKey),
    });
  } else {
    log('Skipping send notification test (no INTERNAL_SERVICE_KEY)', 'warn');
  }

  // Test 3: Get Notifications
  results.push({
    name: 'Get Notifications',
    passed: await testGetNotifications(sessionToken),
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!\n');
  } else {
    console.log('\n⚠️ Some tests failed.\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
