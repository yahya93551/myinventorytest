// app/api/signup/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/rateLimit";
import { createPhoneFallbackEmail, isPhoneNumber, normalizePhoneNumber } from "@/lib/auth";

const SignUpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(6),
  otp: z.string().optional(),
});

async function verifyPhoneOtp(phone: string, otp: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("otp_codes")
    .select("id, expires_at")
    .eq("phone", phone)
    .eq("code", otp)
    .gte("expires_at", now)
    .limit(1)
    .single();

  if (error || !data) {
    return false;
  }

  await supabaseAdmin.from("otp_codes").delete().eq("id", data.id);
  return true;
}

export async function POST(req: Request) {
  const identifier = getRateLimitIdentifier(req);

  const rateResult = await checkRateLimit(identifier, {
    interval: 60_000,
    maxRequests: 10,
  });

  if (!rateResult.success) {
    return rateLimitResponse(rateResult);
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parseResult = SignUpSchema.safeParse(payload);

  if (!parseResult.success) {
    const error = parseResult.error.issues.map((issue) => issue.message).join(", ");
    return NextResponse.json({ error }, { status: 422 });
  }

  const { email, phone, password, otp } = parseResult.data;
  const hasEmail = typeof email === "string" && email.trim().length > 0;
  const hasPhone = typeof phone === "string" && phone.trim().length > 0;

  if (!hasEmail && !hasPhone) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 422 });
  }

  let normalizedPhone: string | undefined;
  if (hasPhone) {
    normalizedPhone = normalizePhoneNumber(phone);
    if (!isPhoneNumber(normalizedPhone)) {
      return NextResponse.json(
        { error: "Please provide a valid phone number." },
        { status: 422 }
      );
    }

    if (!otp || !otp.trim()) {
      return NextResponse.json(
        { error: "Phone signup requires verification code." },
        { status: 422 }
      );
    }

    const otpValid = await verifyPhoneOtp(normalizedPhone, otp.trim());
    if (!otpValid) {
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 });
    }
  }

  const safeEmail = hasEmail ? email.trim() : createPhoneFallbackEmail(phone ?? "");

  let user;

  if (hasEmail) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: safeEmail,
      password,
    });

    if (signUpError || !signUpData?.user) {
      return NextResponse.json(
        { error: signUpError?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    user = signUpData.user;
  } else {
    const createPayload: Record<string, unknown> = {
      email: safeEmail,
      password,
      email_confirm: true,
      phone_confirm: true,
    };

    if (normalizedPhone) {
      createPayload.phone = normalizedPhone;
    }

    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createPayload as any);

    if (createError || !createData?.user) {
      return NextResponse.json(
        { error: createError?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    user = createData.user;
  }

  const profileInsert: Record<string, unknown> = {
    id: user.id,
    user_id: user.id,
    email: user.email || safeEmail,
  };

  const { error: profileError } = await supabaseAdmin.from("profiles").insert(profileInsert);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message || "Failed to create user profile" },
      { status: 500 }
    );
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .insert({
      tenant_id: user.id,
      user_id: user.id,
      user_email: hasEmail ? email : normalizedPhone,
      role: "owner",
      active: true,
      created_by: user.id,
    })
    .select("user_id, user_email, role, active, created_at")
    .single();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: membershipError?.message || "Failed to create tenant membership" },
      { status: 500 }
    );
  }

  const trialDays = 14;
  const now = new Date();
  const activeUntil = new Date(now);
  activeUntil.setDate(activeUntil.getDate() + trialDays);

  const { data: trialSubscription, error: trialError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .insert({
      tenant_id: user.id,
      status: "active",
      monthly_fee: 5.0,
      billing_date: now.toISOString().split("T")[0],
      next_billing_date: activeUntil.toISOString().split("T")[0],
      active_until: activeUntil.toISOString(),
    })
    .select("*")
    .single();

  if (trialError || !trialSubscription) {
    return NextResponse.json(
      { error: trialError?.message || "Failed to create free trial subscription" },
      { status: 500 }
    );
  }

  const responseMessage = hasEmail
    ? "Account created successfully. Verify your email before logging in."
    : "Account created successfully. You may now sign in using your phone and password.";

  return NextResponse.json({
    success: true,
    data: {
      userId: user.id,
      email: user.email,
      membership,
      message: responseMessage,
    },
  });
}