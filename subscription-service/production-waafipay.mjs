
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const WAAFIPAY_PRODUCTION_ENDPOINT =
  "https://api.waafipay.net/asm";
export const WAAFIPAY_SANDBOX_ENDPOINT =
  "https://sandbox.waafipay.com/asm";

function isConfiguredValue(value) {
  return (
    typeof value === "string"
    && value.trim().length > 0
    && !/your_real|your-production|\*{3,}/i.test(value.trim())
  );
}

/**
 * Checks whether all required production credentials are configured.
 * This does NOT enable payments.
 *
 * HPP credentials and the webhook secret are not required for direct checkout.
 * The webhook secret is only required to authenticate webhook deliveries.
 */
export function isProductionCredentialsConfigured(env = process.env) {
  return (
    env.NODE_ENV === "production"
    && getProductionConfigurationIssues(env)
      .every((name) => name === "SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED")
  );
}

export function getProductionConfigurationIssues(env = process.env) {
  const issues = [];

  if (env.NODE_ENV !== "production") issues.push("NODE_ENV");
  if (env.SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED !== "true") {
    issues.push("SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED");
  }
  if (
    !isConfiguredValue(env.WAAFIPAY_MERCHANT_UID)
    || env.WAAFIPAY_MERCHANT_UID.trim().length < 7
    || env.WAAFIPAY_MERCHANT_UID.trim().length > 15
  ) issues.push("WAAFIPAY_MERCHANT_UID");
  if (
    !isConfiguredValue(env.WAAFIPAY_API_USER_ID)
    || env.WAAFIPAY_API_USER_ID.trim().length < 7
    || env.WAAFIPAY_API_USER_ID.trim().length > 15
  ) issues.push("WAAFIPAY_API_USER_ID");
  if (
    !isConfiguredValue(env.WAAFIPAY_API_KEY)
    || env.WAAFIPAY_API_KEY.trim().length < 20
    || env.WAAFIPAY_API_KEY.trim().length > 40
  ) issues.push("WAAFIPAY_API_KEY");

  for (const name of [
    "SUBSCRIPTION_SERVICE_SHARED_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (!isConfiguredValue(env[name])) issues.push(name);
  }

  if (
    isConfiguredValue(env.SUBSCRIPTION_SERVICE_SHARED_SECRET)
    && env.SUBSCRIPTION_SERVICE_SHARED_SECRET.length < 32
  ) {
    issues.push("SUBSCRIPTION_SERVICE_SHARED_SECRET");
  }

  return [...new Set(issues)];
}

/**
 * Actual production checkout gate.
 * Credentials AND explicit production enablement are required.
 */
export function isProductionConfigured(env = process.env) {
  return getProductionConfigurationIssues(env).length === 0;
}

export function getSandboxConfigurationIssues(env = process.env) {
  const issues = [];

  if (env.SUBSCRIPTION_WAAFIPAY_SANDBOX_ENABLED !== "true") {
    issues.push("SUBSCRIPTION_WAAFIPAY_SANDBOX_ENABLED");
  }
  if (
    !isConfiguredValue(env.WAAFIPAY_SANDBOX_MERCHANT_UID)
    || env.WAAFIPAY_SANDBOX_MERCHANT_UID.trim().length < 7
    || env.WAAFIPAY_SANDBOX_MERCHANT_UID.trim().length > 15
  ) issues.push("WAAFIPAY_SANDBOX_MERCHANT_UID");
  if (
    !isConfiguredValue(env.WAAFIPAY_SANDBOX_API_USER_ID)
    || env.WAAFIPAY_SANDBOX_API_USER_ID.trim().length < 7
    || env.WAAFIPAY_SANDBOX_API_USER_ID.trim().length > 15
  ) issues.push("WAAFIPAY_SANDBOX_API_USER_ID");
  if (
    !isConfiguredValue(env.WAAFIPAY_SANDBOX_API_KEY)
    || env.WAAFIPAY_SANDBOX_API_KEY.trim().length < 20
    || env.WAAFIPAY_SANDBOX_API_KEY.trim().length > 40
  ) issues.push("WAAFIPAY_SANDBOX_API_KEY");

  if (
    !isConfiguredValue(env.SUBSCRIPTION_SERVICE_SHARED_SECRET)
    || env.SUBSCRIPTION_SERVICE_SHARED_SECRET.length < 32
  ) issues.push("SUBSCRIPTION_SERVICE_SHARED_SECRET");

  return [...new Set(issues)];
}

function validatePayment(payment, { requireAccountNo = true } = {}) {
  if (
    !payment
    || !Number.isSafeInteger(payment.amountMinor)
    || payment.amountMinor <= 0
  ) {
    throw new TypeError("amountMinor must be a positive safe integer");
  }

  if (
    requireAccountNo
    && !/^[0-9]{10,20}$/.test(payment.accountNo)
  ) {
    throw new TypeError(
      "accountNo must be a full international number without plus sign or leading zero",
    );
  }

  if (!/^[A-Za-z0-9._-]{1,50}$/.test(payment.referenceId)) {
    throw new TypeError(
      "referenceId must use only letters, numbers, dot, underscore, or dash",
    );
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

/**
 * Builds a direct WaafiPay API_PURCHASE request.
 * No HPP credentials are used.
 */
export function buildProductionPurchaseRequest({
  env = process.env,
  payment,
}) {
  validatePayment(payment);

  const credentials = [
    "WAAFIPAY_MERCHANT_UID",
    "WAAFIPAY_API_USER_ID",
    "WAAFIPAY_API_KEY",
  ];

  if (credentials.some((name) => !isConfiguredValue(env[name]))) {
    throw new Error(
      "Production WaafiPay API credentials are not configured",
    );
  }

  return {
    ...createRequestBase("API_PURCHASE"),
    serviceParams: {
      merchantUid: env.WAAFIPAY_MERCHANT_UID.trim(),
      apiUserId: env.WAAFIPAY_API_USER_ID.trim(),
      apiKey: env.WAAFIPAY_API_KEY.trim(),
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: {
        accountNo: payment.accountNo,
      },
      transactionInfo: {
        referenceId: payment.referenceId,
        invoiceId: payment.referenceId,
        amount: Number((payment.amountMinor / 100).toFixed(2)),
        currency: payment.currency,
        description: String(
          payment.description || "Subscription payment",
        ).slice(0, 255),
      },
    },
  };
}

export function buildSandboxPurchaseRequest({
  env = process.env,
  payment,
}) {
  validatePayment(payment);

  const credentials = [
    "WAAFIPAY_SANDBOX_MERCHANT_UID",
    "WAAFIPAY_SANDBOX_API_USER_ID",
    "WAAFIPAY_SANDBOX_API_KEY",
  ];

  if (credentials.some((name) => !isConfiguredValue(env[name]))) {
    throw new Error("Sandbox WaafiPay API credentials are not configured");
  }

  return {
    ...createRequestBase("API_PURCHASE"),
    serviceParams: {
      merchantUid: env.WAAFIPAY_SANDBOX_MERCHANT_UID.trim(),
      apiUserId: env.WAAFIPAY_SANDBOX_API_USER_ID.trim(),
      apiKey: env.WAAFIPAY_SANDBOX_API_KEY.trim(),
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: {
        accountNo: payment.accountNo,
      },
      transactionInfo: {
        referenceId: payment.referenceId,
        invoiceId: payment.referenceId,
        amount: Number((payment.amountMinor / 100).toFixed(2)),
        currency: payment.currency,
        description: String(
          payment.description || "Subscription sandbox test",
        ).slice(0, 255),
      },
    },
  };
}

function makeSafeRequestPreview(payload, endpoint = WAAFIPAY_PRODUCTION_ENDPOINT) {
  return {
    endpoint,
    payload: {
      ...payload,
      serviceParams: {
        ...payload.serviceParams,
        merchantUid: "[REDACTED]",
        apiUserId: "[REDACTED]",
        apiKey: "[REDACTED]",
        payerInfo: {
          ...payload.serviceParams.payerInfo,
          accountNo: `****${payload.serviceParams.payerInfo.accountNo.slice(-4)}`,
        },
      },
    },
  };
}

function redactAccountNo(value, accountNo) {
  if (typeof value !== "string") return null;

  const mask = `****${accountNo.slice(-4)}`;
  const accountPattern = new RegExp(accountNo.split("").join("\\D*"), "g");
  return value.replace(accountPattern, mask);
}

function findResponseParams(result) {
  return [
    result?.serviceParams,
    result?.params,
    result?.responseParams,
    result,
  ].find(
    (candidate) =>
      candidate
      && typeof candidate === "object"
      && !Array.isArray(candidate),
  ) || {};
}

async function postWaafi(payload, fetcher, {
  endpoint = WAAFIPAY_PRODUCTION_ENDPOINT,
  allowHttpErrorResponse = false,
} = {}) {
  const response = await fetcher(endpoint, {
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

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("WaafiPay returned an invalid response");
  }
  if (!response.ok && !allowHttpErrorResponse) {
    throw new Error("WaafiPay request could not be confirmed");
  }

  return { result, httpStatus: response.status };
}

function normalizeState(params) {
  const state =
    params.state
    ?? params.status
    ?? params.tranStatusDesc;

  return typeof state === "string"
    ? state.trim().toLowerCase()
    : "";
}

function indicatesInsufficientBalance(response, params) {
  const providerText = [
    response.responseMsg,
    response.responseMessage,
    response.message,
    response.errorMessage,
    response.errorCode,
    params.state,
    params.status,
    params.tranStatusDesc,
    params.responseMsg,
    params.responseMessage,
    params.message,
    params.errorMessage,
    params.errorCode,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return /insufficient.{0,30}(balance|funds|credit)|not enough.{0,30}(balance|funds|credit)|low.{0,20}balance|balance.{0,30}(too low|low|insufficient|not enough)|funds.{0,30}insufficient/.test(providerText);
}

function indicatesUserRejection(response, params) {
  const providerText = [
    response.responseMsg,
    response.responseMessage,
    params.responseMsg,
    params.responseMessage,
    params.description,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase();

  return providerText.includes("rcs_user_rejected")
    || providerText.includes("customer rejected payment");
}

/**
 * Sends one direct API_PURCHASE request and trusts only a definitive provider
 * state. An uncertain response stays pending and must never trigger a retry.
 */
export async function makeProductionPurchase({
  env = process.env,
  payment,
  fetcher = fetch,
}) {
  const requestPayload = buildProductionPurchaseRequest({ env, payment });
  const requestPreview = makeSafeRequestPreview(requestPayload);
  let purchaseResponse;
  try {
    ({ result: purchaseResponse } = await postWaafi(requestPayload, fetcher));
  } catch (error) {
    if (error instanceof Error) {
      error.requestPreview = requestPreview;
    }
    throw error;
  }

  const purchaseParams = findResponseParams(purchaseResponse);

  const purchaseCode = typeof purchaseResponse.responseCode === "string"
    ? purchaseResponse.responseCode.trim()
    : typeof purchaseResponse.responseCode === "number"
      ? String(purchaseResponse.responseCode)
      : "";

  const purchaseState = normalizeState(purchaseParams);
  const insufficientBalance = indicatesInsufficientBalance(
    purchaseResponse,
    purchaseParams,
  );
  const userRejected = indicatesUserRejection(
    purchaseResponse,
    purchaseParams,
  );

  const transactionId =
    typeof purchaseParams.transactionId === "string"
      ? purchaseParams.transactionId
      : null;
  const failedStates = new Set([
    "cancelled",
    "canceled",
    "declined",
    "failed",
    "rejected",
  ]);
  const outcome = purchaseCode === "2001" && purchaseState === "approved"
    ? "succeeded"
    : insufficientBalance
      || userRejected
      || failedStates.has(purchaseState)
      || purchaseCode === "5306"
      ? "failed"
      : "pending";
  const state = insufficientBalance
    ? "insufficient_balance"
    : userRejected
      ? "user_rejected"
    : purchaseState && purchaseState !== "unknown"
      ? purchaseState
      : outcome === "succeeded"
        ? "approved"
        : outcome === "failed"
          ? purchaseCode === "5306"
            ? "cancelled"
            : "failed"
          : "awaiting_confirmation";

  return {
    responseCode: purchaseCode || "unknown",
    state,
    outcome,
    transactionId,
    requestPreview,
  };
}

/**
 * Sends a sandbox purchase without persisting or applying its outcome.
 */
export async function makeSandboxPurchase({
  env = process.env,
  payment,
  fetcher = fetch,
}) {
  const requestPayload = buildSandboxPurchaseRequest({ env, payment });
  const requestPreview = makeSafeRequestPreview(
    requestPayload,
    WAAFIPAY_SANDBOX_ENDPOINT,
  );
  let purchaseResponse;
  let httpStatus;

  try {
    ({ result: purchaseResponse, httpStatus } = await postWaafi(
      requestPayload,
      fetcher,
      {
        endpoint: WAAFIPAY_SANDBOX_ENDPOINT,
        allowHttpErrorResponse: true,
      },
    ));
  } catch (error) {
    if (error instanceof Error) {
      error.requestPreview = requestPreview;
    }
    throw error;
  }

  const responseParams = findResponseParams(purchaseResponse);
  const responseCode = typeof purchaseResponse.responseCode === "string"
    ? purchaseResponse.responseCode
    : null;
  const state = redactAccountNo(
    normalizeState(responseParams) || "unknown",
    payment.accountNo,
  );
  const transactionId = redactAccountNo(
    responseParams.transactionId,
    payment.accountNo,
  );
  const failedStates = new Set([
    "cancelled",
    "canceled",
    "declined",
    "failed",
    "rejected",
  ]);
  const outcome = responseCode === "2001" && state === "approved"
    ? "succeeded"
    : failedStates.has(state) || responseCode === "5306"
      ? "failed"
      : "pending";
  const responseMessage = redactAccountNo(
    typeof purchaseResponse.responseMsg === "string"
      ? purchaseResponse.responseMsg.slice(0, 300)
      : null,
    payment.accountNo,
  );
  const errorCode = redactAccountNo(
    typeof purchaseResponse.errorCode === "string"
      ? purchaseResponse.errorCode.slice(0, 80)
      : null,
    payment.accountNo,
  );
  const rawProviderReference = [
    responseParams.providerReference,
    responseParams.referenceId,
    purchaseResponse.providerReference,
  ].find((value) => typeof value === "string" && value.length <= 100) || null;
  const providerReference = redactAccountNo(
    rawProviderReference,
    payment.accountNo,
  );

  return {
    httpStatus,
    responseCode,
    responseMessage,
    errorCode,
    state,
    transactionId,
    providerReference,
    requestId: requestPayload.requestId,
    outcome,
    requestPreview,
  };
}

/**
 * Compatibility export for service.mjs.
 * HPP verification is removed.
 * This function cannot mark a payment as successful.
 */
export async function verifyProductionTransaction() {
  return {
    responseCode: "manual_verification_required",
    state: "pending_manual_verification",
    outcome: "pending",
    transactionId: null,
  };
}

/**
 * Verifies webhook authenticity before payment status reconciliation.
 */
export function verifyWaafiWebhook({
  env = process.env,
  headers,
  rawBody,
  now = Date.now(),
}) {
  if (!isConfiguredValue(env.WAAFIPAY_WEBHOOK_SECRET)) {
    return false;
  }

  const getHeader = (name) =>
    typeof headers?.get === "function"
      ? headers.get(name)
      : headers?.[name.toLowerCase()] ?? null;

  const timestamp = getHeader("x-webhook-timestamp");
  const eventId = getHeader("x-webhook-event-id");
  const algorithm = getHeader("x-webhook-signature-alg");
  const signature = getHeader("x-webhook-signature");

  if (
    typeof timestamp !== "string"
    || !/^[0-9]{1,12}$/.test(timestamp)
    || typeof eventId !== "string"
    || eventId.length > 200
    || typeof algorithm !== "string"
    || algorithm !== "HMAC-SHA256"
    || typeof signature !== "string"
    || !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return false;
  }

  const timestampSeconds = Number(timestamp);

  if (
    !Number.isSafeInteger(timestampSeconds)
    || Math.abs(Math.floor(now / 1000) - timestampSeconds) > 300
  ) {
    return false;
  }

  const expected = createHmac(
    "sha256",
    env.WAAFIPAY_WEBHOOK_SECRET.trim(),
  )
    .update(`${timestamp}.${eventId}.`, "utf8")
    .update(rawBody)
    .digest();

  const actual = Buffer.from(signature, "hex");

  return (
    actual.length === expected.length
    && timingSafeEqual(actual, expected)
  );
}

export function signWaafiWebhookForTest({
  secret,
  timestamp,
  eventId,
  rawBody,
}) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.`, "utf8")
    .update(rawBody)
    .digest("hex");
}

/**
 * Validates the structure of a WaafiPay webhook payment.
 * This function does not approve or activate subscriptions.
 */
export function getVerifiedWebhookPayment(
  payload,
  expectedMerchantUid,
) {
  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
    || payload.merchant_uid !== expectedMerchantUid
  ) {
    return null;
  }

  const payment = payload.payment;
  const amount = Number(payment?.amount);

  if (
    !payment
    || typeof payment !== "object"
    || Array.isArray(payment)
    || typeof payment.reference_id !== "string"
    || !/^[A-Za-z0-9._-]{1,50}$/.test(payment.reference_id)
    || typeof payment.status !== "string"
    || !Number.isFinite(amount)
    || !Number.isSafeInteger(amount * 100)
    || amount <= 0
    || typeof payment.currency !== "string"
    || !/^[A-Za-z]{3}$/.test(payment.currency)
  ) {
    return null;
  }

  if (!["authorization", "declined"].includes(payload.event)) {
    return { ignored: true };
  }

  return {
    event: payload.event,
    referenceId: payment.reference_id,
    status: payment.status.toUpperCase(),
    transactionId:
      typeof payment.transaction_id === "string"
        ? payment.transaction_id
        : null,
    amountMinor: amount * 100,
    currency: payment.currency.toUpperCase(),
    merchantUid: payload.merchant_uid,
  };
}
