import { describe, it, expect } from 'vitest';
import { parseMissingSalesColumns, stripMissingSalesColumns } from './salesFallback';

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

  it('strips only reported missing columns from payload', () => {
    const payload = { product_id: 'p1', refund_reason: 'r', created_by: 'u1' } as any;
    const cleaned = stripMissingSalesColumns(payload, ['refund_reason']);
    expect(cleaned).toEqual({ product_id: 'p1', created_by: 'u1' });
  });
});
