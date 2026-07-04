import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedUser, jsonError, jsonSuccess } from "@/lib/api";
import { normalizePhoneNumber, isPhoneNumber } from "@/lib/auth";
import { verifyPhoneOtp } from "@/lib/otp";

const LinkPhoneSchema = z.object({
  phone: z.string().min(7),
  otp: z.string().min(1),
});

export async function POST(req: Request) {
  const payload = await req.json();
  const parseResult = LinkPhoneSchema.safeParse(payload);

  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { phone, otp } = parseResult.data;
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!isPhoneNumber(normalizedPhone)) {
    return jsonError("Please provide a valid phone number.", 422);
  }

  const authResult = await getAuthenticatedUser(req);
  if ("error" in authResult) {
    return jsonError(authResult.error, authResult.status);
  }

  const user = authResult.user;

  const otpValid = await verifyPhoneOtp(normalizedPhone, otp.trim());
  if (!otpValid) {
    return jsonError("Invalid or expired verification code.", 400);
  }

  const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    phone: normalizedPhone,
    phone_confirm: true,
  });

  if (updateError || !updatedUser) {
    return jsonError(updateError?.message || "Failed to link phone number.", 500);
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        user_id: user.id,
        email: user.email || "",
        phone: normalizedPhone,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return jsonError(profileError.message || "Failed to update profile with linked phone.", 500);
  }

  return jsonSuccess({ message: "Phone number linked successfully.", phone: normalizedPhone });
}
