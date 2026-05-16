// app/api/auth/forgot-password/route.ts - Request password reset
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonSuccess, jsonError } from '@/lib/api';
import { generatePasswordResetToken, hashResetToken } from '@/lib/password';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Invalid email address', 400);
    }

    const { email } = parsed.data;
    const token = generatePasswordResetToken();
    const hashedToken = hashResetToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    // Store hashed token in profiles table
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        password_reset_token: hashedToken,
        password_reset_expires_at: expiresAt.toISOString(),
      })
      .eq('email', email);

    if (updateError) {
      console.error('[AUTH] Forgot password update failed:', updateError);
      return jsonError('Failed to request password reset', 500);
    }

    // TODO: Send email with reset link
    // In production, use email service to deliver reset token link.

    return jsonSuccess({
      message: 'Password reset requested. Check your email for instructions.',
      reset_token: token,
    });
  } catch (err) {
    console.error('[AUTH] Forgot password failed:', err);
    return jsonError('Failed to request password reset', 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
