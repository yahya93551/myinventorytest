#!/usr/bin/env node
// Script to run the image_url migration on the products table.
// Usage: set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env, then run:
//   node scripts/run_migration.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!url) {
  console.error('Supabase URL not found. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in your environment.');
  process.exit(1);
}

if (!serviceKey) {
  console.error('Service role key not found. Set SUPABASE_SERVICE_ROLE_KEY in your environment to run migrations.');
  process.exit(1);
}

(async () => {
  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    console.log('Running migration: add image_url column to products table...');
    const { error } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;',
    }).catch(() => {
      // If rpc doesn't exist, try direct query (some Supabase projects may not have exec RPC)
      // Fall back to using the REST API to execute raw SQL via a stored procedure or admin endpoint
      // For now, we'll log a helpful message.
      console.warn('Direct RPC execution not available. Please run the migration manually:');
      console.warn('');
      console.warn('Option 1 - Using Supabase CLI:');
      console.warn('  supabase db push');
      console.warn('');
      console.warn('Option 2 - Using Supabase Dashboard:');
      console.warn('  1. Go to https://app.supabase.com');
      console.warn('  2. Select your project');
      console.warn('  3. SQL Editor → New query');
      console.warn('  4. Paste: ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;');
      console.warn('  5. Run');
      console.warn('');
      return { error: { message: 'RPC not available' } };
    });

    if (error) {
      if (error.message && error.message.includes('RPC not available')) {
        // Already handled above
        process.exit(1);
      }
      console.error('Migration failed:', error.message);
      process.exit(1);
    }

    console.log('✓ Migration completed: image_url column added to products table.');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err?.message ?? err);
    console.log('');
    console.log('To run the migration manually via Supabase Dashboard:');
    console.log('  1. Go to https://app.supabase.com');
    console.log('  2. Select your project');
    console.log('  3. SQL Editor → New query');
    console.log('  4. Paste: ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;');
    console.log('  5. Run');
    process.exit(1);
  }
})();
