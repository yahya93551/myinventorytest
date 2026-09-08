const missingSalesColumnRegex = /(?:Could not find the '(.+?)' column of 'sales' in the schema cache|column "(.+?)" does not exist)/i;

export function parseMissingSalesColumns(error: { message?: string } | null) {
  if (!error?.message) return [];
  const match = error.message.match(missingSalesColumnRegex);
  if (!match) return [];
  return [match[1] || match[2]].filter(Boolean) as string[];
}

export function stripMissingSalesColumns<T extends Record<string, any>>(payload: T, missingColumns: string[]) {
  const cleaned = { ...payload };
  for (const column of missingColumns) {
    if (column in cleaned) {
      delete cleaned[column];
    }
  }
  return cleaned;
}

export function getNetSoldQuantity(rows: Array<{ quantity?: number | string; type?: string }>) {
  return (rows || []).reduce((total, row) => {
    const quantity = Number(row?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return total;
    return total + quantity * (row?.type === 'return' ? -1 : 1);
  }, 0);
}

export function getMaxReturnableQuantity(rows: Array<{ quantity?: number | string; type?: string }>) {
  const netSold = getNetSoldQuantity(rows);
  return Math.max(0, netSold);
}

export default {};
