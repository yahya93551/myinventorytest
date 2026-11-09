type Environment = Record<string, string | undefined>;

export interface WaafiServiceReadiness {
  status: "ready" | "not_configured";
  provider: "waafipay";
  environment: "production";
}

export function isProductionCheckoutEnabled(env: Environment = process.env): boolean {
  return env.SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED === "true"
    && env.NODE_ENV === "production";
}

export function isWaafiCheckoutEnabled(env: Environment = process.env): boolean {
  return isProductionCheckoutEnabled(env);
}

export function getExpectedWaafiEnvironment(): "production" {
  return "production";
}

export function getWaafiServiceEndpoint(env: Environment, endpoint: "ready" | "checkout"): URL {
  const serviceUrl = env.SUBSCRIPTION_PAYMENT_SERVICE_URL?.trim();
  if (!serviceUrl) {
    throw new Error("SUBSCRIPTION_PAYMENT_SERVICE_URL is required when WaafiPay is enabled");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(serviceUrl);
  } catch {
    throw new Error("SUBSCRIPTION_PAYMENT_SERVICE_URL must be a valid URL");
  }

  const isLoopbackHttp = baseUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);
  if (baseUrl.protocol !== "https:" && !isLoopbackHttp) {
    throw new Error("The subscription payment service URL must use HTTPS, except for local loopback development");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("The subscription payment service URL must not include credentials, query parameters, or a fragment");
  }

  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/${endpoint}`;
  return baseUrl;
}

function isWaafiReadiness(value: unknown): value is WaafiServiceReadiness {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (result.status === "ready" || result.status === "not_configured")
    && result.provider === "waafipay"
    && result.environment === "production";
}

export async function fetchWaafiServiceReadiness(
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<WaafiServiceReadiness> {
  const readinessUrl = getWaafiServiceEndpoint(env, "ready");
  const response = await fetcher(readinessUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Subscription payment service returned an invalid readiness response");
  }

  if (!isWaafiReadiness(result)) {
    throw new Error("Subscription payment service returned an unexpected readiness response");
  }

  if (!response.ok && response.status !== 503) {
    throw new Error(`Subscription payment service readiness request failed with status ${response.status}`);
  }

  return result;
}
