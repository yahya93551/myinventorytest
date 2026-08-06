import { describe, it, expect } from 'vitest';
import { mapSaleRecord, mapProductRecord, preserveSnakeCaseAliases } from './apiMappers';

describe('apiMappers', () => {
  it('preserves snake-case aliases while adding camelCase equivalents', () => {
    const output = preserveSnakeCaseAliases({ created_at: '2024-01-01', order_id: 'INV-1', product_id: 'p1' });
    expect(output).toMatchObject({ created_at: '2024-01-01', createdAt: '2024-01-01', order_id: 'INV-1', orderId: 'INV-1', product_id: 'p1', productId: 'p1' });
  });

  it('maps sale record date fields consistently', () => {
    const sale = mapSaleRecord({ product_id: 'p1', created_at: '2024-01-01T00:00:00Z' } as any);
    expect(sale.date).toBe('2024-01-01T00:00:00Z');
    expect(sale.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(sale.productId).toBe('p1');
  });

  it('maps product record timestamps consistently', () => {
    const product = mapProductRecord({ id: 'p1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z' });
    expect(product.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(product.updatedAt).toBe('2024-02-01T00:00:00Z');
  });
});
