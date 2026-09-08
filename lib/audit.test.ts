import { describe, it, expect } from 'vitest';

describe('audit log payload compatibility', () => {
  it('keeps only core columns for a minimal schema-compatible insert', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';

    const { buildActivityLogInsertPayload } = await import('./audit');

    const payload = buildActivityLogInsertPayload({
      tenantId: 'tenant-1',
      performedBy: 'user-1',
      action: 'RESTOCK',
      entity: 'product',
      entityId: 'prod-1',
      details: { amount: 5, previousStock: 10, newStock: 15 },
      ipAddress: '127.0.0.1',
      userAgent: 'Test agent',
      httpMethod: 'POST',
      endpoint: '/api/products/restock',
      statusCode: 200,
    });

    expect(payload).toMatchObject({
      tenant_id: 'tenant-1',
      performed_by: 'user-1',
      action: 'RESTOCK',
      entity: 'product',
      entity_id: 'prod-1',
      details: { amount: 5, previousStock: 10, newStock: 15 },
      created_at: expect.any(String),
    });

    expect(payload).not.toHaveProperty('ip_address');
    expect(payload).not.toHaveProperty('user_agent');
    expect(payload).not.toHaveProperty('http_method');
    expect(payload).not.toHaveProperty('endpoint');
    expect(payload).not.toHaveProperty('status_code');
  });
});
