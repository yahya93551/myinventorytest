import { describe, expect, it } from 'vitest';
import { ProductSchema, ProductFormSchema } from '../types';
import { convertSaleQuantityToBaseUnits, formatNetSoldWithUnits, formatQuantityWithUnits } from './productUnitConversion';

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

  it('keeps fractional converted-unit sales as valid base-unit values', () => {
    const result = convertSaleQuantityToBaseUnits(1, {
      stock: 5,
      base_unit: 'box',
      converted_unit: 'piece',
      conversion_rate: 20,
    }, 'converted');

    expect(result.quantity).toBe(0.05);
    expect(result.unitLabel).toBe('box');
    expect(result.originalUnit).toBe('piece');
  });

  it('normalizes converted-unit report totals to the product base unit', () => {
    const result = convertSaleQuantityToBaseUnits(12, {
      stock: 10,
      base_unit: 'jirgan',
      converted_unit: 'liter',
      conversion_rate: 20,
    }, 'converted');

    expect(result.quantity).toBe(0.6);
    expect(result.unitLabel).toBe('jirgan');
    expect(result.originalUnit).toBe('liter');
  });

  it('formats mixed-unit values in a readable base-plus-converted form', () => {
    expect(formatQuantityWithUnits(1.6, {
      base_unit: 'jirgan',
      converted_unit: 'litir',
      conversion_rate: 20,
    })).toBe('1 jirgan 12 litir');
  });

  it('formats net sold values using the same mixed-unit system', () => {
    expect(formatNetSoldWithUnits(34.5, {
      base_unit: 'Karton',
      converted_unit: 'Box',
      conversion_rate: 2,
    })).toBe('34 Karton 1 Box');
  });
});
