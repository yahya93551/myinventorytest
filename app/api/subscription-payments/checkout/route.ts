import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSubscriptionDurationPrice, isSubscriptionPlan } from "@/lib/subscriptionPlans";
import {
  fetchWaafiServiceReadiness,
  getExpectedWaafiEnvironment,
  getWaafiServiceEndpoint,
  isWaafiCheckoutEnabled,
} from "@/lib/subscriptionPaymentBridge";

export const dynamic = "force-dynamic";

const CheckoutSchema = z.object({
  plan: z.unknown().refine(isSubscriptionPlan, "Select a valid subscription plan"),
  durationMonths: z.number().int().refine((value) => [1, 3, 6, 12].includes(value), "Select a valid duration"),
  accountNo: z.string().regex(/^[0-9]{10,20}$/, "Use the full international mobile number without + or leading zero"),
});

export async function POST(req: Request) {
  if (!isWaafiCheckoutEnabled()) {
    return NextResponse.json({ error: "WaafiPay checkout is disabled" }, { status: 404 });
  }

  const auth = await getAuthenticatedUser(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .select("tenant_id, role, active")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: "Failed to verify account membership" }, { status: 500 });
  }
  if (!membership?.active || membership.role !== "owner") {
    return NextResponse.json({ error: "An active owner membership is required" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    }, { status: 422 });
  }

  const idempotencyKey = z.string().uuid().safeParse(req.headers.get("idempotency-key"));
  if (!idempotencyKey.success) {
    return NextResponse.json({ error: "A UUID Idempotency-Key header is required" }, { status: 400 });
  }

  const serviceToken = process.env.SUBSCRIPTION_PAYMENT_SERVICE_TOKEN;
  if (!serviceToken || serviceToken.length < 32) {
    console.error("WaafiPay checkout is enabled but its service token is missing or too short");
    return NextResponse.json({ error: "WaafiPay checkout is not configured" }, { status: 503 });
  }

  let serviceReadiness;
  try {
    serviceReadiness = await fetchWaafiServiceReadiness();
  } catch (error) {
    console.error("WaafiPay service readiness check failed before checkout:", error);
    return NextResponse.json({ error: "WaafiPay payment service could not be verified" }, { status: 503 });
  }
  if (
    serviceReadiness.status !== "ready"
    || serviceReadiness.environment !== getExpectedWaafiEnvironment()
  ) {
    console.error("WaafiPay checkout blocked because service readiness does not match the app environment");
    return NextResponse.json({
      error: "WaafiPay payment service is not ready for this environment",
    }, { status: 503 });
  }

  const referenceId = `sub-${idempotencyKey.data}`;
  const total = getSubscriptionDurationPrice(parsed.data.plan, parsed.data.durationMonths);
  const amountMinor = Math.round(total * 100);

  try {
    const serviceResponse = await fetch(getWaafiServiceEndpoint(process.env, "checkout"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId: membership.tenant_id,
        amountMinor,
        currency: "USD",
        referenceId,
        accountNo: parsed.data.accountNo,
        description: `Inventory ${parsed.data.plan} subscription (${parsed.data.durationMonths} months)`,
        plan: parsed.data.plan,
        durationMonths: parsed.data.durationMonths,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });

    let serviceResult: unknown;
    try {
      serviceResult = await serviceResponse.json();
    } catch {
      throw new Error("WaafiPay service returned an invalid response");
    }

    if (serviceResponse.status === 409) {
      return NextResponse.json({
        error: "A previous payment attempt is still pending. Reconcile it before trying again.",
      }, { status: 409 });
    }

    if (!serviceResult || typeof serviceResult !== "object") {
      throw new Error("WaafiPay service returned an unexpected response");
    }

    const result = serviceResult as Record<string, unknown>;
    const resultReferenceId = typeof result.referenceId === "string" ? result.referenceId : "";
    const restoresExistingAttempt = result.duplicate === true
      && /^[A-Za-z0-9._-]{1,50}$/.test(resultReferenceId)
      && isSubscriptionPlan(result.plan)
      && [1, 3, 6, 12].includes(Number(result.durationMonths));
    if (
      (resultReferenceId !== referenceId && !restoresExistingAttempt)
      || !["pending", "succeeded", "failed"].includes(String(result.outcome))
    ) {
      throw new Error("WaafiPay service returned an unexpected payment result");
    }
    const outcome = result.verified === true ? result.outcome : "pending";

    return NextResponse.json({
      success: true,
      data: {
        referenceId: resultReferenceId,
        outcome,
        providerState: typeof result.providerState === "string" ? result.providerState : null,
        plan: isSubscriptionPlan(result.plan) ? result.plan : parsed.data.plan,
        durationMonths: [1, 3, 6, 12].includes(Number(result.durationMonths))
          ? Number(result.durationMonths)
          : parsed.data.durationMonths,
        message: outcome === "succeeded"
          ? "WaafiPay confirmed your payment and your subscription is active."
          : outcome === "failed"
            ? "WaafiPay confirmed that the payment was not completed. No subscription access was granted."
            : "Payment result is pending verification. Do not retry with a new reference.",
      },
    }, { status: serviceResponse.ok ? 200 : serviceResponse.status });
  } catch (error) {
    console.error("WaafiPay subscription checkout failed:", error);
    return NextResponse.json({
      referenceId,
      outcome: "pending",
      error: "Payment result could not be confirmed. Do not retry with a new reference.",
    }, { status: 502 });
  }
}
