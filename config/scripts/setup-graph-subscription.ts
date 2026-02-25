/**
 * Graph Subscription Setup Script
 * Creates or renews webhook subscriptions for monitored mailboxes
 */

import 'dotenv/config';
import { Client } from '@microsoft/microsoft-graph-client';

const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const WEBHOOK_CLIENT_STATE = process.env.WEBHOOK_CLIENT_STATE!;
const MAILBOXES = (process.env.MONITORED_MAILBOXES || '').split(',').map(m => m.trim()).filter(Boolean);

async function getAccessToken(): Promise<string> {
  const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function main() {
  console.log('=== Graph Subscription Setup ===\n');

  // Validate environment
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('ERROR: Missing Azure AD credentials');
    console.error('Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET');
    process.exit(1);
  }

  if (!WEBHOOK_URL || !WEBHOOK_CLIENT_STATE) {
    console.error('ERROR: Missing webhook configuration');
    console.error('Set WEBHOOK_URL and WEBHOOK_CLIENT_STATE');
    process.exit(1);
  }

  if (MAILBOXES.length === 0) {
    console.error('ERROR: No mailboxes configured');
    console.error('Set MONITORED_MAILBOXES (comma-separated)');
    process.exit(1);
  }

  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Mailboxes: ${MAILBOXES.join(', ')}\n`);

  // Get access token
  console.log('Getting access token...');
  const token = await getAccessToken();

  // Create Graph client
  const client = Client.init({
    authProvider: (done) => done(null, token),
  });

  // List existing subscriptions
  console.log('Checking existing subscriptions...\n');
  const existingSubs = await client.api('/subscriptions').get();

  for (const sub of existingSubs.value || []) {
    console.log(`  Found: ${sub.id}`);
    console.log(`    Resource: ${sub.resource}`);
    console.log(`    Expires: ${sub.expirationDateTime}`);

    // Check if expired or expiring soon
    const expiresAt = new Date(sub.expirationDateTime);
    const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 24) {
      console.log(`    Status: Renewing (expires in ${Math.round(hoursUntilExpiry)} hours)`);

      // Renew
      const newExpiry = new Date();
      newExpiry.setMinutes(newExpiry.getMinutes() + 4230); // Max ~3 days

      try {
        await client.api(`/subscriptions/${sub.id}`).update({
          expirationDateTime: newExpiry.toISOString(),
        });
        console.log(`    Renewed until: ${newExpiry.toISOString()}`);
      } catch (error) {
        console.error(`    Failed to renew: ${error}`);
      }
    } else {
      console.log(`    Status: Active (${Math.round(hoursUntilExpiry)} hours remaining)`);
    }
  }

  // Create subscriptions for mailboxes without one
  console.log('\nCreating new subscriptions...\n');

  for (const mailbox of MAILBOXES) {
    const resource = `/users/${mailbox}/mailFolders('Inbox')/messages`;

    // Check if subscription exists
    const existing = existingSubs.value?.find((s: any) =>
      s.resource.toLowerCase() === resource.toLowerCase()
    );

    if (existing) {
      console.log(`  ${mailbox}: Subscription already exists (${existing.id})`);
      continue;
    }

    console.log(`  ${mailbox}: Creating subscription...`);

    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 4230);

    try {
      const subscription = await client.api('/subscriptions').post({
        changeType: 'created',
        notificationUrl: WEBHOOK_URL,
        resource,
        expirationDateTime: expiration.toISOString(),
        clientState: WEBHOOK_CLIENT_STATE,
      });

      console.log(`    Created: ${subscription.id}`);
      console.log(`    Expires: ${subscription.expirationDateTime}`);
    } catch (error: any) {
      console.error(`    Failed: ${error.message || error}`);

      if (error.message?.includes('validation')) {
        console.error('    Make sure your webhook URL is accessible and returns 200 with validationToken');
      }
    }
  }

  console.log('\n=== Setup Complete ===');
  console.log('\nNext steps:');
  console.log('1. Start ngrok tunnel: pnpm tunnel');
  console.log('2. Start API: pnpm dev:api');
  console.log('3. Start Worker: pnpm dev:worker');
  console.log('4. Sideload add-in: cd add-in && pnpm sideload');
}

main().catch(console.error);
