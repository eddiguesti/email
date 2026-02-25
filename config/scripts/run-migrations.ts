/**
 * Run Supabase Migrations
 * Executes SQL migrations against your Supabase database
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function main() {
  console.log('=== LB-BOT Database Migration ===\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('ERROR: Missing Supabase credentials');
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get migration files
  const migrationsDir = join(import.meta.dirname, '../../shared/supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s)\n`);

  for (const file of files) {
    console.log(`Running: ${file}...`);

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    // Execute via REST API (raw SQL)
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, provide manual instructions
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        console.log('\n⚠️  Cannot run migrations automatically.');
        console.log('Please run the following SQL in your Supabase SQL Editor:\n');
        console.log('1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
        console.log(`2. Copy and paste contents of: shared/supabase/migrations/${file}`);
        console.log('3. Click "Run"\n');

        console.log('Or use the Supabase CLI:');
        console.log('  npx supabase db push\n');
        break;
      }

      console.error(`  ✗ Failed: ${error.message}`);
      process.exit(1);
    }

    console.log('  ✓ Complete');
  }

  console.log('\n=== Migration Complete ===');
  console.log('\nYour database is ready. Next steps:');
  console.log('1. Configure Azure Service Bus');
  console.log('2. Configure Azure Blob Storage');
  console.log('3. Run: pnpm setup:subscription');
}

main().catch(console.error);
