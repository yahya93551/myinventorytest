import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  createRequest: vi.fn(),
  getRequest: vi.fn(),
  consumeRequest: vi.fn(),
  compileExport: vi.fn(),
  convertToCSV: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  requireRole: mocks.requireRole,
  logAudit: mocks.logAudit,
  jsonSuccess: (data: unknown, status = 200) => Response.json({ success: true, data }, { status }),
  jsonError: (error: string, status = 400) => Response.json({ success: false, error }, { status }),
}));

vi.mock('@/lib/gdpr', () => ({
  createDataExportRequest: mocks.createRequest,
  getDataExportRequest: mocks.getRequest,
  consumeDataExportRequest: mocks.consumeRequest,
  compileUserDataForExport: mocks.compileExport,
  convertToCSV: mocks.convertToCSV,
}));

import { GET, POST } from '@/app/api/account/export-data/route';

const context = { userId: 'owner-1', tenantId: 'tenant-1', role: 'owner', active: true };
const exportRequest = {
  id: 'export-1',
  user_id: context.userId,
  tenant_id: context.tenantId,
  export_token: 'secret-token',
  data_format: 'json',
  status: 'ready',
  expires_at: '2099-01-01T00:00:00.000Z',
};

function postRequest(payload: unknown) {
  return new Request('http://localhost/api/account/export-data', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer session-token' },
    body: JSON.stringify(payload),
  }) as never;
}

function getRequestWithToken(token = 'secret-token') {
  const request = new Request(`http://localhost/api/account/export-data?token=${encodeURIComponent(token)}`, {
    headers: { authorization: 'Bearer session-token' },
  });
  return Object.assign(request, { nextUrl: new URL(request.url) }) as never;
}

describe('GDPR export route security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue(context);
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.createRequest.mockResolvedValue(exportRequest);
    mocks.getRequest.mockResolvedValue(exportRequest);
    mocks.consumeRequest.mockResolvedValue(true);
    mocks.compileExport.mockResolvedValue({ products: [], sales: [], categories: [], activity_logs: [] });
    mocks.convertToCSV.mockReturnValue('csv');
  });

  it('denies sales role before creating an export', async () => {
    mocks.requireRole.mockResolvedValue({ error: 'Forbidden', status: 403 });

    const response = await POST(postRequest({ format: 'json' }));

    expect(response.status).toBe(403);
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(Request), ['owner', 'accountant', 'admin']);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it('denies download to a role rejected by the server role helper', async () => {
    mocks.requireRole.mockResolvedValue({ error: 'Forbidden', status: 403 });

    const response = await GET(getRequestWithToken());

    expect(response.status).toBe(403);
    expect(mocks.getRequest).not.toHaveBeenCalled();
  });

  it('allows an authorized role and uses server tenant context rather than client tenant input', async () => {
    mocks.requireRole.mockResolvedValue({ ...context, role: 'accountant' });
    const response = await POST(postRequest({ format: 'csv', tenant_id: 'attacker-tenant' }));

    expect(response.status).toBe(200);
    expect(mocks.createRequest).toHaveBeenCalledWith(context.userId, context.tenantId, 'csv');
  });

  it('allows an admin role permitted by the existing settings guard', async () => {
    mocks.requireRole.mockResolvedValue({ ...context, role: 'admin' });

    const response = await POST(postRequest({ format: 'json' }));

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(Request), ['owner', 'accountant', 'admin']);
  });

  it('rejects invalid and expired tokens without compiling data', async () => {
    mocks.getRequest.mockResolvedValue(null);

    const response = await GET(getRequestWithToken('invalid'));

    expect(response.status).toBe(404);
    expect(mocks.compileExport).not.toHaveBeenCalled();
  });

  it('rejects non-ready request states safely', async () => {
    mocks.getRequest.mockResolvedValue({ ...exportRequest, status: 'processing' });

    const response = await GET(getRequestWithToken());

    expect(response.status).toBe(404);
    expect(mocks.compileExport).not.toHaveBeenCalled();
  });

  it('synchronously serves a legacy pending request and consumes it', async () => {
    mocks.getRequest.mockResolvedValue({ ...exportRequest, status: 'pending' });

    const response = await GET(getRequestWithToken());

    expect(response.status).toBe(200);
    expect(mocks.compileExport).toHaveBeenCalledWith(context.tenantId);
    expect(mocks.consumeRequest).toHaveBeenCalledWith('secret-token', context.userId, context.tenantId);
  });

  it('binds download to the authenticated requester and resolved tenant', async () => {
    mocks.getRequest.mockResolvedValue({ ...exportRequest, user_id: 'another-user' });

    const response = await GET(getRequestWithToken());

    expect(response.status).toBe(404);
    expect(mocks.compileExport).not.toHaveBeenCalled();
  });

  it('denies a valid matching-user token when its stored tenant differs from server context', async () => {
    mocks.requireRole.mockResolvedValue(context);
    mocks.getRequest.mockResolvedValue({
      ...exportRequest,
      user_id: context.userId,
      tenant_id: 'tenant-b',
      export_token: 'secret-token',
      status: 'ready',
      expires_at: '2099-01-01T00:00:00.000Z',
    });

    const response = await GET(getRequestWithToken('secret-token'));
    const body = await response.json();

    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(Request), ['owner', 'accountant', 'admin']);
    expect(mocks.getRequest).toHaveBeenCalledWith('secret-token');
    expect(response.status).toBe(404);
    expect(body).toEqual({ success: false, error: 'Export not available' });
    expect(mocks.compileExport).not.toHaveBeenCalled();
    expect(mocks.consumeRequest).not.toHaveBeenCalled();
  });

  it('consumes a successful download and returns the requested export', async () => {
    const response = await GET(getRequestWithToken());

    expect(response.status).toBe(200);
    expect(mocks.compileExport).toHaveBeenCalledWith(context.tenantId);
    expect(mocks.consumeRequest).toHaveBeenCalledWith('secret-token', context.userId, context.tenantId);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects a second or losing concurrent download when atomic consumption fails', async () => {
    mocks.consumeRequest.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const responses = await Promise.all([
      GET(getRequestWithToken()),
      GET(getRequestWithToken()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 404]);
  });
});