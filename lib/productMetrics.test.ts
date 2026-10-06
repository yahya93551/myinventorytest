import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { rpc: vi.fn() },
}));

import { getProductMetrics } from './productMetrics';

describe('product metrics RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes tenant scope and preserves the existing all-time lower bound', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: [], error: null } as never);

    await expect(getProductMetrics('tenant-a', 'all')).resolves.toEqual([]);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_product_metrics', {
      p_tenant_id: 'tenant-a',
      p_start_date: '1970-01-01T00:00:00.000Z',
    });
  });

  it.each(['7d', '30d'] as const)('passes the bounded %s report window', async (filter) => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: [], error: null } as never);
    const now = new Date('2026-10-01T12:00:00.000Z');

    await expect(getProductMetrics('tenant-b', filter, now)).resolves.toEqual([]);

    const call = vi.mocked(supabaseAdmin.rpc).mock.calls[0];
    expect(call[0]).toBe('get_product_metrics');
    expect(call[1]).toMatchObject({ p_tenant_id: 'tenant-b' });
    expect(Date.parse(String(call[1]?.p_start_date))).toBeLessThan(now.getTime());
  });

  it('preserves the previous sold, loaded, and locale-aware product-name ordering', async () => {
    const metrics = [
      { product_id: 'z', product_name: 'Zebra', stock_loaded: 2, started: null, sold: 5, returned: 0, remaining: 1, base_unit: null, converted_unit: null, conversion_rate: null, sold_unit_mode: 'base' },
      { product_id: 'low', product_name: 'Zulu', stock_loaded: 1, started: null, sold: 5, returned: 0, remaining: 1, base_unit: null, converted_unit: null, conversion_rate: null, sold_unit_mode: 'base' },
      { product_id: 'alpha', product_name: 'alpha', stock_loaded: 2, started: null, sold: 5, returned: 0, remaining: 1, base_unit: null, converted_unit: null, conversion_rate: null, sold_unit_mode: 'base' },
      { product_id: 'top', product_name: 'Top', stock_loaded: 0, started: null, sold: 6, returned: 0, remaining: 1, base_unit: null, converted_unit: null, conversion_rate: null, sold_unit_mode: 'base' },
    ];
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: metrics, error: null } as never);

    const result = await getProductMetrics('tenant-a', 'all');

    expect(result.map((metric) => metric.product_id)).toEqual(['top', 'alpha', 'z', 'low']);
  });

  it('surfaces database errors instead of returning partial metrics', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: null, error: { message: 'query failed' } } as never);

    await expect(getProductMetrics('tenant-c', '30d')).rejects.toThrow('query failed');
  });
});