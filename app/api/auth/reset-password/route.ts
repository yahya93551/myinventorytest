// app/api/auth/reset-password/route.ts - Confirm password reset
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonSuccess, jsonError } from '@/lib/api';
import { hashResetToken, verifyResetToken, validatePassword } from '@/lib/password';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string(),
  password_confirm: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = ResetPasswordSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Invalid request', 400);
    }

    const { token, password, password_confirm } = parsed.data;

    if (password !== password_confirm) {
      return jsonError('Passwords do not match', 400);
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return jsonError(validation.errors.join(', '), 400);
    }

    const hashedToken = hashResetToken(token);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, password_reset_expires_at')
      .eq('password_reset_token', hashedToken)
      .maybeSingle();

    if (profileError) {
      console.error('[AUTH] Reset password lookup failed:', profileError);
      return jsonError('Failed to reset password', 500);
    }

    if (!profile) {
      return jsonError('Invalid or expired reset token', 400);
    }

    if (new Date(profile.password_reset_expires_at) < new Date()) {
      return jsonError('Reset token has expired', 400);
    }

    const update = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password,
    });

    if (update.error) {
      console.error('[AUTH] Failed to update password:', update.error);
      return jsonError('Failed to reset password', 500);
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        password_reset_token: null,
        password_reset_expires_at: null,
      })
      .eq('id', profile.id);

    return jsonSuccess({ message: 'Password reset successful' });
  } catch (err) {
    console.error('[AUTH] Reset password error:', err);
    return jsonError('Failed to reset password', 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
