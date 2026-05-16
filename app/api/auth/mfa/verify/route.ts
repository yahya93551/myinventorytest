// app/api/auth/mfa/verify/route.ts - Verify and confirm MFA setup
import { getServerTenantContext, jsonSuccess, jsonError } from '@/lib/api';
import { verifyTOTPCode, encryptMFAData } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const VerifyMFASchema = z.object({
  method: z.enum(['totp', 'sms', 'email']),
  code: z.string().min(5).max(10),
  secret: z.string().optional(), // For TOTP
  backup_codes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    const payload = await req.json();
    const parsed = VerifyMFASchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Invalid request', 400);
    }

    const { method, code, secret, backup_codes } = parsed.data;
    const userId = tenantContext.userId;

    // Validate code based on method
    let codeValid = false;

    if (method === 'totp' && secret) {
      codeValid = verifyTOTPCode(secret, code);
    } else if (method === 'email' || method === 'sms') {
      // In production, verify against sent code stored in cache/database
      // For now, accept any 6-digit code
      codeValid = /^\d{6}$/.test(code);
    }

    if (!codeValid) {
      return jsonError('Invalid verification code', 400);
    }

    const encryptionKey = process.env.MFA_ENCRYPTION_KEY;
    const encryptedSecret = method === 'totp' && secret
      ? encryptionKey
        ? encryptMFAData(secret, encryptionKey)
        : secret
      : null;

    const backupCodesValue = backup_codes && backup_codes.length > 0
      ? encryptionKey
        ? encryptMFAData(JSON.stringify(backup_codes), encryptionKey)
        : JSON.stringify(backup_codes)
      : null;

    // Store MFA settings in profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        mfa_enabled: true,
        mfa_method: method,
        mfa_secret: encryptedSecret,
        mfa_backup_codes: backupCodesValue,
        mfa_verified_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[MFA] Failed to update MFA settings:', updateError);
      return jsonError('Failed to save MFA settings', 500);
    }

    return jsonSuccess({
      message: 'MFA successfully enabled',
      backup_codes, // Show backup codes one final time
      method,
    });
  } catch (err) {
    console.error('[MFA] Verification error:', err);
    return jsonError('Failed to verify MFA', 500);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
