//app/components/Dashboard.tsx
"use client";
import Link from "next/link";
import { useInventory } from "../hooks/useInventory";
import { useCustomFields } from "../hooks/useCustomFields";
import StatsCards from "./StatsCards";
import { getVisibleSystemFieldNames } from "@/lib/customFields";

export default function Dashboard() {
  // 🔥 Directly use the live hook – always up‑to-date
  const { products, sales } = useInventory();
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
  const categoryCount = new Set(products.map((p) => p.category)).size;

  // Last sale date – safely
  let lastSaleDate = "No sales yet";
  if (sales.length > 0) {
    const lastDate = getSaleDate(sales[0]);
    lastSaleDate = lastDate ? lastDate.toLocaleDateString() : "Invalid date";
  }

  const topProducts = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Dashboard</h2>
          <p className="text-theme-secondary mt-2">
            Inventory overview, cash flow, and report summaries.
          </p>
        </div>

        <div className="rounded-2xl border border-theme bg-theme-card/95 px-6 py-4 text-black shadow-card">
          <p className="text-sm text-theme-secondary">Categories</p>
          <p className="text-2xl font-bold">{categoryCount}</p>
        </div>
      </div>

      <StatsCards products={products} visibleFieldNames={visibleSystemFieldNames} />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-theme bg-theme-card/90 p-6 shadow-card">
          <h3 className="text-xl font-semibold mb-4">Cash Flow</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {costPriceVisible && (
              <div className="rounded-2xl border border-theme bg-theme-card p-4">
                <p className="text-sm text-theme-secondary">Total Cost Value</p>
                <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
              </div>
            )}
            {priceVisible && (
              <div className="rounded-2xl border border-theme bg-theme-card p-4">
                <p className="text-sm text-theme-secondary">Inventory Sell Value</p>
                <p className="text-2xl font-bold">${totalSellValue.toFixed(2)}</p>
              </div>
            )}
            {profitVisible && (
              <div className="rounded-2xl border border-theme bg-theme-card p-4">
                <p className="text-sm text-theme-secondary">Potential Profit</p>
                <p className="text-2xl font-bold">${totalProfit.toFixed(2)}</p>
              </div>
            )}
            <div className="rounded-2xl border border-theme bg-theme-card p-4">
              <p className="text-sm text-theme-secondary">Last Sale</p>
              <p className="text-2xl font-bold">{lastSaleDate}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-theme bg-theme-card/90 p-6 shadow-card">
          <h3 className="text-xl font-semibold mb-4">Report</h3>
          {sales.length === 0 ? (
            <p className="text-theme-secondary">No sales have been recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {sales.slice(0, 5).map((sale) => {
                const saleDate = getSaleDate(sale);
                return (
                  <div key={sale.id} className="rounded-2xl border border-theme bg-theme-card p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{getProductName(sale)}</p>
                        <p className="text-sm text-theme-secondary">
                          {sale.quantity} units
                        </p>
                      </div>
                      <p className="text-lg font-bold">${sale.total}</p>
                    </div>
                    <p className="text-sm text-theme-secondary mt-2">
                      {saleDate ? saleDate.toLocaleString() : "No date"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-right">
            <Link
              href="/reports"
              className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition"
            >
              View all
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}