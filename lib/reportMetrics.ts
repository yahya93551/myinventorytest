export type ReportMetricLog = {
  entity_id?: string | null;
  product_id?: string | null;
  productId?: string | null;
  entityId?: string | null;
  action?: string | null;
  details?: Record<string, any> | string | null;
  [key: string]: any;
};

function normalizeDetails(raw: ReportMetricLog['details']): Record<string, any> {
  if (!raw) return {};

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  if (typeof raw === 'object') {
    return raw as Record<string, any>;
  }

  return {};
}

function getNestedStringValue(obj: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function getProductIdFromLog(record: ReportMetricLog | null | undefined): string | null {
  if (!record) return null;

  const details = normalizeDetails(record.details);
  const candidates = [
    record.entity_id,
    record.entityId,
    record.product_id,
    record.productId,
    getNestedStringValue(details, ['product_id', 'productId', 'entity_id', 'entityId']),
    getNestedStringValue(record, ['entity_id', 'entityId', 'product_id', 'productId']),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function getInitialStockFromLog(record: ReportMetricLog | null | undefined): number | null {
  if (!record) return null;

  const action = (record.action || '').toString().toUpperCase();
  if (action !== 'CREATE' && action !== 'BULK_CREATE') {
    return null;
  }

  const details = normalizeDetails(record.details);
  const initialStock = Number(details.initialStock ?? details.initial_stock ?? details.stock ?? 0);

  return Number.isFinite(initialStock) ? initialStock : null;
}

export function getStockLoadedAmountFromLog(record: ReportMetricLog | null | undefined): number {
  if (!record) return 0;

  const details = normalizeDetails(record.details);
  const action = (record.action || '').toString().toUpperCase();

  const isStockReductionAction = action.includes('TAKE') || action.includes('LOAD') || action === 'SELL' || action === 'SALE';
  const isPositiveStockAction =
    action === 'RESTOCK' ||
    action === 'ADD_STOCK' ||
    action === 'UPDATE' ||
    action === 'CREATE' ||
    action === 'ADJUSTMENT' ||
    action === 'STOCK_INCREASE' ||
    action === 'INCREASE_STOCK';

  const positiveFieldCandidates = [
    details.amount,
    details.quantity,
    details.stock_added,
    details.stockAdded,
    details.delta,
    details.adjustment,
    details.added,
    details.load_amount,
    details.loadAmount,
    details.units,
    details.stockIncrease,
    details.stock_increase,
  ];

  for (const candidate of positiveFieldCandidates) {
    const value = Number(candidate ?? 0);
    if (Number.isFinite(value) && value > 0 && (isPositiveStockAction || !isStockReductionAction)) {
      return value;
    }
  }

  const previousStock = Number(details.previousStock ?? details.previous_stock ?? 0);
  const newStock = Number(details.newStock ?? details.new_stock ?? 0);
  if (
    Number.isFinite(previousStock) &&
    Number.isFinite(newStock) &&
    newStock > previousStock &&
    (isPositiveStockAction || !isStockReductionAction)
  ) {
    return Math.max(0, newStock - previousStock);
  }

  const stockAddedDirect = Number(details.stock_added ?? details.stockAdded ?? 0);
  if (Number.isFinite(stockAddedDirect) && stockAddedDirect > 0 && (isPositiveStockAction || !isStockReductionAction)) {
    return stockAddedDirect;
  }

  return 0;
}
