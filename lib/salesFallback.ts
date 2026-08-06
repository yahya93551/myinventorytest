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

export default {};
