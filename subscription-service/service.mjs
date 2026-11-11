
import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { timingSafeEqual } from "node:crypto";

import {
  isProductionConfigured,
  isProductionCredentialsConfigured,
  getVerifiedWebhookPayment,
  makeProductionPurchase,
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

  if (
    typeof expected !== "string"
    || expected.length < 32
    || typeof authorization !== "string"
  ) {
    return false;
  }

  const prefix = "Bearer ";

  if (!authorization.startsWith(prefix)) {
    return false;
  }

  const actualBytes = Buffer.from(authorization.slice(prefix.length));
  const expectedBytes = Buffer.from(expected);

  return (
    actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes)
  );
}

async function readRawBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    totalBytes += bytes.length;

    if (totalBytes > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large"), {
        status: 413,
      });
    }

    chunks.push(bytes);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  const body = await readRawBody(request);

  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), {
      status: 400,
    });
  }
}

export function createServer({
  env = process.env,
  productionPurchase = makeProductionPurchase,

  productionStore = {
    begin: (payment) => beginProductionPayment({ env, payment }),
    applyResult: (result) => applyProductionResult({ env, ...result }),
    processWebhook: (event) => processProductionWebhook({ env, ...event }),
  },
} = {}) {
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");

    // Basic health check.
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    // Report credential configuration separately from checkout enablement.
    if (request.method === "GET" && url.pathname === "/ready") {
      const credentialsConfigured =
        isProductionCredentialsConfigured(env);

      const checkoutEnabled =
        env.SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED === "true";

      const ready =
        credentialsConfigured && checkoutEnabled;

      sendJson(response, ready ? 200 : 503, {
        status: ready
          ? "ready"
          : credentialsConfigured
            ? "configured_disabled"
            : "not_configured",
        provider: "waafipay",
        environment: "production",
      });

      return;
    }

    if (url.pathname === "/webhooks/waafipay") {
      if (request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
        return;
      }

      let rawBody;
      try {
        rawBody = await readRawBody(request);
      } catch (error) {
        sendJson(
          response,
          Number.isInteger(error?.status) ? error.status : 400,
          { error: error instanceof Error ? error.message : "Invalid webhook body" },
        );
        return;
      }

      if (!verifyWaafiWebhook({
        env,
        headers: request.headers,
        rawBody,
      })) {
        sendJson(response, 401, { error: "Invalid WaafiPay webhook signature" });
        return;
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        sendJson(response, 400, { error: "Webhook body must be valid JSON" });
        return;
      }

      const event = getVerifiedWebhookPayment(
        payload,
        env.WAAFIPAY_MERCHANT_UID,
      );
      if (!event) {
        sendJson(response, 422, { error: "Invalid WaafiPay webhook payment" });
        return;
      }

      if (event.ignored) {
        sendJson(response, 200, { received: true, ignored: true });
        return;
      }

      const eventId = request.headers["x-webhook-event-id"];
      if (typeof eventId !== "string") {
        sendJson(response, 401, { error: "Invalid WaafiPay webhook event ID" });
        return;
      }

      try {
        const result = await productionStore.processWebhook({
          ...event,
          eventId,
        });
        sendJson(response, 200, { received: true, data: result });
      } catch (error) {
        console.error(
          "WaafiPay webhook could not update the payment record:",
          error instanceof Error ? error.message : "unknown error",
        );
        sendJson(response, 500, { error: "Payment webhook could not be recorded" });
      }

      return;
    }

    // Customer checkout.
    if (url.pathname === "/checkout" && request.method === "POST") {
      if (env.NODE_ENV !== "production") {
        sendJson(response, 404, {
          error: "Production checkout is only available in production",
        });
        return;
      }

      if (!isAuthorized(request, env)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }

      // Keep the original production payment safety gate.
      if (!isProductionConfigured(env)) {
        sendJson(response, 503, {
          error: "WaafiPay payment service is not configured",
        });
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

        // First create or retrieve the payment record.
        const { record, created } =
          await productionStore.begin(payment);

        if (!record) {
          throw new Error("Payment record could not be created");
        }

        // Existing payment: NEVER send another purchase request.
        if (!created) {
          sendJson(response, 200, {
            referenceId: record.reference_id,
            outcome: record.status,
            providerState: record.provider_state,
            duplicate: true,
            verified: record.status === "succeeded"
              || record.status === "failed",
            paymentStatus: record.status,
            plan: record.plan,
            durationMonths: record.duration_months,
          });

          return;
        }

        // New payment: send the request to WaafiPay once.
        try {
          const result = await productionPurchase({ env, payment });

          const updated = await productionStore.applyResult({
            referenceId: record.reference_id,
            outcome: result?.outcome || "pending",
            providerState:
              result?.state || "awaiting_manual_verification",
            transactionId: result?.transactionId,
          });

          const paymentStatus = updated?.status || result?.outcome || "pending";
          const message = paymentStatus === "succeeded"
            ? "WaafiPay confirmed payment; subscription activated."
            : paymentStatus === "failed"
              ? "WaafiPay declined or failed the payment; no subscription was activated."
              : "Payment request submitted. Check your EVC wallet for an approval prompt. Do not retry while this payment is pending.";

          sendJson(response, 200, {
            referenceId: record.reference_id,
            outcome: paymentStatus,
            providerState: updated?.provider_state
              || result?.state
              || "awaiting_manual_verification",
            duplicate: false,
            verified: paymentStatus === "succeeded" || paymentStatus === "failed",
            paymentStatus,
            responseCode: result?.responseCode || null,
            plan: record.plan,
            durationMonths: record.duration_months,
            message,
          });
        } catch (error) {
          console.error(
            "Production WaafiPay payment could not be confirmed:",
            error instanceof Error ? error.message : "unknown error",
          );

          sendJson(response, 502, {
            referenceId: record.reference_id,
            outcome: "pending",
            providerState: "verification_pending",
            duplicate: false,
            verified: false,
            paymentStatus: "pending",
            plan: record.plan,
            durationMonths: record.duration_months,
            error: "Payment result could not be confirmed. Do not retry with a new reference.",
          });
        }
      } catch (error) {
        const status = Number.isInteger(error?.status)
          ? error.status
          : error instanceof TypeError
            ? 422
            : 500;

        if (status === 500) {
          console.error(
            "Production checkout request could not be recorded:",
            error instanceof Error ? error.message : "unknown error",
          );
        }

        sendJson(response, status, {
          error: error instanceof Error
            ? error.message
            : "Invalid payment request",
        });
      }

      return;
    }

    if (request.method !== "GET") {
      sendJson(
        response,
        405,
        { error: "Method not allowed" },
        { Allow: "GET" },
      );

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

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const host = process.env.HOST
    || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

  const port = parsePort(process.env.PORT || "4100");
  const server = createServer();

  server.listen(port, host, () => {
    console.log(
      `Subscription service listening on http://${host}:${port}`,
    );
  });

  server.on("error", (error) => {
    console.error("Subscription service failed to start:", error.message);
    process.exitCode = 1;
  });
}
