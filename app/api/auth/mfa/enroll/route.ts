// app/api/auth/mfa/enroll/route.ts - Enroll in 2FA
import { getServerTenantContext, jsonSuccess, jsonError } from '@/lib/api';
import { generateTOTPSecret, generateBackupCodes } from '@/lib/mfa';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const EnrollMFASchema = z.object({
  method: z.enum(['totp', 'sms', 'email']),
});

export async function POST(req: NextRequest) {
  try {
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    const payload = await req.json();
    const parsed = EnrollMFASchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Invalid MFA method', 400);
    }

    const { method } = parsed.data;
    const userId = tenantContext.userId;

    // Generate enrollment data based on method
    let enrollmentData: Record<string, any> = {
      method,
      backup_codes: generateBackupCodes(10),
    };

    if (method === 'totp') {
      // Get user email for QR code
      const { data, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      const user = data?.user;

      if (userError || !user) {
        return jsonError('Failed to get user info', 500);
      }

      const { secret, qr_code_url } = generateTOTPSecret(
        user.user_metadata?.email || user.email || 'user@example.com'
      );

      enrollmentData = {
        ...enrollmentData,
        secret,
        qr_code_url,
      };
    }

    // Don't store anything yet - just return the data for user to verify
    return jsonSuccess({
      enrollment_data: enrollmentData,
      message: 'Verify the code from your authenticator app to complete setup',
    });
  } catch (err) {
    console.error('[MFA] Enrollment error:', err);
    return jsonError('Failed to enroll in MFA', 500);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
