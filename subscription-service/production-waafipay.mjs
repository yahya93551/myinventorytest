import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const WAAFIPAY_PRODUCTION_ENDPOINT = "https://api.waafipay.net/asm";
const FINAL_FAILURE_STATES = new Set(["declined", "failed", "cancelled", "canceled"]);

function isConfiguredValue(value) {
  return typeof value === "string"
    && value.trim().length > 0
    && !/your_real|your-production|\*/i.test(value.trim());
}

export function isProductionConfigured(env = process.env) {
  const required = [
    "WAAFIPAY_MERCHANT_UID",
    "WAAFIPAY_API_USER_ID",
    "WAAFIPAY_API_KEY",
    "WAAFIPAY_HPP_STORE_ID",
    "WAAFIPAY_HPP_KEY",
    "WAAFIPAY_WEBHOOK_SECRET",
    "SUBSCRIPTION_SERVICE_SHARED_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const credentialsConfigured = isConfiguredValue(env.WAAFIPAY_MERCHANT_UID)
    && env.WAAFIPAY_MERCHANT_UID.trim().length >= 7
    && env.WAAFIPAY_MERCHANT_UID.trim().length <= 15
    && isConfiguredValue(env.WAAFIPAY_API_USER_ID)
    && env.WAAFIPAY_API_USER_ID.trim().length >= 7
    && env.WAAFIPAY_API_USER_ID.trim().length <= 15
    && isConfiguredValue(env.WAAFIPAY_API_KEY)
    && env.WAAFIPAY_API_KEY.trim().length >= 20
    && env.WAAFIPAY_API_KEY.trim().length <= 40
    && isConfiguredValue(env.WAAFIPAY_HPP_STORE_ID)
    && isConfiguredValue(env.WAAFIPAY_HPP_KEY)
    && env.WAAFIPAY_HPP_KEY.trim().length >= 20
    && env.WAAFIPAY_HPP_KEY.trim().length <= 40
    && isConfiguredValue(env.WAAFIPAY_WEBHOOK_SECRET)
    && env.WAAFIPAY_WEBHOOK_SECRET.trim().length >= 32
    && isConfiguredValue(env.SUBSCRIPTION_SERVICE_SHARED_SECRET)
    && env.SUBSCRIPTION_SERVICE_SHARED_SECRET.length >= 32
    && isConfiguredValue(env.SUPABASE_URL)
    && isConfiguredValue(env.SUPABASE_SERVICE_ROLE_KEY);
  return env.NODE_ENV === "production"
    && env.SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED === "true"
    && credentialsConfigured
    && required.every((name) => isConfiguredValue(env[name]));
}

function validatePayment(payment, { requireAccountNo = true } = {}) {
  if (!payment || !Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) {
    throw new TypeError("amountMinor must be a positive safe integer");
  }
  if (requireAccountNo && !/^[0-9]{10,20}$/.test(payment.accountNo)) {
    throw new TypeError("accountNo must be a full international number without plus sign or leading zero");
  }
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(payment.referenceId)) {
    throw new TypeError("referenceId must use only letters, numbers, dot, underscore, or dash");
  }
  if (!["basic", "pro", "unlimited"].includes(payment.plan)) {
    throw new TypeError("plan must be a supported subscription plan");
  }
  if (![1, 3, 6, 12].includes(payment.durationMonths)) {
    throw new TypeError("durationMonths must be 1, 3, 6, or 12");
  }
  if (payment.currency !== "USD") {
    throw new TypeError("Production subscription payments must use USD");
  }
}

function createRequestBase(serviceName) {
  return {
    schemaVersion: "1.0",
    requestId: randomUUID(),
    timestamp: `${new Date().toISOString().slice(0, 19)}Z`,
    channelName: "WEB",
    serviceName,
  };
}

export function buildProductionPurchaseRequest({ env = process.env, payment }) {
  validatePayment(payment);
  const credentials = [
    "WAAFIPAY_MERCHANT_UID",
    "WAAFIPAY_API_USER_ID",
    "WAAFIPAY_API_KEY",
  ];
  if (credentials.some((name) => !isConfiguredValue(env[name]))) {
    throw new Error("Production WaafiPay API credentials are not configured");
  }

  return {
    ...createRequestBase("API_PURCHASE"),
    serviceParams: {
      merchantUid: env.WAAFIPAY_MERCHANT_UID.trim(),
      apiUserId: env.WAAFIPAY_API_USER_ID.trim(),
      apiKey: env.WAAFIPAY_API_KEY.trim(),
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: { accountNo: payment.accountNo },
      transactionInfo: {
        referenceId: payment.referenceId,
        invoiceId: payment.referenceId,
        amount: Number((payment.amountMinor / 100).toFixed(2)),
        currency: payment.currency,
        description: String(payment.description || "Subscription payment").slice(0, 255),
      },
    },
  };
}

function findResponseParams(result) {
  return [result?.serviceParams, result?.params, result?.responseParams, result]
    .find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate))
    || {};
}

async function postWaafi(payload, fetcher) {
  const response = await fetcher(WAAFIPAY_PRODUCTION_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("WaafiPay returned an invalid response");
  }
  if (!response.ok || !result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("WaafiPay request could not be confirmed");
  }
  return result;
}

function normalizeState(params) {
  const state = params.state ?? params.status ?? params.tranStatusDesc;
  return typeof state === "string" ? state.trim().toLowerCase() : "";
}

