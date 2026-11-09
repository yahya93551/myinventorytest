import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchWaafiServiceReadiness,
  getExpectedWaafiEnvironment,
  isWaafiCheckoutEnabled,
} from "@/lib/subscriptionPaymentBridge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .select("active")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: "Failed to verify account membership" }, { status: 500 });
  }
  if (!membership?.active) {
    return NextResponse.json({ error: "An active account membership is required" }, { status: 403 });
  }

  const checkoutConfigured = isWaafiCheckoutEnabled();
  const expectedEnvironment = getExpectedWaafiEnvironment();
  if (!checkoutConfigured) {
    return NextResponse.json({
      success: true,
      data: {
        checkoutEnabled: false,
        environment: expectedEnvironment,
        serviceStatus: "disabled",
      },
    });
  }

  try {
    const readiness = await fetchWaafiServiceReadiness();
    return NextResponse.json({
      success: true,
      data: {
        ...readiness,
        checkoutEnabled: readiness.status === "ready"
          && readiness.environment === expectedEnvironment,
        serviceStatus: readiness.environment !== expectedEnvironment
          ? "environment_mismatch"
          : readiness.status,
        environment: expectedEnvironment,
      },
    });
  } catch (error) {
    console.error("WaafiPay subscription payment readiness check failed:", error);
    return NextResponse.json({
      success: true,
      data: {
        checkoutEnabled: false,
        environment: expectedEnvironment,
        serviceStatus: "unavailable",
      },
    });
  }
}
