
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyProductionResult,
  beginProductionPayment,
} from "./production-payment-store.mjs";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-service-role-key",
  WAAFIPAY_MERCHANT_UID: "M400394",
};

const payment = {
  tenantId: "tenant-1",
  referenceId: "sub-payment-001",
  amountMinor: 1234,
  currency: "USD",
  plan: "basic",
  durationMonths: 3,
};

test("creates a durable pending payment using the server-only Supabase credential", async () => {
  let request;

  const result = await beginProductionPayment({
    env,
    payment,
    fetcher: async (url, options) => {
      request = { url: String(url), options };

      return new Response(
        JSON.stringify([
          {
            reference_id: payment.referenceId,
            status: "pending",
          },
        ]),
        { status: 201 },
      );
    },
  });

  assert.equal(result.created, true);

  assert.equal(
    request.url,
    "https://example.supabase.co/rest/v1/waafipay_subscription_payments",
  );

  assert.equal(
    request.options.headers.get("apikey"),
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  assert.equal(
    request.options.headers.get("authorization"),
    `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  );

  assert.deepEqual(JSON.parse(request.options.body), {
    tenant_id: payment.tenantId,
    reference_id: payment.referenceId,
    amount_minor: payment.amountMinor,
    currency: payment.currency,
    plan: payment.plan,
    duration_months: payment.durationMonths,
    status: "pending",
    merchant_uid: env.WAAFIPAY_MERCHANT_UID,
  });
});

test("returns an existing same-reference payment without creating another charge", async () => {
  let calls = 0;

  const result = await beginProductionPayment({
    env,
    payment,
    fetcher: async (url) => {
      calls += 1;

      if (calls === 1) {
        return new Response(
          JSON.stringify({ code: "23505" }),
          { status: 409 },
        );
      }

      const parsedUrl = new URL(String(url));

      assert.equal(
        parsedUrl.searchParams.get("reference_id"),
        `eq.${payment.referenceId}`,
      );

      return new Response(
        JSON.stringify([
          {
            reference_id: payment.referenceId,
            tenant_id: payment.tenantId,
            amount_minor: payment.amountMinor,
            currency: payment.currency,
            plan: payment.plan,
            duration_months: payment.durationMonths,
            status: "pending",
          },
        ]),
        { status: 200 },
      );
    },
  });

  assert.equal(result.created, false);
  assert.equal(result.record.status, "pending");
  assert.equal(calls, 2);
});

test("recovers a different unresolved tenant attempt instead of creating a second reference", async () => {
  let calls = 0;

  const result = await beginProductionPayment({
    env,
    payment: {
      ...payment,
      referenceId: "sub-new-reference",
    },
    fetcher: async (url) => {
      calls += 1;

      if (calls === 1) {
        return new Response(
          JSON.stringify({ code: "23505" }),
          { status: 409 },
        );
      }

      if (calls === 2) {
        return new Response("[]", { status: 200 });
      }

      const parsedUrl = new URL(String(url));

      assert.equal(
        parsedUrl.searchParams.get("tenant_id"),
        `eq.${payment.tenantId}`,
      );

      return new Response(
        JSON.stringify([
          {
            reference_id: payment.referenceId,
            tenant_id: payment.tenantId,
            amount_minor: payment.amountMinor,
            currency: payment.currency,
            plan: payment.plan,
            duration_months: payment.durationMonths,
            status: "pending",
          },
        ]),
        { status: 200 },
      );
    },
  });

  assert.equal(result.created, false);
  assert.equal(result.restored, true);
  assert.equal(result.record.reference_id, payment.referenceId);
  assert.equal(calls, 3);
});

test("rejects automatic successful payment approval", async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      applyProductionResult({
        env,
        referenceId: payment.referenceId,
        outcome: "succeeded",
        providerState: "approved",
        transactionId: "1303630",
        fetcher: async () => {
          calls += 1;
          return new Response("{}", { status: 200 });
        },
      }),
    /Only pending payment updates are permitted/,
  );

  assert.equal(calls, 0);
});

test("allows pending payment updates through the restricted Supabase RPC", async () => {
  let request;

  const result = await applyProductionResult({
    env,
    referenceId: payment.referenceId,
    outcome: "pending",
    providerState: "processing",
    transactionId: null,
    fetcher: async (url, options) => {
      request = {
        url: String(url),
        body: JSON.parse(options.body),
      };

      return new Response(
        JSON.stringify({ status: "pending" }),
        { status: 200 },
      );
    },
  });

  assert.equal(
    request.url,
    "https://example.supabase.co/rest/v1/rpc/apply_waafipay_verified_result",
  );

  assert.deepEqual(request.body, {
    p_reference_id: payment.referenceId,
    p_outcome: "pending",
    p_provider_state: "processing",
    p_provider_transaction_id: null,
  });

  assert.deepEqual(result, { status: "pending" });
});
