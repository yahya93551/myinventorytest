
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

test("production readiness requires production mode and the three WaafiPay API credentials", () => {
  assert.equal(isProductionConfigured(env), true);

  assert.equal(
    isProductionConfigured({
      ...env,
      NODE_ENV: "development",
    }),
    false,
  );

  assert.equal(
    isProductionConfigured({
      ...env,
      WAAFIPAY_API_KEY: "",
    }),
    false,
  );

  assert.equal(
    isProductionConfigured({
      ...env,
      WAAFIPAY_API_USER_ID: "",
    }),
    false,
  );

  assert.equal(
    isProductionConfigured({
      ...env,
      WAAFIPAY_MERCHANT_UID: "",
    }),
    false,
  );

  assert.equal(
    isProductionConfigured({
      ...env,
      SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED: "false",
    }),
    false,
  );
});

test("production readiness requires webhook secret but does not require HPP credentials", () => {
  const withoutOptionalCredentials = {
    ...env,
  };

  delete withoutOptionalCredentials.WAAFIPAY_HPP_STORE_ID;
  delete withoutOptionalCredentials.WAAFIPAY_HPP_KEY;

  assert.equal(
    isProductionConfigured(withoutOptionalCredentials),
    true,
  );

  assert.equal(
    isProductionConfigured({
      ...withoutOptionalCredentials,
      WAAFIPAY_WEBHOOK_SECRET: "",
    }),
    false,
  );
});

test("builds a direct API_PURCHASE request with server-only production credentials", () => {
  const request = buildProductionPurchaseRequest({
    env,
    payment,
  });

  assert.equal(request.serviceName, "API_PURCHASE");

  assert.equal(
    request.serviceParams.merchantUid,
    env.WAAFIPAY_MERCHANT_UID,
  );

  assert.equal(
    request.serviceParams.apiUserId,
    env.WAAFIPAY_API_USER_ID,
  );

  assert.equal(
    request.serviceParams.apiKey,
    env.WAAFIPAY_API_KEY,
  );

  assert.equal(
    request.serviceParams.transactionInfo.amount,
    12.34,
  );

  assert.equal(
    request.serviceParams.transactionInfo.referenceId,
    payment.referenceId,
  );

  assert.equal(
    request.serviceParams.payerInfo.accountNo,
    payment.accountNo,
  );

  assert.equal(request.timestamp.length, 20);
});

test("only an approved provider state with success response code is successful", async () => {
  const calls = [];

  const result = await makeProductionPurchase({
    env,
    payment,

    fetcher: async (url, options) => {
      calls.push({
        url: String(url),
        body: JSON.parse(options.body),
      });

      return new Response(
        JSON.stringify({
          responseCode: "2001",
          serviceParams: {
            state: "approved",
            transactionId: "1303630",
          },
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, WAAFIPAY_PRODUCTION_ENDPOINT);
  assert.equal(calls[0].body.serviceName, "API_PURCHASE");

  assert.equal(result.responseCode, "2001");
  assert.equal(result.state, "approved");
  assert.equal(result.outcome, "succeeded");
  assert.equal(result.transactionId, "1303630");
});

test("does not perform HPP verification or make a second provider request", async () => {
  let calls = 0;

  await makeProductionPurchase({
    env,
    payment,

    fetcher: async () => {
      calls += 1;

      return new Response(
        JSON.stringify({
          responseCode: "2001",
          serviceParams: {
            state: "approved",
          },
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(calls, 1);
});

test("declined provider states fail while incomplete or unconfirmed responses remain pending", async () => {
  const responses = [
    {
      responseCode: "2001",
      serviceParams: {
        state: "unknown",
      },
    },
    {
      responseCode: "2001",
      serviceParams: {
        state: "processing",
      },
    },
    {
      responseCode: "5306",
      serviceParams: {
        state: "unknown",
      },
    },
  ];

  for (const [index, providerResponse] of responses.entries()) {
    const result = await makeProductionPurchase({
      env,
      payment,

      fetcher: async () =>
        new Response(
          JSON.stringify(providerResponse),
          { status: 200 },
        ),
    });

    assert.equal(
      result.outcome,
      index === 2 ? "failed" : "pending",
    );
  }
});

test("records WaafiPay's documented user-cancelled response as failed", async () => {
  const result = await makeProductionPurchase({
    env,
    payment,
    fetcher: async () => new Response(
      JSON.stringify({ responseCode: "5306", serviceParams: { state: "unknown" } }),
      { status: 200 },
    ),
  });

  assert.equal(result.outcome, "failed");
});

test("verifies webhook HMAC utility over raw bytes and rejects stale or altered deliveries", () => {
  const webhookEnv = {
    ...env,
    WAAFIPAY_WEBHOOK_SECRET: "waafi-webhook-secret-012345678901",
  };

  const rawBody = Buffer.from('{"event":"authorization"}');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const eventId = "event-001";

  const signature = signWaafiWebhookForTest({
    secret: webhookEnv.WAAFIPAY_WEBHOOK_SECRET,
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

  assert.equal(
    verifyWaafiWebhook({
      env: webhookEnv,
      headers,
      rawBody,
    }),
    true,
  );

  assert.equal(
    verifyWaafiWebhook({
      env: webhookEnv,
      headers,
      rawBody: Buffer.from(`${rawBody.toString()} `),
    }),
    false,
  );

  assert.equal(
    verifyWaafiWebhook({
      env: webhookEnv,
      headers: new Headers({
        ...Object.fromEntries(headers),
        "x-webhook-timestamp": String(
          Math.floor(Date.now() / 1000) - 301,
        ),
      }),
      rawBody,
    }),
    false,
  );
});

test("extracts only well-formed production authorization data", () => {
  const event = getVerifiedWebhookPayment(
    {
      event: "authorization",
      merchant_uid: env.WAAFIPAY_MERCHANT_UID,
      payment: {
        reference_id: payment.referenceId,
        status: "APPROVED",
        transaction_id: "1303630",
        amount: 12.34,
        currency: "USD",
      },
    },
    env.WAAFIPAY_MERCHANT_UID,
  );

  assert.deepEqual(event, {
    event: "authorization",
    referenceId: payment.referenceId,
    status: "APPROVED",
    transactionId: "1303630",
    amountMinor: 1234,
    currency: "USD",
    merchantUid: env.WAAFIPAY_MERCHANT_UID,
  });

  assert.equal(
    getVerifiedWebhookPayment(
      {
        event: "authorization",
        merchant_uid: "different-merchant",
        payment: {
          reference_id: payment.referenceId,
        },
      },
      env.WAAFIPAY_MERCHANT_UID,
    ),
    null,
  );
});
