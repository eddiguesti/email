/**
 * Seed Test Data
 * Creates sample processing records and thread mappings for testing
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function main() {
  console.log('=== Seeding Test Data ===\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('ERROR: Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Test mailbox
  const testMailbox = process.env.MONITORED_MAILBOXES?.split(',')[0] || 'test@example.com';

  // Seed processing records
  console.log('Creating sample processing records...');

  const sampleRecords = [
    {
      message_id: 'test-message-1',
      mailbox: testMailbox,
      status: 'READY_FOR_REVIEW',
      subject: 'RE: Dossier Dupont c/ Martin - RG 23/1234/A',
      sender: 'client@example.com',
      recipients: ['lawyer@firm.be'],
      received_at: new Date(Date.now() - 3600000).toISOString(),
      thread_id: 'thread-1',
      conversation_id: 'thread-1',
      extracted_rg_numbers: ['23/1234/A'],
      extracted_entities: {
        rgNumbers: ['23/1234/A'],
        subject: 'RE: Dossier Dupont c/ Martin - RG 23/1234/A',
        sender: 'client@example.com',
      },
      match_confidence: 0.95,
      match_method: 'rg_match',
      matched_dossier_id: 'dossier-001',
    },
    {
      message_id: 'test-message-2',
      mailbox: testMailbox,
      status: 'MATCHED',
      subject: 'Question about fee payment',
      sender: 'accounting@client.be',
      recipients: ['lawyer@firm.be'],
      received_at: new Date(Date.now() - 7200000).toISOString(),
      thread_id: 'thread-2',
      conversation_id: 'thread-2',
      extracted_rg_numbers: [],
      extracted_entities: {
        subject: 'Question about fee payment',
        sender: 'accounting@client.be',
        entities: { money: ['€1,500'] },
      },
      match_confidence: 0.7,
      match_method: 'sender_hint',
      matched_dossier_id: 'dossier-002',
    },
    {
      message_id: 'test-message-3',
      mailbox: testMailbox,
      status: 'EXTRACTED',
      subject: 'New matter: Employment dispute',
      sender: 'new.client@company.be',
      recipients: ['lawyer@firm.be'],
      received_at: new Date(Date.now() - 1800000).toISOString(),
      thread_id: 'thread-3',
      conversation_id: 'thread-3',
      extracted_rg_numbers: [],
      extracted_entities: {
        subject: 'New matter: Employment dispute',
        sender: 'new.client@company.be',
      },
      match_confidence: null,
      match_method: null,
      matched_dossier_id: null,
    },
  ];

  for (const record of sampleRecords) {
    const { error } = await supabase
      .from('processing_records')
      .upsert(record, { onConflict: 'message_id' });

    if (error) {
      console.log(`  ✗ Failed to create ${record.message_id}: ${error.message}`);
    } else {
      console.log(`  ✓ Created: ${record.subject?.substring(0, 40)}...`);
    }
  }

  // Seed thread mappings
  console.log('\nCreating sample thread mappings...');

  const sampleMappings = [
    {
      thread_id: 'thread-1',
      mailbox: testMailbox,
      dossier_id: 'dossier-001',
      dossier_name: 'Dupont c/ Martin',
      confidence: 1.0,
      source: 'rg_match',
    },
    {
      thread_id: 'thread-2',
      mailbox: testMailbox,
      dossier_id: 'dossier-002',
      dossier_name: 'Client Co - Fee Collection',
      confidence: 0.8,
      source: 'user_selected',
    },
  ];

  for (const mapping of sampleMappings) {
    const { error } = await supabase
      .from('thread_mappings')
      .upsert(mapping, { onConflict: 'thread_id,mailbox' });

    if (error) {
      console.log(`  ✗ Failed to create mapping for ${mapping.thread_id}: ${error.message}`);
    } else {
      console.log(`  ✓ Mapped: ${mapping.thread_id} → ${mapping.dossier_name}`);
    }
  }

  // Seed sender hints
  console.log('\nCreating sample sender hints...');

  const sampleHints = [
    {
      sender_email: 'client@example.com',
      sender_domain: 'example.com',
      dossier_id: 'dossier-001',
      dossier_name: 'Dupont c/ Martin',
      hit_count: 15,
    },
    {
      sender_email: 'accounting@client.be',
      sender_domain: 'client.be',
      dossier_id: 'dossier-002',
      dossier_name: 'Client Co - Fee Collection',
      hit_count: 8,
    },
  ];

  for (const hint of sampleHints) {
    const { error } = await supabase
      .from('sender_hints')
      .upsert(hint, { onConflict: 'sender_email,dossier_id' });

    if (error) {
      console.log(`  ✗ Failed to create hint for ${hint.sender_email}: ${error.message}`);
    } else {
      console.log(`  ✓ Hint: ${hint.sender_email} → ${hint.dossier_name}`);
    }
  }

  // Create sample drafts
  console.log('\nCreating sample drafts...');

  const sampleDrafts = [
    {
      message_id: 'test-message-1',
      mailbox: testMailbox,
      template_type: 'reply',
      subject: 'RE: Dossier Dupont c/ Martin - RG 23/1234/A',
      body_html: '<p>Cher client,</p><p>Nous avons bien reçu votre message...</p>',
      body_text: 'Cher client,\n\nNous avons bien reçu votre message...',
      language: 'fr',
      status: 'pending',
      confidence_score: 0.92,
    },
  ];

  for (const draft of sampleDrafts) {
    const { error } = await supabase.from('drafts').insert(draft);

    if (error && !error.message.includes('duplicate')) {
      console.log(`  ✗ Failed to create draft: ${error.message}`);
    } else {
      console.log(`  ✓ Draft: ${draft.template_type} for ${draft.message_id}`);
    }
  }

  console.log('\n=== Seeding Complete ===');
  console.log(`\nTest data created for mailbox: ${testMailbox}`);
  console.log('You can now test the API and add-in.');
}

main().catch(console.error);
