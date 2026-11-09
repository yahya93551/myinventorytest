import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { resetPasswordForEmail: mocks.resetPasswordForEmail } },
}));

vi.mock('@/lib/api', () => ({
  jsonError: (error: string, status = 400) => Response.json({ success: false, error }, { status }),
  jsonSuccess: (data: unknown, status = 200) => Response.json({ success: true, data }, { status }),
}));

vi.mock('@/lib/auth', () => ({ getAppUrl: (path: string) => `https://app.example${path}` }));

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-client'),
  rateLimitResponse: vi.fn(),
}));

import { POST } from '@/app/api/auth/forgot-password/route';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [entryPath] : [];
  });
}

function jsonRequest(payload: unknown) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('Phase 3A password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('returns a generic response without exposing a reset token', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: new Error('Unknown email') });
    const response = await POST(jsonRequest({ email: 'person@example.com' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.message).toBe('If an account exists for this email, a password reset link has been sent.');
    expect(JSON.stringify(body)).not.toMatch(/token|password_reset/i);
  });

  it('rejects unsupported platforms and invalid email input without sending a reset email', async () => {
    const unsupported = await POST(jsonRequest({ email: 'person@example.com', platform: 'desktop' }) as never);
    const invalidEmail = await POST(jsonRequest({ email: 'not-an-email' }) as never);

    expect(unsupported.status).toBe(400);
    expect(invalidEmail.status).toBe(400);
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sends reset links to the web callback by default and to the mobile app when requested', async () => {
    await POST(jsonRequest({ email: 'person@example.com' }) as never);
    await POST(jsonRequest({ email: 'person@example.com', platform: 'mobile' }) as never);

    expect(mocks.resetPasswordForEmail).toHaveBeenNthCalledWith(1, 'person@example.com', {
      redirectTo: 'https://app.example/auth/callback',
    });
    expect(mocks.resetPasswordForEmail).toHaveBeenNthCalledWith(2, 'person@example.com', {
      redirectTo: 'inventorymobile://auth/reset-password',
    });
  });

  it('has no custom reset route and no application code callers', () => {
    const customRoute = path.join(repositoryRoot, 'app', 'api', 'auth', 'reset-password', 'route.ts');
    const applicationRoots = [
      path.join(repositoryRoot, 'app'),
      path.join(repositoryRoot, 'components'),
      path.join(repositoryRoot, 'hooks'),
      path.join(repositoryRoot, 'lib'),
      path.resolve(repositoryRoot, '..', 'inventory-mobile', 'src'),
    ];
    const sourceFiles = applicationRoots.flatMap(collectSourceFiles).filter((file) => !file.endsWith('.test.ts'));

    expect(existsSync(customRoute)).toBe(false);
    expect(sourceFiles.filter((file) => readFileSync(file, 'utf8').includes('/api/auth/reset-password'))).toEqual([]);
  });
});