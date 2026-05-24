// app/api/signup/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/rateLimit";

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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

  const { email, password } = parseResult.data;

  const { data: createData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !createData?.user) {
    return NextResponse.json(
      { error: createError?.message || "Failed to create user" },
      { status: 500 }
    );
  }

  const user = createData.user;

  // FIX ONLY HERE ↓↓↓
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: user.id,
    user_id: user.id,
    email: user.email || email,
  });

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
      user_email: user.email || email,
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

  return NextResponse.json({
    success: true,
    data: {
      userId: user.id,
      email: user.email,
      membership,
    },
  });
}