import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProductionPurchaseRequest,
  getVerifiedWebhookPayment,
  isProductionConfigured,
  makeProductionPurchase,
  signWaafiWebhookForTest,
  verifyWaafiWebhook,
  WAAFIPAY_PRODUCTION_ENDPOINT,
} from "./production-waafipay.mjs";

const env = {
  NODE_ENV: "production",
  SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED: "true",
  WAAFIPAY_MERCHANT_UID: "M400394",
  WAAFIPAY_API_USER_ID: "APIUSER1",
  WAAFIPAY_API_KEY: "012345678901234567890123",
  WAAFIPAY_HPP_STORE_ID: "1234567890",
  WAAFIPAY_HPP_KEY: "hpp-key-012345678901234567",
  WAAFIPAY_WEBHOOK_SECRET: "waafi-webhook-secret-012345678901",
  SUBSCRIPTION_SERVICE_SHARED_SECRET: "service-token-012345678901234567",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-test-key",
};

const payment = {
  tenantId: "tenant-1",
  amountMinor: 1234,
  currency: "USD",
  referenceId: "sub-test-123",
  accountNo: "252611111111",
  description: "Subscription payment",
  plan: "basic",
  durationMonths: 3,
};

test("production readiness requires production mode and complete unmasked credentials", () => {
  assert.equal(isProductionConfigured(env), true);
  assert.equal(isProductionConfigured({ ...env, NODE_ENV: "development" }), false);
  assert.equal(isProductionConfigured({ ...env, WAAFIPAY_API_KEY: "API-d48ZL9RBf9yM**************" }), false);
  assert.equal(isProductionConfigured({ ...env, WAAFIPAY_HPP_KEY: "" }), false);
});

test("builds a direct API_PURCHASE request with server-only production credentials", () => {
  const request = buildProductionPurchaseRequest({ env, payment });

  assert.equal(request.serviceName, "API_PURCHASE");
  assert.equal(request.serviceParams.merchantUid, env.WAAFIPAY_MERCHANT_UID);
  assert.equal(request.serviceParams.apiUserId, env.WAAFIPAY_API_USER_ID);
  assert.equal(request.serviceParams.apiKey, env.WAAFIPAY_API_KEY);
  assert.equal(request.serviceParams.transactionInfo.amount, 12.34);
  assert.equal(request.serviceParams.transactionInfo.referenceId, payment.referenceId);
  assert.equal(request.serviceParams.payerInfo.accountNo, payment.accountNo);
  assert.equal(request.timestamp.length, 20);
});

test("production payment is approved only after matching HPP_GETTRANINFO confirmation", async () => {
  const calls = [];
  const result = await makeProductionPurchase({
    env,
    payment,
    fetcher: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          responseCode: "2001",
          serviceParams: { state: "approved" },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        responseCode: "2001",
        params: {
          status: "Approved",
          amount: 12.34,
          currency: "USD",
          invoiceId: payment.referenceId,
          transactionId: "1303630",
        },
      }), { status: 200 });
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, WAAFIPAY_PRODUCTION_ENDPOINT);
  assert.equal(calls[0].body.serviceName, "API_PURCHASE");
  assert.equal(calls[1].body.serviceName, "HPP_GETTRANINFO");
  assert.equal(calls[1].body.serviceParams.referenceId, payment.referenceId);
  assert.deepEqual(result, {
    responseCode: "2001",
    state: "approved",
    outcome: "succeeded",
    transactionId: "1303630",
  });
});

test("unmatched amount or currency never verifies a payment", async () => {
  for (const params of [
    { status: "Approved", amount: 99, currency: "USD", invoiceId: payment.referenceId },
    { status: "Approved", amount: 12.34, currency: "DJF", invoiceId: payment.referenceId },
  ]) {
    let callNumber = 0;
    const result = await makeProductionPurchase({
      env,
      payment,
      fetcher: async () => {
        callNumber += 1;
        const body = callNumber === 1
          ? { responseCode: "2001", serviceParams: { state: "approved" } }
          : { responseCode: "2001", params };
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });
    assert.equal(result.outcome, "pending");
  }
});

test("unconfirmed and explicitly declined responses are handled separately", async () => {
  const pending = await makeProductionPurchase({
    env,
    payment,
    fetcher: async () => new Response(JSON.stringify({
      responseCode: "2001",
      serviceParams: { state: "processing" },
    }), { status: 200 }),
  });
  assert.equal(pending.outcome, "pending");

  const failed = await makeProductionPurchase({
    env,
    payment,
    fetcher: async () => new Response(JSON.stringify({
      responseCode: "5306",
      serviceParams: { state: "declined" },
    }), { status: 200 }),
  });
  assert.equal(failed.outcome, "failed");
});

test("verifies webhook HMAC over raw bytes and rejects stale or altered deliveries", () => {
  const rawBody = Buffer.from('{"event":"authorization"}');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const eventId = "event-001";
  const signature = signWaafiWebhookForTest({
    secret: env.WAAFIPAY_WEBHOOK_SECRET,
    timestamp,
    eventId,
    rawBody,
  });
  const headers = new Headers({
    "x-webhook-timestamp": timestamp,
    "x-webhook-event-id": eventId,
    "x-webhook-signature-alg": "HMAC-SHA256",
    "x-webhook-signature": signature,
  });

  assert.equal(verifyWaafiWebhook({ env, headers, rawBody }), true);
  assert.equal(verifyWaafiWebhook({
    env,
    headers,
    rawBody: Buffer.from(`${rawBody.toString()} `),
  }), false);
  assert.equal(verifyWaafiWebhook({
    env,
    headers: new Headers({
      ...Object.fromEntries(headers),
      "x-webhook-timestamp": String(Math.floor(Date.now() / 1000) - 301),
    }),
    rawBody,
  }), false);
});

test("extracts only well-formed production authorization data", () => {
  const event = getVerifiedWebhookPayment({
    event: "authorization",
    merchant_uid: env.WAAFIPAY_MERCHANT_UID,
    payment: {
      reference_id: payment.referenceId,
      status: "APPROVED",
      transaction_id: "1303630",
      amount: 12.34,
      currency: "USD",
    },
  }, env.WAAFIPAY_MERCHANT_UID);

  assert.deepEqual(event, {
    event: "authorization",
    referenceId: payment.referenceId,
    status: "APPROVED",
    transactionId: "1303630",
    amountMinor: 1234,
    currency: "USD",
    merchantUid: env.WAAFIPAY_MERCHANT_UID,
  });
  assert.equal(getVerifiedWebhookPayment({
    event: "authorization",
    merchant_uid: "different-merchant",
    payment: { reference_id: payment.referenceId },
  }, env.WAAFIPAY_MERCHANT_UID), null);
});
