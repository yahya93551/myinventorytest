//app/components/Dashboard.tsx
"use client";
import Link from "next/link";
import { useInventory } from "../hooks/useInventory";
import { useCustomFields } from "../hooks/useCustomFields";
import StatsCards from "./StatsCards";
import { getVisibleSystemFieldNames } from "@/lib/customFields";

export default function Dashboard() {
  // 🔥 Directly use the live hook – always up‑to-date
  const { products, sales, ownerMetrics, categories } = useInventory();
  const customFieldsQuery = useCustomFields();
  const customFields = customFieldsQuery.data || [];
  const visibleSystemFieldNames = getVisibleSystemFieldNames(customFields);
  const costPriceVisible = visibleSystemFieldNames.includes("cost_price");
  const priceVisible = visibleSystemFieldNames.includes("price");
  const profitVisible = costPriceVisible && priceVisible;

  // Helper: safely extract a valid Date object from a sale (handles both 'date' and 'created_at')
  const getSaleDate = (sale: any): Date | null => {
    const raw = sale.date || sale.created_at;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  // Helper: get display product name (handles both 'productName' and 'product_name')
  const getProductName = (sale: any): string => {
    return sale.productName || sale.product_name || "Unknown";
  };

  const total = products.length;
  const totalCost = products.reduce((a, p) => a + (p.cost_price ?? 0) * p.stock, 0);
  const totalSellValue = products.reduce((a, p) => a + p.price * p.stock, 0);
  const totalProfit = Math.max(0, totalSellValue - totalCost);
  const categoryCount = categories.length > 0 ? categories.length : new Set(products.map((p) => p.category)).size;

  // Last sale date – safely
  let lastSaleDate = "No sales yet";
  if (sales.length > 0) {
    const lastDate = getSaleDate(sales[0]);
    lastSaleDate = lastDate ? lastDate.toLocaleDateString() : "Invalid date";
  }

  const topProducts = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);

  const formatShortNumber = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000000) return `$${(value / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
    if (abs >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `$${value.toFixed(0)}`;
  };

  const formatShortDate = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="page-section">
      <div className="section-header flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-h1 text-theme-primary">Dashboard</h2>
          <p className="text-body-sm text-theme-secondary mt-2">
            Inventory overview, cash flow, and report summaries.
          </p>
        </div>

        <div className="card-compact flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0 self-start max-w-[18rem] p-3">
          <div>
            <p className="text-xs text-theme-secondary">Total Categories</p>
            <p className="text-h4 font-bold text-cyan-400 mt-1">{categoryCount}</p>
          </div>
          <div className="h-10 w-px bg-theme-surface" />
        </div>
      </div>

      <StatsCards
        products={products}
        visibleFieldNames={visibleSystemFieldNames}
        ownerMetrics={ownerMetrics ?? undefined}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cash Flow Section */}
        <div className="card-standard">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-h3 font-semibold text-theme-primary">Cash Flow</h3>
            <div className="badge-primary">Overview</div>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {costPriceVisible && (
              <div className="card-compact bg-theme-surface">
                <p className="text-body-sm text-theme-secondary">Total Cost Value</p>
                <p className="text-h4 font-bold text-theme-primary mt-2">${totalCost.toFixed(2)}</p>
              </div>
            )}
            {priceVisible && (
              <div className="card-compact bg-theme-surface">
                <p className="text-body-sm text-theme-secondary">Inventory Sell Value</p>
                <p className="text-h4 font-bold text-cyan-400 mt-2">${totalSellValue.toFixed(2)}</p>
              </div>
            )}
            {profitVisible && (
              <div className="card-compact bg-theme-surface">
                <p className="text-body-sm text-theme-secondary">Potential Profit</p>
                <p className="text-h4 font-bold text-green-400 mt-2">${totalProfit.toFixed(2)}</p>
              </div>
            )}
            <div className="card-compact bg-theme-surface">
              <p className="text-body-sm text-theme-secondary">Last Sale</p>
              <p className="text-h4 font-bold text-theme-primary mt-2">{lastSaleDate}</p>
            </div>
          </div>
        </div>

        {/* Recent Reports Section */}
        <div className="card-standard">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-h3 font-semibold text-theme-primary">Recent Sales</h3>
            <div className="badge-neutral">Latest {Math.min(5, sales.length)}</div>
          </div>
          
          {sales.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-theme-secondary">No sales recorded yet</p>
              <p className="text-theme-muted text-sm mt-1">Sales will appear here once recorded</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sales.slice(0, 5).map((sale) => {
                const saleDate = getSaleDate(sale);
                return (
                  <div key={sale.id} className="card-compact bg-theme-surface hover:bg-theme-card transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-theme-primary truncate">
                          {getProductName(sale)}
                        </p>
                        <p className="text-xs text-theme-secondary mt-1">
                          {sale.quantity} units
                        </p>
                      </div>
                      <div className="text-right min-w-24">
                        <p className="text-base font-bold text-cyan-400" title={`$${Number(sale.total).toFixed(2)}`}>
                          {formatShortNumber(Number(sale.total) || 0)}
                        </p>
                        <p className="text-xs text-theme-muted mt-1">
                          {saleDate ? formatShortDate(saleDate) : "No date"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-theme">
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-semibold"
            >
              View all sales →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}