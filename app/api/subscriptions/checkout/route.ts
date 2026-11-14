import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerTenantContext } from "@/lib/api";
import { getSubscriptionDurationPrice } from "@/lib/subscriptionPlans";

const CheckoutSchema = z.object({
  plan: z.enum(["basic", "pro", "unlimited"]),
  durationMonths: z.number().int().refine(
    (duration) => [1, 3, 6, 12].includes(duration),
    "Select a valid subscription duration",
  ),
  accountNo: z.string().regex(/^[1-9][0-9]{9,19}$/, "Enter a valid EVC Plus account number"),
});

function paymentServiceConfig() {
  const serviceUrl = process.env.SUBSCRIPTION_PAYMENT_SERVICE_URL?.trim();
  const serviceToken = process.env.SUBSCRIPTION_PAYMENT_SERVICE_TOKEN?.trim();

  if (!serviceUrl || !serviceToken || serviceToken.length < 32) {
    return null;
  }

  try {
    const url = new URL(serviceUrl);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      return null;
    }

    return { url, serviceToken };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return NextResponse.json(
      { success: false, error: tenantContext.error },
      { status: tenantContext.status },
    );
  }

  if (tenantContext.role !== "owner") {
    return NextResponse.json(
      { success: false, error: "Only the tenant owner can start subscription checkout" },
      { status: 403 },
    );
  }

  const parsedBody = await req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      },
      { status: 422 },
    );
  }

  const sandboxMode = process.env.SUBSCRIPTION_WAAFIPAY_ENV === "sandbox";
  if (
    sandboxMode
    ? process.env.SUBSCRIPTION_WAAFIPAY_SANDBOX_ENABLED !== "true"
    : process.env.SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED !== "true"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: sandboxMode
          ? "EVC Plus sandbox checkout is disabled. No request was sent."
          : "EVC Plus checkout is currently disabled. No payment was sent.",
      },
      { status: 503 },
    );
  }

  const serviceConfig = paymentServiceConfig();
  if (!serviceConfig) {
    return NextResponse.json(
      { success: false, error: "EVC Plus payment service is not configured on the server" },
      { status: 503 },
    );
  }

  const amount = getSubscriptionDurationPrice(parsed.data.plan, parsed.data.durationMonths);
  const amountMinor = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return NextResponse.json(
      { success: false, error: "The selected subscription price is invalid" },
      { status: 500 },
    );
  }

  const referenceId = `myinv-${randomUUID()}`;
  let serviceResponse: Response;
  try {
    serviceResponse = await fetch(new URL(
      sandboxMode ? "/sandbox-checkout" : "/checkout",
      serviceConfig.url,
    ), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceConfig.serviceToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        tenantId: tenantContext.tenantId,
        amountMinor,
        currency: "USD",
        referenceId,
        accountNo: parsed.data.accountNo,
        description: `${parsed.data.plan} subscription for ${parsed.data.durationMonths} month(s)`,
        plan: parsed.data.plan,
        durationMonths: parsed.data.durationMonths,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(35000),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Checkout could not be confirmed. Wait before retrying; do not make a separate payment.",
      },
      { status: 502 },
    );
  }

  const responseText = await serviceResponse.text();
  let serviceData: unknown;
  try {
    serviceData = responseText ? JSON.parse(responseText) : null;
  } catch {
    return NextResponse.json(
      { success: false, error: "Payment service returned an invalid response" },
      { status: 502 },
    );
  }

  if (!isRecord(serviceData)) {
    return NextResponse.json(
      { success: false, error: "Payment service returned an invalid response" },
      { status: 502 },
    );
  }

  const responseReference = typeof serviceData.referenceId === "string"
    && /^[A-Za-z0-9._-]{1,50}$/.test(serviceData.referenceId)
    ? serviceData.referenceId
    : null;
  if (sandboxMode && serviceResponse.ok && responseReference) {
    return NextResponse.json({
      success: true,
      data: {
        referenceId: responseReference,
        status: "sandbox",
        sandbox: true,
        sandboxOutcome: typeof serviceData.outcome === "string"
          ? serviceData.outcome
          : "unknown",
        responseCode: typeof serviceData.responseCode === "string"
          ? serviceData.responseCode
          : null,
        requestSent: serviceData.requestSent === true,
        requestPreview: isRecord(serviceData.requestPreview)
          ? serviceData.requestPreview
          : null,
        providerDiagnostics: isRecord(serviceData.diagnostics)
          ? serviceData.diagnostics
          : null,
        providerState: typeof serviceData.providerState === "string"
          ? serviceData.providerState
          : "unknown",
        plan: parsed.data.plan,
        durationMonths: parsed.data.durationMonths,
        amountMinor,
        currency: "USD",
        createdAt: new Date().toISOString(),
      },
      message: "Sandbox response received. No production payment record or subscription was changed.",
    });
  }

  const servicePaymentStatus = typeof serviceData.paymentStatus === "string"
    ? serviceData.paymentStatus
    : typeof serviceData.outcome === "string"
      ? serviceData.outcome
      : null;
  const requestSent = serviceData.requestSent === true;
  const requestPreview = isRecord(serviceData.requestPreview)
    ? serviceData.requestPreview
    : null;
  const serviceResponseCode = typeof serviceData.responseCode === "string"
    && /^[A-Za-z0-9._-]{1,40}$/.test(serviceData.responseCode)
    ? serviceData.responseCode
    : null;

  // A 502 with a reference means the payment may have been submitted, but its
  // result is uncertain. Preserve the reference and never encourage a new charge.
  if (serviceResponse.status === 502 && responseReference) {
    return NextResponse.json({
      success: true,
      data: {
        referenceId: responseReference,
        status: "pending",
        responseCode: serviceResponseCode,
        requestSent,
        requestPreview,
        providerState: typeof serviceData.providerState === "string"
          ? serviceData.providerState
          : "verification_pending",
        plan: parsed.data.plan,
        durationMonths: parsed.data.durationMonths,
        amountMinor,
        currency: "USD",
        createdAt: new Date().toISOString(),
      },
      message: "Checkout is awaiting confirmation. Do not retry with a new payment.",
    }, { status: 202 });
  }

  if (!serviceResponse.ok || !responseReference) {
    const missingConfiguration = Array.isArray(serviceData.missingConfiguration)
      ? serviceData.missingConfiguration.filter(
          (item): item is string => typeof item === "string"
            && /^[A-Z0-9_]{1,80}$/.test(item),
        )
      : [];
    return NextResponse.json(
      {
        success: false,
        error: serviceResponse.status === 503
          ? `EVC Plus checkout is unavailable. No payment request was sent.${missingConfiguration.length > 0 ? ` Check Railway variables: ${missingConfiguration.join(", ")}.` : ""}`
          : "Payment service could not start checkout",
      },
      { status: serviceResponse.status === 503 ? 503 : 502 },
    );
  }

  const status = servicePaymentStatus === "pending"
    || servicePaymentStatus === "succeeded"
    || servicePaymentStatus === "failed"
    ? servicePaymentStatus
    : "review_required";
  return NextResponse.json({
    success: true,
    data: {
      referenceId: responseReference,
      status,
      responseCode: serviceResponseCode,
      requestSent,
      requestPreview,
      providerState: typeof serviceData.providerState === "string"
        ? serviceData.providerState
        : null,
      plan: parsed.data.plan,
      durationMonths: parsed.data.durationMonths,
      amountMinor,
      currency: "USD",
      createdAt: new Date().toISOString(),
      message: typeof serviceData.message === "string"
        ? serviceData.message
        : null,
    },
    message: status === "pending"
      ? "Payment submitted. Await manual verification."
      : "This payment already has a recorded result. Contact an administrator; no new charge was made.",
  }, { status: 200 });
}
