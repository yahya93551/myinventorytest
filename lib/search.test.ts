import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { getProductAnalytics, getSalesAnalytics, getTrendingProducts, resolveSalesAnalyticsDateRange } from './search';

function buildQuery(rows: any[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    then: (resolve: (value: any) => any) => resolve({ data: rows, error: null }),
  };

  return query as any;
}

describe('search analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pages through sales history in 500-row batches when building trending products', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      product_id: 'product-1',
      quantity: 1,
      created_at: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      id: `sale-${index + 1}`,
    }));

    const secondPage = [{
      product_id: 'product-2',
      quantity: 7,
      created_at: '2024-02-01T00:00:00.000Z',
      id: 'sale-501',
    }];

    const firstQuery = buildQuery(firstPage);
    const secondQuery = buildQuery(secondPage);

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firstQuery)
      .mockReturnValueOnce(secondQuery);

    const result = await getTrendingProducts('tenant-1', 30, 10);

    expect(supabaseAdmin.from).toHaveBeenCalledTimes(2);
    expect(firstQuery.limit).toHaveBeenCalledWith(500);
    expect(result).toEqual([
      { product_id: 'product-1', total_sold: 500 },
      { product_id: 'product-2', total_sold: 7 },
    ]);
  });

  it('uses PostgreSQL sales aggregates with tenant and date bounds', async () => {
    const start = new Date('2026-09-01T00:00:00.000Z');
    const end = new Date('2026-10-01T00:00:00.000Z');
    const analytics = {
      totalSales: 120,
      totalQuantity: 8,
      transactionCount: 3,
      averageOrderValue: 40,
      topProducts: [{ name: 'Item A', quantity: 5, total: 80 }],
    };
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: analytics, error: null } as never);

    await expect(getSalesAnalytics('tenant-a', start, end)).resolves.toEqual(analytics);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_sales_analytics', {
      p_tenant_id: 'tenant-a',
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });
  });

  it('uses PostgreSQL product aggregates and preserves empty values', async () => {
    const analytics = {
      totalProducts: 0,
      totalValue: 0,
      averagePrice: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      mostStockedProduct: null,
      leastStockedProduct: null,
    };
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: analytics, error: null } as never);

    await expect(getProductAnalytics('tenant-b')).resolves.toEqual(analytics);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_product_analytics', { p_tenant_id: 'tenant-b' });
  });

  it('defaults sales analytics to the existing 30-day window', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    const range = resolveSalesAnalyticsDateRange(undefined, undefined, now);
    const expectedStart = new Date(now);
    expectedStart.setDate(expectedStart.getDate() - 30);

    expect(range.start).toEqual(expectedStart);
    expect(range.end).toEqual(now);
  });

  it('rejects reversed and over-366-day sales analytics ranges', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');

    expect(() => resolveSalesAnalyticsDateRange('2026-09-02T00:00:00.000Z', '2026-09-01T00:00:00.000Z', now)).toThrow(RangeError);
    expect(() => resolveSalesAnalyticsDateRange('2025-09-29T00:00:00.000Z', '2026-10-01T00:00:00.000Z', now)).toThrow(/366 days/);
    expect(() => resolveSalesAnalyticsDateRange('2025-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', now)).not.toThrow();
  });
});
