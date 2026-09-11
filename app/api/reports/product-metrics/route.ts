import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireActiveSubscription, jsonError, jsonSuccess } from "@/lib/api";
import { parseMissingSalesColumns } from "@/lib/salesFallback";
import { getInitialStockFromLog, getProductIdFromLog, getStockLoadedAmountFromLog } from "@/lib/reportMetrics";
import { convertSaleQuantityToBaseUnits } from "@/lib/productUnitConversion";

const ProductMetricsQuerySchema = z.object({
  filter: z.enum(["7d", "30d", "all"]).optional().default("30d"),
});

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subscriptionCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subscriptionCheck) {
    return jsonError(subscriptionCheck.error, subscriptionCheck.status);
  }

  const url = new URL(req.url);
  const parseResult = ProductMetricsQuerySchema.safeParse({
    filter: url.searchParams.get("filter"),
  });

  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { filter } = parseResult.data;
  let startDate: string | null = null;

  if (filter !== "all") {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (filter === "7d" ? 7 : 30));
    startDate = date.toISOString();
  }

  const [{ data: products, error: productsError }, { data: stockLogs, error: stockLogsError }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, stock, stock_remainder, base_unit, converted_unit, conversion_rate")
      .eq("tenant_id", tenantContext.tenantId),
    supabaseAdmin
      .from("activity_logs")
      .select("entity_id, action, details")
      .eq("tenant_id", tenantContext.tenantId)
      .gte(startDate ? "created_at" : "created_at", startDate || "1970-01-01T00:00:00.000Z"),
  ]);

  if (productsError) {
    return jsonError(productsError.message, 500);
  }
  if (stockLogsError) {
    return jsonError(stockLogsError.message, 500);
  }

  let sales: any[] = [];
  let salesError: any = null;
  const baseSalesQuery = supabaseAdmin
    .from("sales")
    .select("product_id, quantity, type, unit, quantity_unit")
    .eq("tenant_id", tenantContext.tenantId)
    .gte(startDate ? "created_at" : "created_at", startDate || "1970-01-01T00:00:00.000Z");

  const salesResult = await baseSalesQuery;
  if (salesResult.error) {
    const missingColumns = parseMissingSalesColumns(salesResult.error);
    if (missingColumns.includes("type")) {
      const fallbackResult = await supabaseAdmin
        .from("sales")
        .select("product_id, quantity")
        .eq("tenant_id", tenantContext.tenantId)
        .gte(startDate ? "created_at" : "created_at", startDate || "1970-01-01T00:00:00.000Z");

      if (fallbackResult.error) {
        salesError = fallbackResult.error;
      } else {
        sales = (fallbackResult.data || []).map((record: any) => ({ ...record, type: "sale" }));
      }
    } else {
      salesError = salesResult.error;
    }
  } else {
    sales = salesResult.data || [];
  }

  if (salesError) {
    return jsonError(salesError.message, 500);
  }

  const productById = new Map((products || []).map((product: any) => [product.id, product]));

  const loadedByProduct = (stockLogs || []).reduce<Record<string, number>>((acc, record: any) => {
    const productId = getProductIdFromLog(record);
    if (!productId) return acc;

    const amount = getStockLoadedAmountFromLog(record);
    if (!amount || amount <= 0) return acc;

    acc[productId] = (acc[productId] || 0) + amount;
    return acc;
  }, {});

  const startedByProduct = (stockLogs || []).reduce<Record<string, number>>((acc, record: any) => {
    const productId = getProductIdFromLog(record);
    if (!productId) return acc;

    const initialStock = getInitialStockFromLog(record);
    if (initialStock === null) return acc;

    // Use the first creation-time stock as the true starting point.
    // Later restocks and sales should not overwrite the original inserted quantity.
    if (!Object.prototype.hasOwnProperty.call(acc, productId) || acc[productId] === 0) {
      acc[productId] = initialStock;
    }

    return acc;
  }, {});

  const soldByProduct = (sales || []).reduce<Record<string, number>>((acc, record: any) => {
    if (!record?.product_id) return acc;
    const saleType = (record.type || "sale").toString().toLowerCase();
    if (saleType === "return") return acc;

    const product = productById.get(record.product_id);
    const unitMode = (record.unit || "base").toString().toLowerCase();
    const quantity = Number(record.quantity || 0);
    const normalizedQuantity = unitMode === "converted" && product
      ? convertSaleQuantityToBaseUnits(quantity, product, "converted").quantity
      : quantity;

    acc[record.product_id] = (acc[record.product_id] || 0) + normalizedQuantity;
    return acc;
  }, {});

  const soldUnitModesByProduct = (sales || []).reduce<Record<string, Set<string>>>((acc, record: any) => {
    if (!record?.product_id || (record.type || "sale").toString().toLowerCase() === "return") return acc;
    const mode = (record.unit || "base").toString().toLowerCase() === "converted" ? "converted" : "base";
    acc[record.product_id] ||= new Set<string>();
    acc[record.product_id].add(mode);
    return acc;
  }, {});

  const returnedByProduct = (sales || []).reduce<Record<string, number>>((acc, record: any) => {
    if (!record?.product_id) return acc;
    const saleType = (record.type || "sale").toString().toLowerCase();
    if (saleType !== "return") return acc;

    const product = productById.get(record.product_id);
    const unitMode = (record.unit || "base").toString().toLowerCase();
    const quantity = Number(record.quantity || 0);
    const normalizedQuantity = unitMode === "converted" && product
      ? convertSaleQuantityToBaseUnits(quantity, product, "converted").quantity
      : quantity;

    acc[record.product_id] = (acc[record.product_id] || 0) + normalizedQuantity;
    return acc;
  }, {});

  const metrics = (products || []).map((product: any) => {
    const conversionRate = typeof product.conversion_rate === "number" && Number.isFinite(product.conversion_rate) && product.conversion_rate > 0
      ? product.conversion_rate
      : null;
    const stock = typeof product.stock === "number" ? product.stock : 0;
    const stockRemainder = typeof product.stock_remainder === "number" ? product.stock_remainder : 0;
    const remaining = conversionRate ? stock + stockRemainder / conversionRate : stock;
    const sold = soldByProduct[product.id] || 0;
    const returned = returnedByProduct[product.id] || 0;
    const loaded = loadedByProduct[product.id] || 0;
    const soldUnitModes = soldUnitModesByProduct[product.id];
    const sold_unit_mode = soldUnitModes?.size === 1
      ? Array.from(soldUnitModes)[0]
      : soldUnitModes?.size ? "mixed" : "base";

    return {
      product_id: product.id,
      product_name: product.name || "Unknown",
      stock_loaded: loaded,
      started: startedByProduct[product.id] ?? null,
      sold,
      returned,
      remaining,
      base_unit: product.base_unit ?? null,
      converted_unit: product.converted_unit ?? null,
      conversion_rate: conversionRate,
      sold_unit_mode,
    };
  })
    .sort((a, b) => b.sold - a.sold || b.stock_loaded - a.stock_loaded || a.product_name.localeCompare(b.product_name));

  return jsonSuccess(metrics);
}
