//app/components/Dashboard.tsx
"use client";
import Link from "next/link";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useInventory } from "../hooks/useInventory";
import { useBusinessSettings, useCustomFields } from "../hooks/useCustomFields";
import StatsCards from "./StatsCards";
import { getVisibleSystemFieldNames } from "@/lib/customFields";

export default function Dashboard() {
  // 🔥 Directly use the live hook – always up‑to-date
  const { products, sales, ownerMetrics, categories } = useInventory();
  const customFieldsQuery = useCustomFields();
  const businessSettingsQuery = useBusinessSettings();
  const businessType = businessSettingsQuery.data?.business_type;
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

  const salesChartData = Object.entries(
    sales.reduce((acc, sale) => {
      const date = getSaleDate(sale);
      if (!date) return acc;

      const key = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const amount = Number(sale.total || 0);
      const value = (sale.type ?? "sale") === "return" ? -amount : amount;

      acc[key] = (acc[key] || 0) + value;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, total]) => ({ date, total }));

  const now = new Date();
  const salesOverview = sales.reduce(
    (summary, sale) => {
      const saleDate = getSaleDate(sale);
      const saleType = sale.type ?? "sale";
      const amount = Number(sale.total || 0);
      const value = saleType === "return" ? -amount : amount;
      const isSaleTransaction = saleType !== "return";

      summary.netRevenue += value;
      if (isSaleTransaction) {
        summary.totalSales += 1;
      }

      if (saleDate) {
        if (saleDate.getFullYear() === now.getFullYear() && saleDate.getMonth() === now.getMonth()) {
          summary.salesThisMonth += 1;
          summary.monthlyRevenue += value;
        }
      }

      return summary;
    },
    { totalSales: 0, netRevenue: 0, salesThisMonth: 0, monthlyRevenue: 0 }
  );

  const averageSaleValue = salesOverview.totalSales > 0 ? salesOverview.netRevenue / salesOverview.totalSales : 0;

  const revenueByProduct = sales.reduce((map, sale) => {
    const name = getProductName(sale);
    const saleType = sale.type ?? "sale";
    const amount = Number(sale.total || 0);
    const value = saleType === "return" ? -amount : amount;
    const current = map[name] || { productName: name, revenue: 0, quantity: 0, returns: 0 };

    current.revenue += value;
    current.quantity += saleType === "return" ? -Number(sale.quantity || 0) : Number(sale.quantity || 0);
    if (saleType === "return") {
      current.returns += Number(sale.quantity || 0);
    }

    map[name] = current;
    return map;
  }, {} as Record<string, { productName: string; revenue: number; quantity: number; returns: number }>);

  const topRevenueProduct = Object.values(revenueByProduct).sort((a, b) => b.revenue - a.revenue)[0];
  const topProductShare = topRevenueProduct && salesOverview.netRevenue > 0
    ? (topRevenueProduct.revenue / salesOverview.netRevenue) * 100
    : 0;
  const topProductInsight = topRevenueProduct
    ? `${topRevenueProduct.productName} is your top revenue driver at ${formatShortNumber(topRevenueProduct.revenue)}${topProductShare > 0 ? `, ${topProductShare.toFixed(0)}% of revenue` : ''}`
    : "No top product insight yet. Record sales to get performance guidance.";

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
        businessType={businessType}
      />

      <div className="card-standard">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-h3 font-semibold text-theme-primary">Sales Overview</h3>
            <p className="text-sm text-theme-secondary mt-1">Key revenue trends and product momentum.</p>
          </div>
          <div className="badge-primary">Live results</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card-compact bg-theme-surface">
            <p className="text-body-sm text-theme-secondary">Net Revenue</p>
            <p className="text-h4 font-bold text-cyan-400 mt-2">{formatShortNumber(salesOverview.netRevenue)}</p>
          </div>
          <div className="card-compact bg-theme-surface">
            <p className="text-body-sm text-theme-secondary">Total Sales</p>
            <p className="text-h4 font-bold text-theme-primary mt-2">{salesOverview.totalSales}</p>
          </div>
          <div className="card-compact bg-theme-surface">
            <p className="text-body-sm text-theme-secondary">Average Sale</p>
            <p className="text-h4 font-bold text-green-400 mt-2">{formatShortNumber(averageSaleValue)}</p>
          </div>
          <div className="card-compact bg-theme-surface">
            <p className="text-body-sm text-theme-secondary">Sales This Month</p>
            <p className="text-h4 font-bold text-theme-primary mt-2">{salesOverview.salesThisMonth}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-theme-surface bg-theme-surface p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold text-theme-secondary mb-2">Revenue Trend</p>
              <h4 className="text-base font-semibold text-theme-primary">Recent sales trend</h4>
            </div>
            <div className="text-xs text-theme-secondary">{salesChartData.length} points</div>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChartData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgb(148 163 184)", fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "rgb(148 163 184)", fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.96)",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    borderRadius: 16,
                    color: "#f8fafc",
                  }}
                  labelStyle={{ color: "#f8fafc" }}
                />
                <Line type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={3} dot={{ r: 3, fill: "#22d3ee" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-theme-surface p-5 bg-theme-surface">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-theme-secondary mb-2">Top Product Insight</p>
          <p className="text-body text-theme-primary leading-relaxed">{topProductInsight}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        {/* Cash Flow Section */}
        <div className="card-standard">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h3 className="text-h3 font-semibold text-theme-primary">Cash Flow</h3>
              <p className="text-sm text-theme-secondary mt-1">Snapshot of inventory value and profit capacity.</p>
            </div>
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