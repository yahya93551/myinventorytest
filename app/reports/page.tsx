"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sale } from "../../types";
import * as XLSX from "xlsx";
import {
  Download,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  Star,
} from "lucide-react";

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState<"7d" | "30d" | "all">("all");

  // Load sales from Supabase
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("sales").select("*");
      // Map field names to match what the component expects
      const mapped = (data || []).map((sale: any) => ({
        ...sale,
        // Ensure we have a consistent product name field
        productName: sale.product_name || sale.productName,
        // Ensure date is available (prefer 'date', fallback to 'created_at')
        date: sale.date || sale.created_at,
      }));
      setSales(mapped);
    };

    load();
  }, []);

  // Helper to get a valid date object from a sale
  const getSaleDate = (sale: any): Date | null => {
    const dateValue = sale.date || sale.created_at;
    if (!dateValue) return null;
    const d = new Date(dateValue);
    return isNaN(d.getTime()) ? null : d;
  };

  // Date filtering
  const filteredSales = useMemo(() => {
    const now = new Date();

    return sales.filter((sale) => {
      const saleDate = getSaleDate(sale);
      if (!saleDate) return false; // skip sales with no valid date

      if (filter === "all") return true;

      const diffDays =
        (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24);

      if (filter === "7d") return diffDays <= 7;
      if (filter === "30d") return diffDays <= 30;

      return true;
    });
  }, [sales, filter]);

  // Revenue
  const revenue = useMemo(
    () => filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    [filteredSales]
  );

  const orders = filteredSales.length;
  const average = orders ? (revenue / orders).toFixed(2) : "0.00";

  // Latest sale date (formatted safely)
  const latestSale = useMemo(() => {
    if (filteredSales.length === 0) return "No sales yet";
    const latest = filteredSales[0];
    const saleDate = getSaleDate(latest);
    return saleDate ? saleDate.toLocaleString() : "Invalid date";
  }, [filteredSales]);

  // Top product
  const topProduct = useMemo(() => {
    const map: Record<string, number> = {};

    filteredSales.forEach((s) => {
      const name = s.productName || s.productName || "Unknown";
      map[name] = (map[name] || 0) + s.quantity;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "No sales";
  }, [filteredSales]);

  // Per user
  const perUser = useMemo(() => {
    const map: Record<string, number> = {};

    filteredSales.forEach((s: any) => {
      const user = s.user_id || "unknown";
      map[user] = (map[user] || 0) + Number(s.total || 0);
    });

    return map;
  }, [filteredSales]);

  // Per product
  const perProduct = useMemo(() => {
    const map: Record<string, number> = {};

    filteredSales.forEach((s) => {
      const name = s.productName || s.productName || "Unknown";
      map[name] = (map[name] || 0) + s.quantity;
    });

    return map;
  }, [filteredSales]);

  // Excel export (uses the original raw date for sorting, but displays formatted)
  const downloadExcel = () => {
    const data = filteredSales.map((sale) => {
      const saleDate = getSaleDate(sale);
      return {
        "Sale ID": sale.id,
        Product: sale.productName || sale.productName || "Unknown",
        Quantity: sale.quantity,
        Total: Number(sale.total || 0),
        Date: saleDate ? saleDate.toLocaleString() : "No date",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    XLSX.writeFile(workbook, "sales-report.xlsx");
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">Reports</h2>
            {/* FILTER BUTTONS */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setFilter("7d")}
                className="px-2 py-1 text-xs bg-slate-800 rounded"
              >
                7D
              </button>
              <button
                onClick={() => setFilter("30d")}
                className="px-2 py-1 text-xs bg-slate-800 rounded"
              >
                30D
              </button>
              <button
                onClick={() => setFilter("all")}
                className="px-2 py-1 text-xs bg-slate-800 rounded"
              >
                ALL
              </button>
            </div>
          </div>

          {/* EXPORT BUTTON */}
          <button
            onClick={downloadExcel}
            className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 flex items-center gap-2"
          >
            <Download size={20} />
            Download Excel
          </button>
        </div>

        {/* STATS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 flex gap-4">
            <DollarSign className="text-green-400" />
            <div>
              <p>Total Revenue</p>
              <p className="text-2xl">${revenue}</p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 flex gap-4">
            <ShoppingBag className="text-blue-400" />
            <div>
              <p>Orders</p>
              <p className="text-2xl">{orders}</p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 flex gap-4">
            <TrendingUp className="text-purple-400" />
            <div>
              <p>Average</p>
              <p className="text-2xl">${average}</p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 flex gap-4">
            <Star className="text-yellow-400" />
            <div>
              <p>Top Product</p>
              <p className="text-xl">{topProduct}</p>
            </div>
          </div>
        </div>

        {/* PER USER */}
        <div className="bg-slate-900 p-6 rounded-2xl mb-6 border border-slate-800">
          <h3 className="mb-3">Revenue per User</h3>
          {Object.entries(perUser).map(([user, total]) => (
            <div
              key={user}
              className="flex justify-between py-1 border-b border-slate-800"
            >
              <span>{user}</span>
              <span>${total}</span>
            </div>
          ))}
        </div>

        {/* PER PRODUCT */}
        <div className="bg-slate-900 p-6 rounded-2xl mb-6 border border-slate-800">
          <h3 className="mb-3">Sales per Product</h3>
          {Object.entries(perProduct).map(([product, qty]) => (
            <div
              key={product}
              className="flex justify-between py-1 border-b border-slate-800"
            >
              <span>{product}</span>
              <span>{qty} pcs</span>
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <h3 className="mb-4">Recent Sales</h3>
          <table className="w-full text-left">
            <thead className="text-slate-400">
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No sales recorded yet
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const saleDate = getSaleDate(sale);
                  return (
                    <tr key={sale.id} className="border-t border-slate-800">
                      <td>{sale.productName || sale.productName || "Unknown"}</td>
                      <td>{sale.quantity}</td>
                      <td>${Number(sale.total || 0)}</td>
                      <td>{saleDate ? saleDate.toLocaleString() : "No date"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}