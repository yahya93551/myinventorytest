import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalizeSaleRequest } from "./saleIdempotency";

const migration = readFileSync(fileURLToPath(new URL(
  "../supabase/migrations/20261003000000_add_sale_idempotency.sql",
  import.meta.url
)), "utf8");

describe("canonicalizeSaleRequest", () => {
  it("normalizes omitted defaults and surrounding whitespace", () => {
    const canonical = canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 2 }],
      customer_name: "  Customer  ",
    }, "user-1", "owner");

    expect(canonical).toEqual({
      user_id: "user-1",
      role: "owner",
      items: [{ product_id: "product-1", quantity: 2, unit: "base" }],
      order_id: null,
      customer_name: "Customer",
      customer_address: null,
      customer_phone: null,
      paid: true,
      type: "sale",
      refund_reason: null,
    });
  });

  it("keeps invoice references separate and detects material changes", () => {
    const original = canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 2 }],
      order_id: "INV-1",
    }, "user-1", "owner");
    const same = canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 2, unit: "base" }],
      order_id: "INV-1",
    }, "user-1", "owner");
    const changed = canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 3 }],
      order_id: "INV-1",
    }, "user-1", "owner");

    expect(same).toEqual(original);
    expect(changed).not.toEqual(original);
    expect("idempotency_key" in original).toBe(false);
    expect(canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 2 }],
      order_id: " INV-1 ",
    }, "user-1", "owner")).not.toEqual(original);
    expect(canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 2 }],
    }, "user-1", "owner", true).order_id).toBeNull();
  });

  it("preserves return semantics in the canonical request", () => {
    expect(canonicalizeSaleRequest({
      items: [{ product_id: "product-1", quantity: 1 }],
      type: "return",
      paid: false,
      refund_reason: "  damaged  ",
    }, "user-1", "sales")).toMatchObject({
      type: "return",
      paid: true,
      refund_reason: "damaged",
    });
  });

  it("treats null, empty, and whitespace refund reasons as the same persisted value", () => {
    const base = { items: [{ product_id: "product-1", quantity: 1 }], type: "return" as const };
    const withoutReason = canonicalizeSaleRequest(base, "user-1", "owner");

    expect(canonicalizeSaleRequest({ ...base, refund_reason: "" }, "user-1", "owner")).toEqual(withoutReason);
    expect(canonicalizeSaleRequest({ ...base, refund_reason: "   " }, "user-1", "owner")).toEqual(withoutReason);
    expect(canonicalizeSaleRequest({ ...base, refund_reason: " reason " }, "user-1", "owner").refund_reason).toBe("reason");
    expect(migration).toMatch(/v_refund_reason := NULLIF\(btrim\(p_refund_reason\), ''\)/);
    expect(migration).toMatch(/p_type,\s+v_refund_reason\s+\);/);
  });

  it("uses a tenant-scoped unique claim and stores the result transactionally", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/REVOKE ALL PRIVILEGES ON TABLE public\.sale_idempotency FROM anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL PRIVILEGES ON TABLE public\.sale_idempotency FROM PUBLIC, service_role/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*?sale_idempotency/i);
    expect(migration).toMatch(/PRIMARY KEY \(tenant_id, idempotency_key\)/);
    expect(migration).toMatch(/ON CONFLICT \(tenant_id, idempotency_key\) DO NOTHING/);
    expect(migration).toMatch(/FOR UPDATE/);
    expect(migration.indexOf("IF v_claimed = 0")).toBeLessThan(migration.indexOf("v_result := public.commit_sale_transaction_once"));
    expect(migration.indexOf("v_result := public.commit_sale_transaction_once")).toBeLessThan(migration.indexOf("SET result = COALESCE(v_result"));
    expect(migration).toMatch(/p_request_payload IS DISTINCT FROM v_expected_payload/);
    expect(migration).toMatch(/CASE WHEN p_order_id_is_generated THEN NULL ELSE p_order_id END/);
  });

  it("returns the stored result for a replay and rejects changed payloads", () => {
    expect(migration).toMatch(/v_existing_payload IS DISTINCT FROM v_request_payload/);
    expect(migration).toMatch(/SALE_IDEMPOTENCY_CONFLICT/);
    expect(migration).toMatch(/RETURN jsonb_build_object\('result', v_existing_result, 'replayed', true\)/);
  });
});