function buildTransactionInfoRequest({ env, payment }) {
  for (const name of ["WAAFIPAY_HPP_STORE_ID", "WAAFIPAY_HPP_KEY"]) {
    if (!isConfiguredValue(env[name])) {
      throw new Error("Production WaafiPay transaction verification credentials are not configured");
    }
  }
  return {
    ...createRequestBase("HPP_GETTRANINFO"),
    serviceParams: {
      merchantUid: env.WAAFIPAY_MERCHANT_UID.trim(),
      storeId: env.WAAFIPAY_HPP_STORE_ID.trim(),
      hppKey: env.WAAFIPAY_HPP_KEY.trim(),
      referenceId: payment.referenceId,
    },
  };
}

export async function makeProductionPurchase({ env = process.env, payment, fetcher = fetch }) {
  const purchaseResponse = await postWaafi(
    buildProductionPurchaseRequest({ env, payment }),
    fetcher,
  );
  const purchaseParams = findResponseParams(purchaseResponse);
  const purchaseCode = typeof purchaseResponse.responseCode === "string"
    ? purchaseResponse.responseCode
    : "";
  const purchaseState = normalizeState(purchaseParams);

  if (FINAL_FAILURE_STATES.has(purchaseState)) {
    return {
      responseCode: purchaseCode,
      state: purchaseState,
      outcome: "failed",
      transactionId: null,
    };
  }
  if (purchaseCode !== "2001" || purchaseState !== "approved") {
    return {
      responseCode: purchaseCode || "unknown",
      state: purchaseState || "unknown",
      outcome: "pending",
      transactionId: null,
    };
  }

  return verifyProductionTransaction({ env, payment, fetcher });
}

export async function verifyProductionTransaction({ env = process.env, payment, fetcher = fetch }) {
  validatePayment(payment, { requireAccountNo: false });
  const verificationResponse = await postWaafi(
    buildTransactionInfoRequest({ env, payment }),
    fetcher,
  );
  const verificationParams = findResponseParams(verificationResponse);
  const verificationState = normalizeState(verificationParams);
  const verificationCode = typeof verificationResponse.responseCode === "string"
    ? verificationResponse.responseCode
    : "";
  const verifiedAmount = Number(verificationParams.tranAmount ?? verificationParams.amount);
  const verifiedCurrency = typeof verificationParams.currency === "string"
    ? verificationParams.currency.toUpperCase()
    : "";
  const verifiedInvoice = verificationParams.invoiceId;
  const verifiedReference = verificationParams.referenceId ?? verificationParams.reference_id;

  if (verificationCode === "2001"
    && verificationState === "approved"
    && verifiedAmount === payment.amountMinor / 100
    && verifiedCurrency === payment.currency
    && verifiedInvoice === payment.referenceId
    && (verifiedReference === undefined || verifiedReference === payment.referenceId)) {
    return {
      responseCode: verificationCode,
      state: verificationState,
      outcome: "succeeded",
      transactionId: typeof verificationParams.transactionId === "string"
        ? verificationParams.transactionId
        : null,
    };
  }

  if (FINAL_FAILURE_STATES.has(verificationState)) {
    return {
      responseCode: verificationCode || purchaseCode,
      state: verificationState,
      outcome: "failed",
      transactionId: typeof verificationParams.transactionId === "string"
        ? verificationParams.transactionId
        : null,
    };
  }

  return {
    responseCode: verificationCode || purchaseCode,
    state: verificationState || "verification_mismatch",
    outcome: "pending",
    transactionId: null,
  };
}

export function verifyWaafiWebhook({ env = process.env, headers, rawBody, now = Date.now() }) {
  if (!isConfiguredValue(env.WAAFIPAY_WEBHOOK_SECRET)) {
    return false;
  }
  const getHeader = (name) => typeof headers?.get === "function"
    ? headers.get(name)
    : headers?.[name.toLowerCase()] ?? null;
  const timestamp = getHeader("x-webhook-timestamp");
  const eventId = getHeader("x-webhook-event-id");
  const algorithm = getHeader("x-webhook-signature-alg");
  const signature = getHeader("x-webhook-signature");
  if (!timestamp || !/^[0-9]{1,12}$/.test(timestamp)
    || !eventId || eventId.length > 200
    || algorithm !== "HMAC-SHA256"
    || !signature || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)
    || Math.abs(Math.floor(now / 1000) - timestampSeconds) > 300) {
    return false;
  }

  const expected = createHmac("sha256", env.WAAFIPAY_WEBHOOK_SECRET.trim())
    .update(`${timestamp}.${eventId}.`, "utf8")
    .update(rawBody)
    .digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signWaafiWebhookForTest({ secret, timestamp, eventId, rawBody }) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.`, "utf8")
    .update(rawBody)
    .digest("hex");
}

export function getVerifiedWebhookPayment(payload, expectedMerchantUid) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.merchant_uid !== expectedMerchantUid) {
    return null;
  }
  const payment = payload.payment;
  const amount = Number(payment?.amount);
  if (!payment || typeof payment !== "object" || Array.isArray(payment)
    || typeof payment.reference_id !== "string"
    || !/^[A-Za-z0-9._-]{1,50}$/.test(payment.reference_id)
    || typeof payment.status !== "string"
    || !Number.isFinite(amount)
    || !Number.isSafeInteger(amount * 100)
    || amount <= 0
    || typeof payment.currency !== "string"
    || !/^[A-Za-z]{3}$/.test(payment.currency)) {
    return null;
  }
  if (!["authorization", "declined"].includes(payload.event)) {
    return { ignored: true };
  }
  return {
    event: payload.event,
    referenceId: payment.reference_id,
    status: payment.status.toUpperCase(),
    transactionId: typeof payment.transaction_id === "string"
      ? payment.transaction_id
      : null,
    amountMinor: amount * 100,
    currency: payment.currency.toUpperCase(),
    merchantUid: payload.merchant_uid,
  };
}
