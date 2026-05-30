#!/usr/bin/env node
/*
Safe backfill script for missing custom field keys on products.

Usage:
  1) Install deps: npm install @supabase/supabase-js dotenv
  2) Set env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID
  3) Run: node scripts/backfill-custom-fields.js

This script is idempotent: it only adds keys that are missing and does not remove or overwrite existing keys.
It updates products one-by-one using the Supabase service role client.
Be sure to run on a staging environment or take a DB backup if you are unsure.
*/

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = process.env.TENANT_ID;
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 200);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

if (!TENANT_ID) {
  console.error('Missing TENANT_ID in environment. Provide the tenant id you want to backfill.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function loadCustomFields(tenantId) {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('field_name, default_value')
    .eq('tenant_id', tenantId)
    .eq('is_system', false)
    .eq('is_visible', true)
    .order('field_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function* iterateProducts(tenantId, pageSize = 200) {
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const p of data) yield p;

    offset += pageSize;
  }
}

async function backfillForTenant(tenantId) {
  const fields = await loadCustomFields(tenantId);
  if (fields.length === 0) {
    console.log('No visible non-system custom fields found for tenant', tenantId);
    return;
  }

  console.log(`Found ${fields.length} custom field(s) to consider for tenant ${tenantId}`);

  let updatedCount = 0;
  let checkedCount = 0;

  for await (const product of iterateProducts(tenantId, PAGE_SIZE)) {
    checkedCount++;
    const original = product.custom_data || {};
    // ensure we treat only plain objects
    const current = (original && typeof original === 'object' && !Array.isArray(original)) ? { ...original } : {};

    let changed = false;
    for (const f of fields) {
      const key = f.field_name;
      // only add if missing (undefined) -- do not overwrite falsy values
      if (!(key in current) || current[key] === null || current[key] === undefined) {
        // use default_value when provided, otherwise null
        current[key] = f.default_value !== undefined ? f.default_value : null;
        changed = true;
      }
    }

    if (changed) {
      const { error } = await supabase
        .from('products')
        .update({ custom_data: current })
        .eq('id', product.id)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Failed to update product', product.id, error.message || error);
      } else {
        updatedCount++;
        console.log('Updated product', product.id);
      }
    }
  }

  console.log(`Checked ${checkedCount} products, updated ${updatedCount} products for tenant ${tenantId}`);
}

(async () => {
  try {
    console.log('Starting backfill for tenant', TENANT_ID);
    await backfillForTenant(TENANT_ID);
    console.log('Backfill complete');
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err.message || err);
    process.exit(2);
  }
})();
