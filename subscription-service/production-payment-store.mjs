
function getSupabaseRestUrl(env) {
  const rawUrl = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !serviceKey) {
    throw new Error("Production payment database is not configured");
  }

  let baseUrl;

  try {
    baseUrl = new URL(rawUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL");
  }

  const localHttp = baseUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);

  if (baseUrl.protocol !== "https:" && !localHttp) {
    throw new Error("SUPABASE_URL must use HTTPS except for local development");
  }

  if (
    baseUrl.username
    || baseUrl.password
    || baseUrl.search
    || baseUrl.hash
  ) {
    throw new Error("SUPABASE_URL must not contain credentials, query parameters, or a fragment");
  }

  return { baseUrl, serviceKey };
}

async function databaseRequest({
  env,
  path,
  method = "GET",
  body,
  prefer,
  fetcher = fetch,
}) {
  const { baseUrl, serviceKey } = getSupabaseRestUrl(env);
  const url = new URL(`/rest/v1/${path}`, baseUrl);

  const headers = new Headers({
    Accept: "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  });

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (prefer) {
    headers.set("Prefer", prefer);
  }

  const response = await fetcher(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  const responseText = await response.text();
  let result = null;

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error("Payment database returned an invalid response");
    }
  }

  if (!response.ok) {
    const error = new Error("Payment database request failed");
    error.status = response.status;
    error.code = result?.code;
    throw error;
  }

  return result;
}

function samePayment(record, payment) {
  return record
    && record.tenant_id === payment.tenantId
    && record.amount_minor === payment.amountMinor
    && record.currency === payment.currency
    && record.plan === payment.plan
    && record.duration_months === payment.durationMonths;
}

async function getPaymentByReference({ env, referenceId, fetcher }) {
  const query = new URLSearchParams({
    select: "reference_id,tenant_id,amount_minor,currency,plan,duration_months,status,provider_state,provider_transaction_id",
    reference_id: `eq.${referenceId}`,
    limit: "1",
  });

  const rows = await databaseRequest({
    env,
    path: `waafipay_subscription_payments?${query}`,
    fetcher,
  });

  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function getPendingPaymentByTenant({ env, tenantId, fetcher }) {
  const query = new URLSearchParams({
    select: "reference_id,tenant_id,amount_minor,currency,plan,duration_months,status,provider_state,provider_transaction_id",
    tenant_id: `eq.${tenantId}`,
    status: "eq.pending",
    limit: "1",
  });

  const rows = await databaseRequest({
    env,
    path: `waafipay_subscription_payments?${query}`,
    fetcher,
  });

  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function beginProductionPayment({
  env = process.env,
  payment,
  fetcher = fetch,
}) {
  try {
    const rows = await databaseRequest({
      env,
      path: "waafipay_subscription_payments",
      method: "POST",
      prefer: "return=representation",
      body: {
        tenant_id: payment.tenantId,
        reference_id: payment.referenceId,
        amount_minor: payment.amountMinor,
        currency: payment.currency,
        plan: payment.plan,
        duration_months: payment.durationMonths,
        status: "pending",
        merchant_uid: env.WAAFIPAY_MERCHANT_UID,
      },
      fetcher,
    });

    if (!Array.isArray(rows) || !rows[0]) {
      throw new Error("Payment database did not create a payment record");
    }

    return { record: rows[0], created: true };
  } catch (error) {
    if (error?.status !== 409) {
      throw error;
    }

    const record = await getPaymentByReference({
      env,
      referenceId: payment.referenceId,
      fetcher,
    });

    if (record) {
      if (!samePayment(record, payment)) {
        throw Object.assign(
          new Error("Payment reference is already used for different payment details"),
          { status: 409 },
        );
      }

      return { record, created: false };
    }

    const pendingRecord = await getPendingPaymentByTenant({
      env,
      tenantId: payment.tenantId,
      fetcher,
    });

    if (pendingRecord) {
      return {
        record: pendingRecord,
        created: false,
        restored: true,
      };
    }

    throw Object.assign(
      new Error("Another payment for this account is still pending; reconcile it before retrying"),
      { status: 409 },
    );
  }
}

export async function applyProductionResult({
  env = process.env,
  referenceId,
  outcome,
  providerState,
  transactionId,
  fetcher = fetch,
}) {
  if (outcome !== "pending") {
    throw new Error(
      "Only pending payment updates are permitted. Manual approval is required.",
    );
  }

  return databaseRequest({
    env,
    path: "rpc/apply_waafipay_verified_result",
    method: "POST",
    body: {
      p_reference_id: referenceId,
      p_outcome: "pending",
      p_provider_state: providerState,
      p_provider_transaction_id: transactionId,
    },
    fetcher,
  });
}
