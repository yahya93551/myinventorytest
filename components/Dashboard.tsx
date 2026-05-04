//app/components/Dashboard.tsx
import { useInventory } from "../hooks/useInventory";
import StatsCards from "./StatsCards";

export default function Dashboard() {
  // 🔥 Directly use the live hook – always up‑to‑date
  const { products, sales } = useInventory();

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
  const value = products.reduce((a, p) => a + p.price * p.stock, 0);
  const low = products.filter((p) => p.stock < 10 && p.stock > 0).length;
  const out = products.filter((p) => p.stock === 0).length;
  const categoryCount = new Set(products.map((p) => p.category)).size;
  const revenue = sales.reduce((acc, sale) => acc + sale.total, 0);
  const orders = sales.length;
  const averageSale = orders ? (revenue / orders).toFixed(2) : "0.00";

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
          <p className="text-gray-400 mt-2">
            Inventory overview, cash flow, and report summaries.
          </p>
        </div>

        <div className="rounded-3xl bg-white/10 px-6 py-4 text-white shadow-lg shadow-black/10">
          <p className="text-sm text-gray-300">Categories</p>
          <p className="text-2xl font-bold">{categoryCount}</p>
        </div>
      </div>

      <StatsCards products={products} />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl bg-white/10 p-6 shadow-lg shadow-black/10">
          <h3 className="text-xl font-semibold mb-4">Cash Flow</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-sm text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold">${revenue}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-sm text-gray-400">Orders</p>
              <p className="text-2xl font-bold">{orders}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-sm text-gray-400">Average Sale</p>
              <p className="text-2xl font-bold">${averageSale}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-sm text-gray-400">Last Sale</p>
              <p className="text-2xl font-bold">{lastSaleDate}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/10 p-6 shadow-lg shadow-black/10">
          <h3 className="text-xl font-semibold mb-4">Report</h3>
          {sales.length === 0 ? (
            <p className="text-gray-300">No sales have been recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {sales.slice(0, 5).map((sale) => {
                const saleDate = getSaleDate(sale);
                return (
                  <div key={sale.id} className="rounded-2xl bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{getProductName(sale)}</p>
                        <p className="text-sm text-gray-400">
                          {sale.quantity} units
                        </p>
                      </div>
                      <p className="text-lg font-bold">${sale.total}</p>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {saleDate ? saleDate.toLocaleString() : "No date"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}