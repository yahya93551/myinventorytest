import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAndDeleteOtp } from "@/lib/redis";

export async function verifyPhoneOtp(phone: string, otp: string) {
  try {
    const cached = await getAndDeleteOtp(`otp:${phone}`);
    if (cached && cached === otp) return true;
  } catch (err) {
    console.warn('[AUTH] Redis OTP check failed (falling back to DB)', err);
  }

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
