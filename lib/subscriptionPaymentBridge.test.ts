import { describe, expect, it, vi } from "vitest";
import {
  fetchWaafiServiceReadiness,
  getExpectedWaafiEnvironment,
  isProductionCheckoutEnabled,
} from "./subscriptionPaymentBridge";

describe("WaafiPay subscription payment bridge", () => {
  it("enables checkout only in an explicitly enabled production runtime", () => {
    expect(isProductionCheckoutEnabled({})).toBe(false);
    expect(isProductionCheckoutEnabled({
      SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED: "true",
      NODE_ENV: "development",
    })).toBe(false);
    expect(isProductionCheckoutEnabled({
      SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED: "true",
      NODE_ENV: "production",
    })).toBe(true);
    expect(getExpectedWaafiEnvironment()).toBe("production");
  });

  it("accepts only production service readiness", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        status: "ready",
        provider: "waafipay",
        environment: "production",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));

    await expect(fetchWaafiServiceReadiness({
      SUBSCRIPTION_PAYMENT_SERVICE_URL: "https://subscription-service.example.test",
    }, fetcher)).resolves.toEqual({
      status: "ready",
      provider: "waafipay",
      environment: "production",
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://subscription-service.example.test/ready",
    );
  });

  it("rejects non-production readiness and non-secure public service URLs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        status: "ready",
        provider: "waafipay",
        environment: "sandbox",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));

    await expect(fetchWaafiServiceReadiness({
      SUBSCRIPTION_PAYMENT_SERVICE_URL: "https://subscription-service.example.test",
    }, fetcher)).rejects.toThrow(/unexpected readiness response/);
    await expect(fetchWaafiServiceReadiness({
      SUBSCRIPTION_PAYMENT_SERVICE_URL: "http://public.example.test",
    }, fetcher)).rejects.toThrow(/must use HTTPS/);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("allows local HTTP development URLs for readiness", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        status: "not_configured",
        provider: "waafipay",
        environment: "production",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ));

    await expect(fetchWaafiServiceReadiness({
      SUBSCRIPTION_PAYMENT_SERVICE_URL: "http://127.0.0.1:4100",
    }, fetcher)).resolves.toMatchObject({ status: "not_configured" });
  });
});
