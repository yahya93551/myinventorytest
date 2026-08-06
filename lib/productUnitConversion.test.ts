import { describe, expect, it } from 'vitest';
import { ProductSchema, ProductFormSchema } from '../types';
import { convertSaleQuantityToBaseUnits } from './productUnitConversion';

describe('Product unit conversion schema', () => {
  it('preserves unit conversion metadata on valid products', () => {
    const parsed = ProductSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test product',
      category: 'General',
      cost_price: 10,
      price: 20,
      stock: 5,
      base_unit: 'box',
      converted_unit: 'piece',
      conversion_rate: 20,
    });

    if (!parsed.success) {
      console.log(parsed.error?.issues);
    }
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.base_unit).toBe('box');
      expect(parsed.data.converted_unit).toBe('piece');
      expect(parsed.data.conversion_rate).toBe(20);
    }
  });

  it('requires a conversion rate when a converted unit is provided', () => {
    const parsed = ProductSchema.safeParse({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Test product',
      category: 'General',
      cost_price: 10,
      price: 20,
      stock: 5,
      converted_unit: 'piece',
    });

    expect(parsed.success).toBe(false);
  });

  it('converts converted-unit sales into base-unit stock quantities', () => {
    const result = convertSaleQuantityToBaseUnits(20, {
      stock: 5,
      base_unit: 'box',
      converted_unit: 'piece',
      conversion_rate: 20,
    }, 'converted');

    expect(result.quantity).toBe(1);
    expect(result.unitLabel).toBe('box');
  });

  it('rejects converted-unit sales that do not convert cleanly into whole stock units', () => {
    expect(() => convertSaleQuantityToBaseUnits(1, {
      stock: 5,
      base_unit: 'box',
      converted_unit: 'piece',
      conversion_rate: 20,
    }, 'converted')).toThrow('must convert cleanly');
  });
});
