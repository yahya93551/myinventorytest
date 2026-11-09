import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { timingSafeEqual } from "node:crypto";
import {
  getVerifiedWebhookPayment,
  isProductionConfigured,
  makeProductionPurchase,
  verifyProductionTransaction,
  verifyWaafiWebhook,
} from "./production-waafipay.mjs";
import {
  applyProductionResult,
  beginProductionPayment,
  processProductionWebhook,
} from "./production-payment-store.mjs";

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function isAuthorized(request, env) {
  const expected = env.SUBSCRIPTION_SERVICE_SHARED_SECRET;
  const authorization = request.headers.authorization;
  if (typeof expected !== "string" || expected.length < 32 || typeof authorization !== "string") {
    return false;
  }
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) {
    return false;
  }
  const actualBytes = Buffer.from(authorization.slice(prefix.length));
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large"), { status: 413 });
    }
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 });
  }
}

async function readRawBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large"), { status: 413 });
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export function createServer({
  env = process.env,
  productionPurchase = makeProductionPurchase,
  productionVerify = verifyProductionTransaction,
  productionStore = {
    begin: (payment) => beginProductionPayment({ env, payment }),
    applyResult: (result) => applyProductionResult({ env, ...result }),
    processWebhook: (eventId, payment) => processProductionWebhook({ env, eventId, payment }),
  },
} = {}) {
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      const configured = isProductionConfigured(env);
      sendJson(response, configured ? 200 : 503, {
        status: configured ? "ready" : "not_configured",
        provider: "waafipay",
        environment: "production",
      });
      return;
    }

    if (url.pathname === "/webhooks/waafipay" && request.method === "POST") {
      if (env.NODE_ENV !== "production") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      try {
        const rawBody = await readRawBody(request);
        let payload;
        try {
          payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
          sendJson(response, 400, { error: "Request body must be valid JSON" });
          return;
        }

        if (payload?.event === "webhook.test") {
          sendJson(response, 200, { received: true });
          return;
        }
        if (!verifyWaafiWebhook({ env, headers: request.headers, rawBody })) {
          sendJson(response, 401, { error: "Invalid webhook signature" });
          return;
        }

        const eventId = request.headers["x-webhook-event-id"];
        const payment = getVerifiedWebhookPayment(payload, env.WAAFIPAY_MERCHANT_UID);
        if (!payment || payment.ignored) {
          sendJson(response, 200, { received: true });
          return;
        }
        await productionStore.processWebhook(eventId, payment);
        sendJson(response, 200, { received: true });
      } catch (error) {
        const status = Number.isInteger(error?.status) ? error.status : 500;
        if (status >= 500) {
          console.error("WaafiPay webhook processing failed:", error instanceof Error ? error.message : "unknown error");
        }
        sendJson(response, status, { error: "Webhook processing failed" });
      }
      return;
    }

    if (url.pathname === "/checkout" && request.method === "POST") {
      if (env.NODE_ENV !== "production") {
        sendJson(response, 404, { error: "Production checkout is only available in production" });
        return;
      }
      if (!isAuthorized(request, env)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }
      if (!isProductionConfigured(env)) {
        sendJson(response, 503, { error: "WaafiPay payment service is not configured" });
        return;
      }

      try {
        const body = await readJsonBody(request);
        const payment = {
          tenantId: body?.tenantId,
          amountMinor: body?.amountMinor,
          currency: body?.currency,
          referenceId: body?.referenceId,
          accountNo: body?.accountNo,
          description: body?.description,
          plan: body?.plan,
          durationMonths: body?.durationMonths,
        };

        const { record, created } = await productionStore.begin(payment);
        if (!created) {
          const recordedPayment = {
            tenantId: record.tenant_id,
            amountMinor: record.amount_minor,
            currency: record.currency,
            referenceId: record.reference_id,
            plan: record.plan,
            durationMonths: record.duration_months,
          };
          if (record.status === "pending") {
            try {
              const result = await productionVerify({ env, payment: recordedPayment });
              const updated = await productionStore.applyResult({
                referenceId: record.reference_id,
                outcome: result.outcome,
                providerState: result.state,
                transactionId: result.transactionId,
              });
              const appliedStatus = updated?.status ?? "pending";
              sendJson(response, 200, {
                referenceId: record.reference_id,
                outcome: appliedStatus === result.outcome ? result.outcome : "pending",
                providerState: result.state,
                duplicate: true,
                verified: appliedStatus === result.outcome
                  && (result.outcome === "succeeded" || result.outcome === "failed"),
                paymentStatus: appliedStatus,
                plan: record.plan,
                durationMonths: record.duration_months,
              });
            } catch (error) {
              console.error("Pending WaafiPay transaction could not be reconciled:", error instanceof Error ? error.message : "unknown error");
              sendJson(response, 200, {
                referenceId: record.reference_id,
                outcome: "pending",
                providerState: "verification_pending",
                duplicate: true,
                verified: false,
                plan: record.plan,
                durationMonths: record.duration_months,
              });
            }
            return;
          }
          sendJson(response, 200, {
            referenceId: record.reference_id,
            outcome: record.status,
            providerState: record.provider_state,
            duplicate: true,
            verified: record.status === "succeeded" || record.status === "failed",
            plan: record.plan,
            durationMonths: record.duration_months,
          });
          return;
        }

        try {
          const result = await productionPurchase({ env, payment });
          const updated = await productionStore.applyResult({
            referenceId: record.reference_id,
            outcome: result.outcome,
            providerState: result.state,
            transactionId: result.transactionId,
          });
          const appliedStatus = updated?.status ?? "pending";
          sendJson(response, 200, {
            referenceId: record.reference_id,
            outcome: appliedStatus === result.outcome ? result.outcome : "pending",
            providerState: result.state,
            duplicate: false,
            verified: appliedStatus === result.outcome
              && (result.outcome === "succeeded" || result.outcome === "failed"),
            paymentStatus: appliedStatus,
            plan: record.plan,
            durationMonths: record.duration_months,
          });
        } catch (error) {
          console.error("Production WaafiPay payment could not be confirmed:", error instanceof Error ? error.message : "unknown error");
          sendJson(response, 502, {
            referenceId: record.reference_id,
            outcome: "pending",
            providerState: "verification_pending",
            error: "Payment result could not be confirmed; do not retry with a new reference",
          });
        }
      } catch (error) {
        const status = Number.isInteger(error?.status)
          ? error.status
          : error instanceof TypeError
            ? 422
            : 500;
        if (status === 500) {
          console.error("Production checkout request could not be recorded:", error instanceof Error ? error.message : "unknown error");
        }
        sendJson(response, status, { error: error instanceof Error ? error.message : "Invalid payment request" });
      }
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST
    || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  const port = parsePort(process.env.PORT || "4100");
  const server = createServer();

  server.listen(port, host, () => {
    console.log(`Subscription service listening on http://${host}:${port}`);
  });

  server.on("error", (error) => {
    console.error("Subscription service failed to start:", error.message);
    process.exitCode = 1;
  });
}
