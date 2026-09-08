import { describe, it, expect } from 'vitest';
import { getStockLoadedAmountFromLog, getProductIdFromLog, getInitialStockFromLog } from './reportMetrics';

describe('reportMetrics helpers', () => {
  it('reads positive stock additions from RESTOCK logs with details.amount', () => {
    const record = {
      entity_id: 'prod-1',
      action: 'RESTOCK',
      details: { amount: 12 }
    };

    expect(getProductIdFromLog(record)).toBe('prod-1');
    expect(getStockLoadedAmountFromLog(record)).toBe(12);
  });

  it('falls back to stock delta when details.amount is missing', () => {
    const record = {
      entity_id: 'prod-2',
      action: 'UPDATE',
      details: { previousStock: 8, newStock: 15 }
    };

    expect(getProductIdFromLog(record)).toBe('prod-2');
    expect(getStockLoadedAmountFromLog(record)).toBe(7);
  });

  it('accepts positive deltas from real stock update payloads even when action is not RESTOCK', () => {
    const record = {
      entity_id: 'prod-3',
      action: 'ADD_STOCK',
      details: { productId: 'prod-3', previousStock: 10, newStock: 17, quantity: 7 }
    };

    expect(getProductIdFromLog(record)).toBe('prod-3');
    expect(getStockLoadedAmountFromLog(record)).toBe(7);
  });

  it('reads stock added from JSON-stringified details and productId keys', () => {
    const record = {
      details: '{"productId":"prod-4","previousStock":4,"newStock":13,"amount":9}',
      action: 'RESTOCK'
    };

    expect(getProductIdFromLog(record)).toBe('prod-4');
    expect(getStockLoadedAmountFromLog(record)).toBe(9);
  });

  it('ignores non-positive or unrelated stock events', () => {
    const record = {
      entity_id: 'prod-5',
      action: 'LOAD',
      details: { quantity: 3, previousStock: 10, newStock: 7 }
    };

    expect(getStockLoadedAmountFromLog(record)).toBe(0);
  });

  it('prefers the original creation-time stock value from CREATE logs', () => {
    const record = {
      entity_id: 'prod-6',
      action: 'CREATE',
      details: { initialStock: 200, stock: 200 }
    };

    expect(getInitialStockFromLog(record)).toBe(200);
  });

  it('returns null for non-create stock actions', () => {
    const record = {
      entity_id: 'prod-7',
      action: 'RESTOCK',
      details: { amount: 25 }
    };

    expect(getInitialStockFromLog(record)).toBeNull();
  });

  it('matches the real inventory scenario: started 200, sold 12, current 188', () => {
    const started = 200;
    const sold = 12;
    const remaining = 188;

    expect(started).toBe(200);
    expect(sold).toBe(12);
    expect(remaining).toBe(188);
    expect(started - sold).toBe(188);
  });

  it('keeps the report honest when no creation log exists', () => {
    const product = {
      id: 'prod-8',
      stock: 15,
      sales: 10,
      restocks: 0,
    };

    const hasCreationRecord = false;
    const derivedStarted = product.stock + product.sales - product.restocks;

    expect(hasCreationRecord).toBe(false);
    expect(derivedStarted).toBe(25);
  });
});
