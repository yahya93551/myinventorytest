import { describe, it, expect } from 'vitest';
import { parseMissingSalesColumns, stripMissingSalesColumns, getNetSoldQuantity, getMaxReturnableQuantity } from './salesFallback';

describe('salesFallback helpers', () => {
  it('parses refund_reason missing column from supabase error message', () => {
    const err = { message: "Could not find the 'refund_reason' column of 'sales' in the schema cache" };
    const cols = parseMissingSalesColumns(err as any);
    expect(cols).toEqual(['refund_reason']);
  });

  it('parses column does not exist message', () => {
    const err = { message: 'column "created_by" does not exist' };
    const cols = parseMissingSalesColumns(err as any);
    expect(cols).toEqual(['created_by']);
  });

  it('parses type missing column from supabase error message', () => {
    const err = { message: 'column "type" does not exist' };
    const cols = parseMissingSalesColumns(err as any);
    expect(cols).toEqual(['type']);
  });

  it('strips only reported missing columns from payload', () => {
    const payload = { product_id: 'p1', refund_reason: 'r', created_by: 'u1' } as any;
    const cleaned = stripMissingSalesColumns(payload, ['refund_reason']);
    expect(cleaned).toEqual({ product_id: 'p1', created_by: 'u1' });
  });

  it('calculates sold balance without a type column using legacy rows', () => {
    const rows = [
      { quantity: 3 },
      { quantity: 1, type: 'return' },
      { quantity: 5 }
    ] as any[];

    expect(rows.reduce((sum, row) => sum + (Number(row.quantity || 0) * (row.type === 'return' ? -1 : 1)), 0)).toBe(7);
  });

  it('keeps return quantity limited to the remaining sold amount', () => {
    const rows = [
      { quantity: 2 },
      { quantity: 1, type: 'return' },
      { quantity: 2, type: 'sale' }
    ] as any[];

    expect(getNetSoldQuantity(rows)).toBe(3);
    expect(getMaxReturnableQuantity(rows)).toBe(3);
    expect(getMaxReturnableQuantity([{ quantity: 2 }, { quantity: 1, type: 'return' }])).toBe(1);
  });

  it('subtracts return totals from net revenue', () => {
    const rows = [
      { total: 100, type: 'sale' },
      { total: 25, type: 'return' },
      { total: 40, type: 'sale' }
    ] as any[];

    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.total || 0) * (row.type === 'return' ? -1 : 1), 0);
    expect(totalRevenue).toBe(115);
  });
});
