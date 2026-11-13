import { NextResponse } from "next/server";
import { getServerTenantContext } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return NextResponse.json(
      { success: false, error: tenantContext.error },
      { status: tenantContext.status },
    );
  }

  if (tenantContext.role !== "owner") {
    return NextResponse.json(
      { success: false, error: "Only the tenant owner can view subscription payment details" },
      { status: 403 },
    );
  }

  if (process.env.SUBSCRIPTION_WAAFIPAY_ENV === "sandbox") {
    return NextResponse.json({
      success: true,
      data: {
        checkoutEnabled: process.env.SUBSCRIPTION_WAAFIPAY_SANDBOX_ENABLED === "true",
        checkoutMode: "sandbox",
        payment: null,
      },
    });
  }

  const { data: payment, error } = await supabaseAdmin
    .from("waafipay_subscription_payments")
    .select("reference_id, status, provider_state, plan, duration_months, amount_minor, currency, created_at")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Could not load subscription payment status" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      checkoutEnabled: process.env.SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED === "true",
      checkoutMode: "production",
      paymentPending: payment?.status === "pending",
      payment: payment
        ? {
            referenceId: payment.reference_id,
            status: ["pending", "succeeded", "failed"].includes(payment.status)
              ? payment.status
              : "review_required",
            providerState: payment.provider_state,
            plan: payment.plan,
            durationMonths: payment.duration_months,
            amountMinor: payment.amount_minor,
            currency: payment.currency,
            createdAt: payment.created_at,
          }
        : null,
    },
  });
}
