// lib/search.ts - Full-text search and filtering
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ANALYTICS_PAGE_SIZE = 500;

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  inStock?: boolean; // If true, only show products with stock > 0
}

/**
 * Search products with full-text search and filters
 * Uses Supabase FTS for scalable text search
 */
export async function searchProducts(
  tenantId: string,
  query: string,
  filters: SearchFilters = {},
  limit: number = 50
) {
  let dbQuery = supabaseAdmin
    .from("products")
    .select("id, name, category, price, stock, notes")
    .eq("tenant_id", tenantId)
    .limit(limit);

  // Full-text search on name and notes
  if (query.trim()) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,notes.ilike.%${query}%`);
  }

  // Apply filters
  if (filters.category) {
    dbQuery = dbQuery.eq("category", filters.category);
  }

  if (filters.minPrice !== undefined) {
    dbQuery = dbQuery.gte("price", filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    dbQuery = dbQuery.lte("price", filters.maxPrice);
  }

  if (filters.minStock !== undefined) {
    dbQuery = dbQuery.gte("stock", filters.minStock);
  }

  if (filters.maxStock !== undefined) {
    dbQuery = dbQuery.lte("stock", filters.maxStock);
  }

  if (filters.inStock === true) {
    dbQuery = dbQuery.gt("stock", 0);
  }

  const { data, error } = await dbQuery.order("name", { ascending: true });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Get trending/top products for dashboard
 */
export async function getTrendingProducts(tenantId: string, days: number = 7, limit: number = 10) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const totals = new Map<string, number>();
  let cursor: { created_at: string; id: string } | null = null;

  while (true) {
    let query = supabaseAdmin
      .from("sales")
      .select("product_id, quantity, created_at, id")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(ANALYTICS_PAGE_SIZE);

    if (cursor) {
      query = query.or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch trending products: ${error.message}`);
    }

    const rows = data || [];
    for (const sale of rows) {
      const productId = (sale as any).product_id as string;
      const quantity = Number((sale as any).quantity || 0);
      totals.set(productId, (totals.get(productId) || 0) + quantity);
    }

    if (rows.length < ANALYTICS_PAGE_SIZE) break;
    const last = rows[rows.length - 1] as any;
    cursor = { created_at: last.created_at, id: last.id };
  }

  return Array.from(totals.entries())
    .map(([product_id, total_sold]) => ({ product_id, total_sold }))
    .sort((a, b) => b.total_sold - a.total_sold)
    .slice(0, limit);
}

/**
 * Advanced product analytics
 */
export interface ProductAnalytics {
  totalProducts: number;
  totalValue: number;
  averagePrice: number;
  lowStockCount: number;
  outOfStockCount: number;
  mostStockedProduct: { name: string; stock: number } | null;
  leastStockedProduct: { name: string; stock: number } | null;
}

export async function getProductAnalytics(tenantId: string): Promise<ProductAnalytics> {
  const { data, error } = await supabaseAdmin.rpc("get_product_analytics", {
    p_tenant_id: tenantId,
  });

  if (error) throw new Error(`Failed to fetch product analytics: ${error.message}`);
  return data as ProductAnalytics;
}

/**
 * Sales analytics for time periods
 */
export interface SalesAnalytics {
  totalSales: number;
  totalQuantity: number;
  transactionCount: number;
  averageOrderValue: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
}

const MAX_SALES_ANALYTICS_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export function resolveSalesAnalyticsDateRange(
  startDate?: string,
  endDate?: string,
  now: Date = new Date()
): { start: Date; end: Date } {
  const start = startDate ? new Date(startDate) : new Date(now);
  if (!startDate) start.setDate(start.getDate() - 30);
  const end = endDate ? new Date(endDate) : new Date(now);

  if (start.getTime() > end.getTime()) {
    throw new RangeError("Start date must be before or equal to end date");
  }
  if (end.getTime() - start.getTime() > MAX_SALES_ANALYTICS_RANGE_MS) {
    throw new RangeError("Sales analytics date range cannot exceed 366 days");
  }

  return { start, end };
}

export async function getSalesAnalytics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<SalesAnalytics> {
  const { data, error } = await supabaseAdmin.rpc("get_sales_analytics", {
    p_tenant_id: tenantId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) throw new Error(`Failed to fetch sales analytics: ${error.message}`);
  return data as SalesAnalytics;
}
