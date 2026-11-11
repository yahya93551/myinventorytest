
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyProductionResult,
  beginProductionPayment,
  processProductionWebhook,
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

test("persists pending and terminal provider outcomes through the restricted Supabase RPC", async () => {
  for (const outcome of ["pending", "succeeded", "failed"]) {
    let request;

    const result = await applyProductionResult({
      env,
      referenceId: payment.referenceId,
      outcome,
      providerState: outcome === "pending" ? "processing" : outcome,
      transactionId: outcome === "succeeded" ? "1303630" : null,
      fetcher: async (url, options) => {
        request = {
          url: String(url),
          body: JSON.parse(options.body),
        };

        return new Response(
          JSON.stringify({ status: outcome }),
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
      p_outcome: outcome,
      p_provider_state: outcome === "pending" ? "processing" : outcome,
      p_provider_transaction_id: outcome === "succeeded" ? "1303630" : null,
    });

    assert.deepEqual(result, { status: outcome });
  }
});

test("records signed provider webhook outcomes through the webhook RPC", async () => {
  let request;

  const result = await processProductionWebhook({
    env,
    eventId: "event-approved-001",
    event: "authorization",
    referenceId: payment.referenceId,
    status: "APPROVED",
    transactionId: "1303630",
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    merchantUid: "M400394",
    fetcher: async (url, options) => {
      request = {
        url: String(url),
        body: JSON.parse(options.body),
      };

      return new Response(
        JSON.stringify({ status: "succeeded", duplicate: false }),
        { status: 200 },
      );
    },
  });

  assert.equal(
    request.url,
    "https://example.supabase.co/rest/v1/rpc/process_waafipay_subscription_webhook",
  );
  assert.deepEqual(request.body, {
    p_event_id: "event-approved-001",
    p_event: "authorization",
    p_reference_id: payment.referenceId,
    p_status: "APPROVED",
    p_provider_transaction_id: "1303630",
    p_amount_minor: payment.amountMinor,
    p_currency: payment.currency,
    p_merchant_uid: "M400394",
  });
  assert.deepEqual(result, { status: "succeeded", duplicate: false });
});
