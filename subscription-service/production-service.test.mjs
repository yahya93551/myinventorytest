
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "./service.mjs";
import { signWaafiWebhookForTest } from "./production-waafipay.mjs";

const serviceSecret = "service-token-012345678901234567";

const env = {
  NODE_ENV: "production",
  SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED: "true",
  SUBSCRIPTION_SERVICE_SHARED_SECRET: serviceSecret,
  WAAFIPAY_MERCHANT_UID: "M400394",
  WAAFIPAY_API_USER_ID: "APIUSER1",
  WAAFIPAY_API_KEY: "012345678901234567890123",
  WAAFIPAY_WEBHOOK_SECRET: "waafi-webhook-secret-012345678901",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-test-key",
};

let server;
let baseUrl;
const applied = [];
const processedWebhooks = [];

before(async () => {
  server = createServer({
    env,
    productionStore: {
      begin: async (payment) => ({
        created: true,
        record: {
          reference_id: payment.referenceId,
          status: "pending",
        },
      }),
      applyResult: async (result) => {
        applied.push(result);
        return { status: result.outcome };
      },
      processWebhook: async (event) => {
        processedWebhooks.push(event);
        return {
          referenceId: event.referenceId,
          status: event.status === "APPROVED" ? "succeeded" : "failed",
        };
      },
    },
    productionPurchase: async () => ({
      responseCode: "2001",
      state: "approved",
      outcome: "succeeded",
      transactionId: "1303630",
      requestPreview: {
        endpoint: "https://api.waafipay.net/asm",
        payload: {
          serviceName: "API_PURCHASE",
          serviceParams: {
            apiKey: "[REDACTED]",
            accountNo: "****1111",
          },
        },
      },
    }),
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("production readiness is private and reports configured production mode", async () => {
  const response = await fetch(`${baseUrl}/ready`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ready",
    provider: "waafipay",
    environment: "production",
    missingConfiguration: [],
  });
});

test("non-production checkout is unavailable and cannot call the provider", async () => {
  let localServer;
  let purchaseCalls = 0;

  try {
    localServer = createServer({
      env: { ...env, NODE_ENV: "development" },
      productionPurchase: async () => {
        purchaseCalls += 1;
        throw new Error("Non-production must not call the payment provider");
      },
    });

    await new Promise((resolve, reject) => {
      localServer.once("error", reject);
      localServer.listen(0, "127.0.0.1", resolve);
    });

    const localUrl = `http://127.0.0.1:${localServer.address().port}`;

    const readiness = await fetch(`${localUrl}/ready`);

    assert.equal(readiness.status, 503);
    assert.deepEqual(await readiness.json(), {
      status: "not_configured",
      provider: "waafipay",
      environment: "production",
      missingConfiguration: ["NODE_ENV"],
    });

    const checkout = await fetch(`${localUrl}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(checkout.status, 404);
    assert.equal(purchaseCalls, 0);
  } finally {
    if (localServer) {
      await new Promise((resolve, reject) => {
        localServer.close((error) => error ? reject(error) : resolve());
      });
    }
  }
});

test("production checkout requires service authentication", async () => {
  const payload = {
    tenantId: "tenant-1",
    amountMinor: 1234,
    currency: "USD",
    referenceId: "sub-production-001",
    accountNo: "252611111111",
    description: "Test subscription",
    plan: "basic",
    durationMonths: 3,
  };

  const denied = await fetch(`${baseUrl}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(denied.status, 401);
});

test("unconfigured checkout reports missing variable names and confirms no provider request was sent", async () => {
  let localServer;

  try {
    localServer = createServer({
      env: {
        ...env,
        WAAFIPAY_API_KEY: "",
        WAAFIPAY_WEBHOOK_SECRET: "",
      },
      productionPurchase: async () => {
        throw new Error("Unconfigured checkout must not call WaafiPay");
      },
    });

    await new Promise((resolve, reject) => {
      localServer.once("error", reject);
      localServer.listen(0, "127.0.0.1", resolve);
    });

    const response = await fetch(
      `http://127.0.0.1:${localServer.address().port}/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: "tenant-1",
          amountMinor: 1234,
          currency: "USD",
          referenceId: "sub-not-configured",
          accountNo: "252611111111",
          plan: "basic",
          durationMonths: 1,
        }),
      },
    );
    const result = await response.json();

    assert.equal(response.status, 503);
    assert.equal(result.requestSent, false);
    assert.deepEqual(result.missingConfiguration, [
      "WAAFIPAY_API_KEY",
      "WAAFIPAY_WEBHOOK_SECRET",
    ]);
  } finally {
    if (localServer) {
      await new Promise((resolve, reject) => {
        localServer.close((error) => error ? reject(error) : resolve());
      });
    }
  }
});

test("confirmed provider success is persisted as succeeded", async () => {
  const payload = {
    tenantId: "tenant-1",
    amountMinor: 1234,
    currency: "USD",
    referenceId: "sub-manual-001",
    accountNo: "252611111111",
    description: "Test subscription",
    plan: "basic",
    durationMonths: 3,
  };

  const response = await fetch(`${baseUrl}/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 200);

  const result = await response.json();

  assert.equal(result.referenceId, payload.referenceId);
  assert.equal(result.outcome, "succeeded");
  assert.equal(result.verified, true);
  assert.equal(result.paymentStatus, "succeeded");
  assert.equal(result.responseCode, "2001");
  assert.equal(result.requestSent, true);
  assert.equal(result.requestPreview.payload.serviceParams.apiKey, "[REDACTED]");
  assert.equal(applied.at(-1).outcome, "succeeded");
});

test("provider rejection is persisted as failed without activating a subscription", async () => {
  let localServer;
  const appliedResults = [];

  try {
    localServer = createServer({
      env,
      productionStore: {
        begin: async (payment) => ({
          created: true,
          record: {
            reference_id: payment.referenceId,
            status: "pending",
          },
        }),
        applyResult: async (result) => {
          appliedResults.push(result);
          return { status: result.outcome };
        },
      },
      productionPurchase: async () => ({
        responseCode: "5306",
        state: "declined",
        outcome: "failed",
        transactionId: null,
      }),
    });

    await new Promise((resolve, reject) => {
      localServer.once("error", reject);
      localServer.listen(0, "127.0.0.1", resolve);
    });

    const checkoutUrl = `http://127.0.0.1:${localServer.address().port}/checkout`;
    const response = await fetch(checkoutUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId: "tenant-1",
        amountMinor: 1234,
        currency: "USD",
        referenceId: "sub-declined-001",
        accountNo: "252611111111",
        description: "Test subscription",
        plan: "basic",
        durationMonths: 3,
      }),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.paymentStatus, "failed");
    assert.equal(result.outcome, "failed");
    assert.equal(result.responseCode, "5306");
    assert.match(result.message, /no subscription was activated/i);
    assert.equal(appliedResults.at(-1).outcome, "failed");
  } finally {
    if (localServer) {
      await new Promise((resolve, reject) => {
        localServer.close((error) => error ? reject(error) : resolve());
      });
    }
  }
});

test("duplicate pending payment does not start another charge or automatic verification", async () => {
  let serverForTest;
  let purchaseCalls = 0;
  let verificationCalls = 0;

  try {
    serverForTest = createServer({
      env,
      productionStore: {
        begin: async () => ({
          created: false,
          record: {
            reference_id: "sub-existing-reference",
            tenant_id: "tenant-1",
            amount_minor: 1234,
            currency: "USD",
            plan: "basic",
            duration_months: 3,
            status: "pending",
          },
        }),
        applyResult: async ({ outcome }) => ({ status: outcome }),
        processWebhook: async () => {
          throw new Error("Webhook processing must remain disabled");
        },
      },
      productionPurchase: async () => {
        purchaseCalls += 1;
        throw new Error("A duplicate must not make a purchase call");
      },
      productionVerify: async () => {
        verificationCalls += 1;
        throw new Error("Automatic verification must remain disabled");
      },
    });

    await new Promise((resolve, reject) => {
      serverForTest.once("error", reject);
      serverForTest.listen(0, "127.0.0.1", resolve);
    });

    const baseForTest = `http://127.0.0.1:${serverForTest.address().port}`;

    const response = await fetch(`${baseForTest}/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId: "tenant-1",
        amountMinor: 999,
        currency: "USD",
        referenceId: "sub-new-reference",
        accountNo: "252611111111",
        description: "New subscription choice",
        plan: "pro",
        durationMonths: 1,
      }),
    });

    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.referenceId, "sub-existing-reference");
    assert.equal(result.outcome, "pending");
    assert.equal(result.plan, "basic");
    assert.equal(result.durationMonths, 3);
    assert.equal(purchaseCalls, 0);
    assert.equal(verificationCalls, 0);
  } finally {
    if (serverForTest) {
      await new Promise((resolve, reject) => {
        serverForTest.close((error) => error ? reject(error) : resolve());
      });
    }
  }
});

test("WaafiPay webhook requires a valid signature and records a confirmed approval", async () => {
  const rawBody = Buffer.from(JSON.stringify({
    event: "authorization",
    merchant_uid: env.WAAFIPAY_MERCHANT_UID,
    payment: {
      reference_id: "sub-webhook-approved",
      status: "APPROVED",
      transaction_id: "1303631",
      amount: 12.34,
      currency: "USD",
    },
  }));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const eventId = "event-approved-001";
  const signature = signWaafiWebhookForTest({
    secret: env.WAAFIPAY_WEBHOOK_SECRET,
    timestamp,
    eventId,
    rawBody,
  });
  const headers = {
    "Content-Type": "application/json",
    "x-webhook-timestamp": timestamp,
    "x-webhook-event-id": eventId,
    "x-webhook-signature-alg": "HMAC-SHA256",
    "x-webhook-signature": signature,
  };

  const denied = await fetch(`${baseUrl}/webhooks/waafipay`, {
    method: "POST",
    headers: { ...headers, "x-webhook-signature": "0".repeat(64) },
    body: rawBody,
  });

  assert.equal(denied.status, 401);
  assert.equal(processedWebhooks.length, 0);

  const response = await fetch(`${baseUrl}/webhooks/waafipay`, {
    method: "POST",
    headers,
    body: rawBody,
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.data.status, "succeeded");
  assert.deepEqual(processedWebhooks.at(-1), {
    event: "authorization",
    referenceId: "sub-webhook-approved",
    status: "APPROVED",
    transactionId: "1303631",
    amountMinor: 1234,
    currency: "USD",
    merchantUid: env.WAAFIPAY_MERCHANT_UID,
    eventId,
  });
});
