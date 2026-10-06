import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, getBearerToken } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const VerifyMFASchema = z.object({
  factor_id: z.string().uuid(),
  challenge_id: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
  refresh_token: z.string().min(1),
});

async function markMFAEnabled(userId: string, method: "totp" | "phone") {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      mfa_enabled: true,
      mfa_method: method === "phone" ? "sms" : "totp",
      mfa_secret: null,
      mfa_backup_codes: null,
      mfa_verified_at: new Date().toISOString(),
      mfa_attempts: 0,
      mfa_last_attempt: null,
    })
    .eq("id", userId);
  return error;
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return jsonError("Missing authorization token", 401);

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return jsonError("Invalid or expired session", 401);

  const rateResult = await checkRateLimit(`mfa-verify:${authData.user.id}`, {
    interval: 60_000,
    maxRequests: 5,
  });
  if (!rateResult.success) return rateLimitResponse(rateResult);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parsed = VerifyMFASchema.safeParse(payload);
  if (!parsed.success) return jsonError("Invalid MFA challenge", 422);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return jsonError("Authentication service is unavailable", 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: sessionError } = await userClient.auth.setSession({
    access_token: token,
    refresh_token: parsed.data.refresh_token,
  });
  if (sessionError) return jsonError("Invalid or expired MFA session", 401);

  const { factor_id: factorId, challenge_id: challengeId, code } = parsed.data;
  const { data: verified, error: verifyError } = await userClient.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });

  if (verifyError || !verified?.access_token || !verified.refresh_token) {
    return jsonError("Invalid, expired, or already-used MFA challenge", 401);
  }

  const { data: factorData, error: factorError } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: authData.user.id,
  });
  const verifiedFactor = factorData?.factors.find(
    (factor) =>
      factor.id === factorId &&
      factor.status === "verified" &&
      (factor.factor_type === "totp" || factor.factor_type === "phone")
  );
  if (factorError || !verifiedFactor) {
    return jsonError("Native MFA verification could not be confirmed", 401);
  }

  const method = verifiedFactor.factor_type === "phone" ? "phone" : "totp";
  const profileError = await markMFAEnabled(authData.user.id, method);

  if (profileError) {
    console.error("[MFA] Failed to record native factor verification");
    return jsonError("MFA verification succeeded but account security settings could not be saved", 500);
  }

  return jsonSuccess({
    access_token: verified.access_token,
    refresh_token: verified.refresh_token,
    token_type: verified.token_type,
    expires_in: verified.expires_in,
    user: verified.user,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
