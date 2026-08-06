export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

export function preserveSnakeCaseAliases<T extends Record<string, any>>(record: T): T & Record<string, any> {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return record as T;
  }

  const mapped: Record<string, any> = { ...record };

  for (const key of Object.keys(record)) {
    if (!key.includes("_")) continue;
    const camelKey = snakeToCamel(key);
    if (!(camelKey in mapped)) {
      mapped[camelKey] = record[key];
    }
  }

  return mapped as T & Record<string, any>;
}

export function mapSaleRecord(rawSale: Record<string, any>): Record<string, any> {
  const sale = preserveSnakeCaseAliases(rawSale);
  const dateValue = sale.createdAt || sale.date || sale.created_at;

  return {
    ...sale,
    date: dateValue,
    createdAt: sale.createdAt || dateValue,
  };
}

export function mapProductRecord(rawProduct: Record<string, any>): Record<string, any> {
  const product = preserveSnakeCaseAliases(rawProduct);
  const createdAt = product.createdAt || product.created_at;
  const updatedAt = product.updatedAt || product.updated_at;

  return {
    ...product,
    createdAt,
    updatedAt,
  };
}

export function mapList<T extends Record<string, any>>(items: T[], mapper: (item: T) => T) {
  return items.map(mapper);
}
