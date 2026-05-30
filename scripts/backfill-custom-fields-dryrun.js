#!/usr/bin/env node
/*
Dry-run backfill for missing custom field keys on products.

Usage:
  1) Install deps: npm install @supabase/supabase-js dotenv
  2) Set env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID
  3) Run: node scripts/backfill-custom-fields-dryrun.js

This script is safe: it does not write to the database. It only reports which products would be changed and the values that would be added.
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
  console.error('Missing TENANT_ID in environment. Provide the tenant id you want to inspect.');
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

async function dryrunForTenant(tenantId) {
  const fields = await loadCustomFields(tenantId);
  if (fields.length === 0) {
    console.log('No visible non-system custom fields found for tenant', tenantId);
    return;
  }

  console.log(`Found ${fields.length} custom field(s) to consider for tenant ${tenantId}`);

  let affected = 0;
  let checked = 0;

  for await (const product of iterateProducts(tenantId, PAGE_SIZE)) {
    checked++;
    const original = product.custom_data || {};
    const current = (original && typeof original === 'object' && !Array.isArray(original)) ? { ...original } : {};

    const additions = {};
    for (const f of fields) {
      const key = f.field_name;
      if (!(key in current) || current[key] === null || current[key] === undefined) {
        additions[key] = f.default_value !== undefined ? f.default_value : null;
      }
    }

    if (Object.keys(additions).length > 0) {
      affected++;
      console.log('Product', product.id, 'would be updated with:', additions);
    }
  }

  console.log(`Dry-run complete. Checked ${checked} products; ${affected} would be updated.`);
}

(async () => {
  try {
    console.log('Starting dry-run for tenant', TENANT_ID);
    await dryrunForTenant(TENANT_ID);
    console.log('Dry-run finished');
    process.exit(0);
  } catch (err) {
    console.error('Dry-run failed:', err.message || err);
    process.exit(2);
  }
})();
