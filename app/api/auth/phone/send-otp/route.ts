import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/rateLimit";
import { isPhoneNumber, normalizePhoneNumber } from "@/lib/auth";

const SendPhoneOtpSchema = z.object({
  phone: z.string().min(7),
});

export async function POST(req: Request) {
  const identifier = getRateLimitIdentifier(req);
  const rateResult = await checkRateLimit(identifier, {
    interval: 60_000,
    maxRequests: 5,
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

  const parseResult = SendPhoneOtpSchema.safeParse(payload);
  if (!parseResult.success) {
    const error = parseResult.error.issues.map((issue) => issue.message).join(", ");
    return NextResponse.json({ error }, { status: 422 });
  }

  const rawPhone = parseResult.data.phone;
  const phone = normalizePhoneNumber(rawPhone);

  if (!isPhoneNumber(phone)) {
    return NextResponse.json({ error: "Please provide a valid phone number." }, { status: 422 });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();

  try {
    await supabaseAdmin.from("otp_codes").insert({
      phone,
      code: otp,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[AUTH] Failed to store phone OTP:", err);
    return NextResponse.json(
      { error: "Failed to generate verification code. Please try again." },
      { status: 500 }
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    return NextResponse.json(
      {
        error:
          "SMS verification is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
      },
      { status: 500 }
    );
  }

  const body = new URLSearchParams({
    To: phone,
    From: fromPhone,
    Body: `Your inventory verification code is ${otp}. It expires in 5 minutes.`,
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AUTH] Twilio send failed:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to send SMS verification code." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[AUTH] Twilio request failed:", err);
    return NextResponse.json(
      { error: "Failed to send SMS verification code." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Verification code sent to your phone." });
}
