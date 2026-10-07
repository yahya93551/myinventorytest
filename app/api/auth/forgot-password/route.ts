// app/api/auth/forgot-password/route.ts - Request password reset
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonSuccess, jsonError } from '@/lib/api';
import { getAppUrl } from '@/lib/auth';
import { checkRateLimit, getRateLimitIdentifier, rateLimitResponse } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  platform: z.enum(['web', 'mobile']).optional().default('web'),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Invalid email address', 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const sourceLimit = await checkRateLimit(getRateLimitIdentifier(req), {
      interval: 15 * 60_000,
      maxRequests: 5,
    });
    const destinationKey = crypto.createHash('sha256').update(email).digest('hex');
    const destinationLimit = await checkRateLimit(`password-reset:${destinationKey}`, {
      interval: 60 * 60_000,
      maxRequests: 3,
    });

    if (!sourceLimit.success) return rateLimitResponse(sourceLimit);
    if (!destinationLimit.success) return rateLimitResponse(destinationLimit);

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: parsed.data.platform === 'mobile'
        ? 'inventorymobile://auth/reset-password'
        : getAppUrl('/auth/callback'),
    });

    if (resetError) {
      console.error('[AUTH] Password reset email service returned an error');
      return jsonError('Unable to process password reset request', 503);
    }

    return jsonSuccess({
      message: 'If an account exists for this email, a password reset link has been sent.',
    });
  } catch {
    console.error('[AUTH] Forgot password request failed');
    return jsonError('Unable to process password reset request', 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
