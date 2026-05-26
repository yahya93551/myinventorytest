// lib/search.ts - Full-text search and filtering
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("product_id, quantity")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString())
    .limit(1000);

  if (error) {
    throw new Error(`Failed to fetch trending products: ${error.message}`);
  }

  const totals = new Map<string, number>();
  for (const sale of data || []) {
    const productId = (sale as any).product_id as string;
    const quantity = Number((sale as any).quantity || 0);
    totals.set(productId, (totals.get(productId) || 0) + quantity);
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
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("name, price, stock")
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Failed to fetch product analytics: ${error.message}`);
  }

  if (!products || products.length === 0) {
    return {
      totalProducts: 0,
      totalValue: 0,
      averagePrice: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      mostStockedProduct: null,
      leastStockedProduct: null,
    };
  }

  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const averagePrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const sortedByStock = [...products].sort((a, b) => b.stock - a.stock);

  return {
    totalProducts: products.length,
    totalValue,
    averagePrice,
    lowStockCount,
    outOfStockCount,
    mostStockedProduct: sortedByStock[0]
      ? { name: sortedByStock[0].name, stock: sortedByStock[0].stock }
      : null,
    leastStockedProduct: sortedByStock[sortedByStock.length - 1]
      ? {
          name: sortedByStock[sortedByStock.length - 1].name,
          stock: sortedByStock[sortedByStock.length - 1].stock,
        }
      : null,
  };
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

export async function getSalesAnalytics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<SalesAnalytics> {
  const { data: sales, error } = await supabaseAdmin
    .from("sales")
    .select("product_name, quantity, total")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (error) {
    throw new Error(`Failed to fetch sales analytics: ${error.message}`);
  }

  if (!sales || sales.length === 0) {
    return {
      totalSales: 0,
      totalQuantity: 0,
      transactionCount: 0,
      averageOrderValue: 0,
      topProducts: [],
    };
  }

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalQuantity = sales.reduce((sum, s) => sum + s.quantity, 0);
  const averageOrderValue = totalSales / sales.length;

  // Group by product name to get top products
  const productMap = new Map<string, { quantity: number; total: number }>();
  for (const sale of sales) {
    const existing = productMap.get(sale.product_name) || { quantity: 0, total: 0 };
    productMap.set(sale.product_name, {
      quantity: existing.quantity + sale.quantity,
      total: existing.total + sale.total,
    });
  }

  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return {
    totalSales,
    totalQuantity,
    transactionCount: sales.length,
    averageOrderValue,
    topProducts,
  };
}
