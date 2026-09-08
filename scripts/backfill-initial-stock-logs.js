#!/usr/bin/env node
/*
  Safe one-time backfill for product initial stock audit logs.

  Purpose:
    For existing products that do not yet have a CREATE activity log with the original
    stock value, insert a minimal audit row so the report can use the true starting stock
    instead of reconstructing it from later sales/restocks.

  Safe behavior:
    - idempotent: never creates duplicate CREATE logs for the same product
    - does not overwrite existing activity rows
    - only inserts minimal required fields for activity_logs
    - can run in dry-run mode first

  Usage:
    node scripts/backfill-initial-stock-logs.js --tenant-id <tenant_uuid>
    node scripts/backfill-initial-stock-logs.js --tenant-id <tenant_uuid> --dry-run
    node scripts/backfill-initial-stock-logs.js --all-tenants --dry-run
*/

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = process.env.TENANT_ID;
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 200);

const args = {};
for (const item of process.argv.slice(2)) {
  if (!item.startsWith('--')) continue;

  const [rawKey, ...rest] = item.slice(2).split('=');
  const key = rawKey;
  const value = rest.length > 0 ? rest.join('=') : 'true';

  if (key) {
    args[key] = value;
  }
}

const tenantId = args['tenant-id'] || TENANT_ID || null;
const dryRun = args['dry-run'] === 'true' || args.dryRun === 'true';
const allTenants = args['all-tenants'] === 'true' || args.allTenants === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

if (!tenantId && !allTenants) {
  console.error('Missing tenant target. Use --tenant-id <tenant_id> or --all-tenants');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function fetchTenants() {
  if (allTenants) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => row.id).filter(Boolean);
  }

  return [tenantId];
}

async function* iterateProducts(tenantIdValue, pageSize = PAGE_SIZE) {
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock, created_at, tenant_id')
      .eq('tenant_id', tenantIdValue)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const product of data) {
      yield product;
    }

    offset += pageSize;
  }
}

async function hasCreateLog(productId, tenantIdValue) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('tenant_id', tenantIdValue)
    .eq('entity', 'product')
    .eq('entity_id', productId)
    .in('action', ['CREATE', 'BULK_CREATE'])
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function addInitialStockLog(product, tenantIdValue) {
  const initialStock = parseNumber(product.stock);
  if (initialStock === null) {
    console.log(`[SKIP] ${product.id} has no numeric stock; cannot backfill`);
    return { skipped: true, reason: 'non_numeric_stock' };
  }

  const payload = {
    tenant_id: tenantIdValue,
    performed_by: 'system-backfill',
    action: 'CREATE',
    entity: 'product',
    entity_id: product.id,
    details: {
      product_id: product.id,
      name: product.name || null,
      stock: initialStock,
      initialStock,
      source: 'backfill-initial-stock',
    },
    created_at: product.created_at || new Date().toISOString(),
  };

  if (dryRun) {
    console.log(`[DRY-RUN] Would create initial stock log for ${product.id}: ${initialStock}`);
    return { skipped: false, dryRun: true };
  }

  const { error } = await supabase.from('activity_logs').insert(payload);
  if (error) {
    console.error(`[ERROR] Failed to insert log for ${product.id}: ${error.message || error}`);
    return { skipped: false, error: error.message || String(error) };
  }

  console.log(`[OK] Created initial stock log for ${product.id}: ${initialStock}`);
  return { skipped: false, dryRun: false };
}

async function backfillTenant(tenantIdValue) {
  let created = 0;
  let skipped = 0;
  let checked = 0;

  for await (const product of iterateProducts(tenantIdValue)) {
    checked++;

    const alreadyExists = await hasCreateLog(product.id, tenantIdValue);
    if (alreadyExists) {
      skipped++;
      continue;
    }

    const result = await addInitialStockLog(product, tenantIdValue);
    if (result.dryRun) {
      skipped++;
      continue;
    }

    if (result.error) {
      skipped++;
      continue;
    }

    created++;
  }

  console.log(`Tenant ${tenantIdValue}: checked ${checked}, created ${created}, skipped ${skipped}`);
}

(async () => {
  try {
    const tenants = await fetchTenants();
    if (!tenants.length) {
      console.log('No tenants found.');
      return;
    }

    console.log(`Starting initial-stock backfill for ${tenants.length} tenant(s). Dry run: ${dryRun}`);

    for (const currentTenantId of tenants) {
      await backfillTenant(currentTenantId);
    }

    console.log('Backfill complete.');
    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error.message || error);
    process.exit(2);
  }
})();
