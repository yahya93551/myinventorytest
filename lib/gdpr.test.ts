import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  exportRow: null as null | Record<string, unknown>,
  consumed: false,
  updateValue: null as null | Record<string, unknown>,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mocks.from },
}));

import {
  compileUserDataForExport,
  consumeDataExportRequest,
  createDataExportRequest,
  generateExportToken,
  getDataExportRequest,
} from '@/lib/gdpr';

function queryBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const query = {
    select: vi.fn((...args: unknown[]) => {
      mocks.calls.push({ table, method: 'select', args });
      return query;
    }),
    insert: vi.fn((value: Record<string, unknown>) => {
      mocks.calls.push({ table, method: 'insert', args: [value] });
      mocks.exportRow = value;
      return query;
    }),
    update: vi.fn((value: Record<string, unknown>) => {
      mocks.calls.push({ table, method: 'update', args: [value] });
      mocks.updateValue = value;
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      mocks.calls.push({ table, method: 'eq', args: [column, value] });
      filters[column] = value;
      return query;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      mocks.calls.push({ table, method: 'in', args: [column, values] });
      filters[column] = values;
      return query;
    }),
    gt: vi.fn((column: string, value: unknown) => {
      mocks.calls.push({ table, method: 'gt', args: [column, value] });
      filters[column] = value;
      return query;
    }),
    single: vi.fn(async () => ({ data: { ...mocks.exportRow, id: 'export-1' }, error: null })),
    maybeSingle: vi.fn(async () => {
      if (table !== 'data_export_requests') return { data: null, error: null };
      if (mocks.calls.some((call) => call.table === table && call.method === 'update')) {
        const statusFilter = filters.status as string[] | undefined;
        const expiryThreshold = Date.parse(String(filters.expires_at));
        const rowExpiry = Date.parse(String(mocks.exportRow?.expires_at));
        const valid = !mocks.consumed &&
          filters.export_token === 'token' &&
          filters.user_id === 'user-1' &&
          filters.tenant_id === 'tenant-1' &&
          statusFilter?.includes('ready') &&
          rowExpiry > expiryThreshold;
        if (!valid) return { data: null, error: null };
        mocks.consumed = true;
        return { data: { id: 'export-1', ...mocks.updateValue }, error: null };
      }
      return {
        data: mocks.exportRow,
        error: null,
      };
    }),
  };
  query.eq.mockImplementation((column: string, value: unknown) => {
    mocks.calls.push({ table, method: 'eq', args: [column, value] });
    filters[column] = value;
    return query;
  });
  return query;
}

describe('GDPR export helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls = [];
    mocks.exportRow = null;
    mocks.consumed = false;
    mocks.updateValue = null;
    mocks.from.mockImplementation((table: string) => queryBuilder(table));
  });

  it('generates a 256-bit cryptographic token', () => {
    const randomBytes = vi.spyOn(crypto, 'randomBytes');
    const token = generateExportToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(randomBytes).toHaveBeenCalledWith(32);
    randomBytes.mockRestore();
  });

  it('creates a pending synchronous export request with a seven-day expiry', async () => {
    await createDataExportRequest('user-1', 'tenant-1', 'json');
    const insert = mocks.calls.find((call) => call.method === 'insert');
    const value = insert?.args[0] as Record<string, string>;

    expect(value.status).toBe('pending');
    expect(value.user_id).toBe('user-1');
    expect(value.tenant_id).toBe('tenant-1');
    expect(Date.parse(value.expires_at) - Date.parse(value.created_at)).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
  });

  it('expires an export request before returning it', async () => {
    mocks.exportRow = { export_token: 'token', expires_at: '2000-01-01T00:00:00.000Z' };

    await expect(getDataExportRequest('token')).resolves.toBeNull();
  });

  it('keeps every export dataset query tenant-filtered', async () => {
    await compileUserDataForExport('tenant-1');
    const tenantFilters = mocks.calls.filter((call) => call.method === 'eq' && call.args[0] === 'tenant_id');

    expect(tenantFilters).toHaveLength(4);
    expect(tenantFilters.every((call) => call.args[1] === 'tenant-1')).toBe(true);
  });

  it('fails instead of returning a partial export when a dataset query errors', async () => {
    mocks.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          mocks.calls.push({ table, method: 'eq', args: [column, value] });
          return Promise.resolve({ data: null, error: table === 'sales' ? new Error('query failed') : null });
        }),
      })),
    }));

    await expect(compileUserDataForExport('tenant-1')).rejects.toThrow('Failed to compile export data');
  });

  it('atomically consumes at most one successful request and sets downloaded_at', async () => {
    mocks.exportRow = { status: 'ready', expires_at: '2099-01-01T00:00:00.000Z' };
    const results = await Promise.all([
      consumeDataExportRequest('token', 'user-1', 'tenant-1'),
      consumeDataExportRequest('token', 'user-1', 'tenant-1'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(mocks.updateValue).toMatchObject({ status: 'downloaded' });
    expect(mocks.updateValue?.downloaded_at).toEqual(expect.any(String));
    expect(mocks.calls).toContainEqual({ table: 'data_export_requests', method: 'eq', args: ['export_token', 'token'] });
    expect(mocks.calls).toContainEqual({ table: 'data_export_requests', method: 'eq', args: ['user_id', 'user-1'] });
    expect(mocks.calls).toContainEqual({ table: 'data_export_requests', method: 'eq', args: ['tenant_id', 'tenant-1'] });
    expect(mocks.calls).toContainEqual({ table: 'data_export_requests', method: 'in', args: ['status', ['pending', 'ready']] });
    expect(mocks.calls.some((call) => call.method === 'gt' && call.args[0] === 'expires_at')).toBe(true);
  });
});