import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAssurance: vi.fn(),
  listFactors: vi.fn(),
  verify: vi.fn(),
  setSession: vi.fn(),
  profileFrom: vi.fn(),
  profileSelect: vi.fn(),
  profileUpdate: vi.fn(),
  profileEq: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    auth: {
      getUser: mocks.getUser,
      mfa: { getAuthenticatorAssuranceLevel: mocks.getAssurance },
      admin: { mfa: { listFactors: mocks.listFactors } },
    },
    from: mocks.profileFrom,
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      setSession: mocks.setSession,
      mfa: { verify: mocks.verify },
    },
  })),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return actual;
});

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: vi.fn(),
}));

import { hasMFAAssurance } from '@/lib/api';
import { POST } from '@/app/api/auth/mfa/verify/route';

const factorId = '11111111-1111-4111-8111-111111111111';
const challengeId = '22222222-2222-4222-8222-222222222222';

function request(payload: unknown) {
  return new Request('http://localhost/api/auth/mfa/verify', {
    method: 'POST',
    headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('Phase 3A MFA assurance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileFrom.mockReturnValue({ select: mocks.profileSelect, update: mocks.profileUpdate });
    mocks.profileSelect.mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { mfa_enabled: true }, error: null }) });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
    mocks.getAssurance.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    mocks.listFactors.mockResolvedValue({
      data: { factors: [{ id: factorId, factor_type: 'totp', status: 'verified' }] },
      error: null,
    });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.verify.mockResolvedValue({
      data: {
        access_token: 'verified-access-token',
        refresh_token: 'verified-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'user-id' },
      },
      error: null,
    });
    mocks.profileUpdate.mockReturnValue({ eq: mocks.profileEq });
    mocks.profileEq.mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('allows access when there is no verified factor, including at AAL1', async () => {
    mocks.listFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    await expect(hasMFAAssurance('access-token')).resolves.toBe(true);
  });

  it('denies a verified TOTP factor at AAL1', async () => {
    await expect(hasMFAAssurance('access-token')).resolves.toBe(false);
  });

  it('allows a verified TOTP factor at AAL2', async () => {
    mocks.getAssurance.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });
    await expect(hasMFAAssurance('access-token')).resolves.toBe(true);
  });

  it('denies a verified phone factor at AAL1', async () => {
    mocks.listFactors.mockResolvedValue({
      data: { factors: [{ id: factorId, factor_type: 'phone', status: 'verified' }] },
      error: null,
    });
    await expect(hasMFAAssurance('access-token')).resolves.toBe(false);
  });

  it('allows a verified phone factor at AAL2', async () => {
    mocks.listFactors.mockResolvedValue({
      data: { factors: [{ id: factorId, factor_type: 'phone', status: 'verified' }] },
      error: null,
    });
    mocks.getAssurance.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });
    await expect(hasMFAAssurance('access-token')).resolves.toBe(true);
  });

  it('treats an unrelated verified factor type as no supported MFA factor', async () => {
    mocks.listFactors.mockResolvedValue({
      data: { factors: [{ id: factorId, factor_type: 'webauthn', status: 'verified' }] },
      error: null,
    });
    await expect(hasMFAAssurance('access-token')).resolves.toBe(true);
  });

  it('does not use profiles.mfa_enabled when no supported factor exists', async () => {
    mocks.listFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    await expect(hasMFAAssurance('access-token')).resolves.toBe(true);
    expect(mocks.profileFrom).not.toHaveBeenCalled();
  });

  it('marks the profile only after Supabase native MFA verification succeeds', async () => {
    const response = await POST(request({
      factor_id: factorId,
      challenge_id: challengeId,
      code: '123456',
      refresh_token: 'refresh-token',
    }) as never);

    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith({ factorId, challengeId, code: '123456' });
    expect(mocks.profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ mfa_enabled: true }));
  });

  it('does not mark MFA complete for an arbitrary six-digit code', async () => {
    mocks.verify.mockResolvedValue({ data: null, error: new Error('Invalid code') });

    const response = await POST(request({
      factor_id: factorId,
      challenge_id: challengeId,
      code: '123456',
      refresh_token: 'refresh-token',
    }) as never);

    expect(response.status).toBe(401);
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });

  it('does not mark MFA complete from a method-only request with no factor', async () => {
    const response = await POST(request({ method: 'totp' }) as never);

    expect(response.status).toBe(422);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });
});