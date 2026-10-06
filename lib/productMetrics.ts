import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProductMetricsFilter = "7d" | "30d" | "all";

export interface ProductMetric {
  product_id: string;
  product_name: string;
  stock_loaded: number;
  started: number | null;
  sold: number;
  returned: number;
  remaining: number;
  base_unit: string | null;
  converted_unit: string | null;
  conversion_rate: number | null;
  sold_unit_mode: "base" | "converted" | "mixed";
}

export async function getProductMetrics(
  tenantId: string,
  filter: ProductMetricsFilter,
  now: Date = new Date()
): Promise<ProductMetric[]> {
  let startDate: string;
  if (filter === "all") {
    startDate = "1970-01-01T00:00:00.000Z";
  } else {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (filter === "7d" ? 7 : 30));
    startDate = date.toISOString();
  }

  const { data, error } = await supabaseAdmin.rpc("get_product_metrics", {
    p_tenant_id: tenantId,
    p_start_date: startDate,
  });

  if (error) throw new Error(`Unable to load product metrics: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("Unable to load product metrics.");
  return (data as ProductMetric[]).sort(
    (a, b) => b.sold - a.sold || b.stock_loaded - a.stock_loaded || a.product_name.localeCompare(b.product_name)
  );
}