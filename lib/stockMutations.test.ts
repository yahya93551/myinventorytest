import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireActiveSubscription: vi.fn(),
  logAudit: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  requireRole: mocks.requireRole,
  requireActiveSubscription: mocks.requireActiveSubscription,
  logAudit: mocks.logAudit,
  jsonSuccess: (data: unknown, status = 200) => Response.json({ success: true, data }, { status }),
  jsonError: (error: string, status = 400) => Response.json({ success: false, error }, { status }),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));

import { POST as loadPost } from '@/app/api/products/load/route';
import { POST as restockPost } from '@/app/api/products/restock/route';

const tenantContext = {
  userId: 'owner-1',
  tenantId: 'tenant-1',
  role: 'owner',
  active: true,
};
const product = { tenant_id: tenantContext.tenantId };
const productId = '11111111-1111-4111-8111-111111111111';
const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../supabase/migrations/20261002000002_atomic_inventory_load_and_restock.sql'
);

function request(body: unknown) {
  return new Request('http://localhost/api/products/stock-mutation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function productLookup(result = product) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data: result, error: result ? null : new Error('not found') }),
  };
  return query;
}

describe('Phase 3C-1 stock mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue(tenantContext);
    mocks.requireActiveSubscription.mockResolvedValue({ success: true });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.from.mockReturnValue(productLookup());
    mocks.rpc.mockResolvedValue({ data: { previous_stock: 10, stock: 7 }, error: null });
  });

  it('loads stock through the atomic tenant-scoped RPC and returns the updated stock', async () => {
    const response = await loadPost(request({ id: productId, quantity: 3, reason: 'transfer' }));

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(Request), ['owner', 'accountant', 'sales']);
    expect(mocks.rpc).toHaveBeenCalledWith('load_inventory_stock_transaction', {
      p_tenant_id: tenantContext.tenantId,
      p_user_id: tenantContext.userId,
      p_product_id: productId,
      p_quantity: 3,
      p_reason: 'transfer',
    });
    expect((await response.json()).data.stock).toBe(7);
  });

  it('rejects unauthorized load role before making product or RPC calls', async () => {
    mocks.requireRole.mockResolvedValue({ error: 'Forbidden', status: 403 });

    const response = await loadPost(request({ id: productId, quantity: 3 }));

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects a product in another tenant before calling the load RPC', async () => {
    mocks.from.mockReturnValue(productLookup({ tenant_id: 'tenant-2' }));

    const response = await loadPost(request({ id: productId, quantity: 3 }));

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns insufficient stock from the transaction and does not report success', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'LOAD_STOCK: Cannot take more than available stock.' } });

    const response = await loadPost(request({ id: productId, quantity: 11 }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('fails the load when transactional allocation creation fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Database allocation insert failed' } });

    const response = await loadPost(request({ id: productId, quantity: 3 }));

    expect(response.status).toBe(500);
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it('atomically restocks through server-derived tenant context', async () => {
    mocks.rpc.mockResolvedValue({ data: { previous_stock: 10, stock: 15 }, error: null });

    const response = await restockPost(request({ id: productId, amount: 5, tenant_id: 'tenant-2' }));

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(Request), ['owner']);
    expect(mocks.rpc).toHaveBeenCalledWith('restock_inventory_stock_transaction', {
      p_tenant_id: tenantContext.tenantId,
      p_product_id: productId,
      p_amount: 5,
    });
    expect((await response.json()).data.stock).toBe(15);
  });

  it('rejects unauthorized restock role and cross-tenant products before the RPC', async () => {
    mocks.requireRole.mockResolvedValue({ error: 'Forbidden', status: 403 });
    const forbidden = await restockPost(request({ id: productId, amount: 5 }));
    expect(forbidden.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.requireRole.mockResolvedValue(tenantContext);
    mocks.from.mockReturnValue(productLookup({ tenant_id: 'tenant-2' }));
    const crossTenant = await restockPost(request({ id: productId, amount: 5 }));
    expect(crossTenant.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid restock quantities before the RPC', async () => {
    const response = await restockPost(request({ id: productId, amount: 0 }));

    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('documents database locking, transactional allocation insert, and atomic restock arithmetic', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const loadFunction = sql.split('CREATE OR REPLACE FUNCTION public.restock_inventory_stock_transaction')[0];
    const restockFunction = sql.split('CREATE OR REPLACE FUNCTION public.restock_inventory_stock_transaction')[1];
    const stockValidationPosition = loadFunction.indexOf('IF v_previous_stock < p_quantity');
    const decrementPosition = loadFunction.indexOf('SET stock = COALESCE(stock, 0) - p_quantity');
    const allocationInsertPosition = loadFunction.indexOf('INSERT INTO public.inventory_takes');

    expect(loadFunction).toMatch(/FOR UPDATE/i);
    expect(stockValidationPosition).toBeGreaterThan(-1);
    expect(stockValidationPosition).toBeLessThan(decrementPosition);
    expect(decrementPosition).toBeLessThan(allocationInsertPosition);
    expect(loadFunction).toMatch(/SET stock = COALESCE\(stock, 0\) - p_quantity/i);
    expect(loadFunction).toMatch(/AND tenant_id = p_tenant_id[\s\S]*AND stock >= p_quantity/i);
    expect(loadFunction).toMatch(/INSERT INTO public\.inventory_takes/i);
    expect(loadFunction).toMatch(/RAISE EXCEPTION/i);
    expect(loadFunction).not.toMatch(/EXCEPTION\s+WHEN/i);
    expect(restockFunction).toMatch(/SET stock = COALESCE\(stock, 0\) \+ p_amount/i);
    expect(restockFunction).toMatch(/WHERE id = p_product_id\s+AND tenant_id = p_tenant_id/i);
    expect(sql).toMatch(/REVOKE ALL PRIVILEGES ON FUNCTION public\.load_inventory_stock_transaction[\s\S]*FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/REVOKE ALL PRIVILEGES ON FUNCTION public\.restock_inventory_stock_transaction[\s\S]*FROM PUBLIC, anon, authenticated/i);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO authenticated/i);
  });
});