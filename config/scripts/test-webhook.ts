/**
 * Test Webhook Script
 * Simulates a Graph webhook notification for testing
 */

import 'dotenv/config';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:7071/api/webhook/graph';
const CLIENT_STATE = process.env.WEBHOOK_CLIENT_STATE || 'test-client-state';

async function main() {
  console.log('=== Webhook Test ===\n');

  // Test 1: Validation endpoint
  console.log('Test 1: Validation token...');
  const validationToken = 'test-validation-token-' + Date.now();

  try {
    const validationResponse = await fetch(`${WEBHOOK_URL}?validationToken=${validationToken}`);
    const validationBody = await validationResponse.text();

    if (validationResponse.ok && validationBody === validationToken) {
      console.log('  ✓ Validation passed\n');
    } else {
      console.log(`  ✗ Validation failed: ${validationResponse.status} - ${validationBody}\n`);
    }
  } catch (error) {
    console.log(`  ✗ Connection failed: ${error}\n`);
  }

  // Test 2: Notification payload
  console.log('Test 2: Notification payload...');

  const testNotification = {
    value: [
      {
        subscriptionId: 'test-subscription-id',
        subscriptionExpirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        changeType: 'created',
        resource: '/users/test@example.com/mailFolders(\'Inbox\')/messages/test-message-id',
        resourceData: {
          '@odata.type': '#Microsoft.Graph.Message',
          '@odata.id': '/users/test@example.com/messages/test-message-id',
          '@odata.etag': 'W/"test"',
          id: 'test-message-id-' + Date.now(),
        },
        clientState: CLIENT_STATE,
        tenantId: 'test-tenant-id',
      },
    ],
  };

  try {
    const notificationResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testNotification),
    });

    const notificationBody = await notificationResponse.json();

    if (notificationResponse.ok) {
      console.log('  ✓ Notification accepted');
      console.log(`    Response: ${JSON.stringify(notificationBody)}\n`);
    } else {
      console.log(`  ✗ Notification rejected: ${notificationResponse.status}`);
      console.log(`    Response: ${JSON.stringify(notificationBody)}\n`);
    }
  } catch (error) {
    console.log(`  ✗ Connection failed: ${error}\n`);
  }

  // Test 3: Invalid client state (should be logged but accepted)
  console.log('Test 3: Invalid client state...');

  const invalidNotification = {
    value: [
      {
        ...testNotification.value[0],
        clientState: 'invalid-client-state',
        resourceData: {
          ...testNotification.value[0].resourceData,
          id: 'invalid-message-id-' + Date.now(),
        },
      },
    ],
  };

  try {
    const invalidResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidNotification),
    });

    const invalidBody = await invalidResponse.json();

    if (invalidResponse.ok && invalidBody.processed === 0) {
      console.log('  ✓ Invalid notification correctly ignored');
      console.log(`    Response: ${JSON.stringify(invalidBody)}\n`);
    } else {
      console.log(`  ? Unexpected response: ${JSON.stringify(invalidBody)}\n`);
    }
  } catch (error) {
    console.log(`  ✗ Connection failed: ${error}\n`);
  }

  console.log('=== Tests Complete ===');
}

main().catch(console.error);
