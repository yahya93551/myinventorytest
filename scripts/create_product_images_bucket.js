#!/usr/bin/env node
// Lightweight script to create the `product-images` Supabase storage bucket.
// Usage: set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in env, then run:
//   node scripts/create_product_images_bucket.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!url) {
  console.error('Supabase URL not found. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in your environment.');
  process.exit(1);
}

if (!serviceKey) {
  console.error('Service role key not found. Set SUPABASE_SERVICE_ROLE_KEY in your environment to create buckets.');
  console.error('Alternatively, create the `product-images` bucket via the Supabase Console.');
  process.exit(1);
}

(async () => {
  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    console.log('Checking for existing `product-images` bucket...');
    const listRes = await supabase.storage.listBuckets();
    if (listRes.error) {
      console.warn('Could not list buckets:', listRes.error.message);
    }

    const exists = (listRes.data || []).some((b) => b.name === 'product-images');
    if (exists) {
      console.log('Bucket `product-images` already exists. No action needed.');
      process.exit(0);
    }

    console.log('Creating `product-images` bucket (public)...');
    const { data, error } = await supabase.storage.createBucket('product-images', { public: true });
    if (error) {
      // If bucket already exists or another non-fatal error occurred, print it and exit non-zero
      console.error('Failed to create bucket:', error.message);
      process.exit(1);
    }

    console.log('Bucket created:', data);
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error while creating bucket:', err?.message ?? err);
    process.exit(1);
  }
})();
