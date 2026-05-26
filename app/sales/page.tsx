"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { Sale } from "../../types";
import { apiGet } from "@/lib/apiClient";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const { dark } = useTheme();

  const { loading } = useRequireAuth();

  // ================= FETCH SALES =================
  useEffect(() => {
    const fetchSales = async () => {
      setSalesLoading(true);
      setError(null);

      try {
        const response = await apiGet<Sale[]>("/api/sales?limit=100");

        const mapped: Sale[] = (response.data || []).map((sale: any) => ({
          ...sale,
          productName:
            sale.product_name || sale.productName || "Unknown",
          date: sale.date || sale.created_at,
        }));

        setSales(mapped);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch sales"
        );
      } finally {
        setSalesLoading(false);
      }
    };

    // Prevent fetch before auth check finishes
    if (!loading) {
      fetchSales();
    }
  }, [loading]);

  // ================= SAFE DATE =================
  const getSaleDate = (sale: any): string | null => {
    const dateValue = sale.date || sale.created_at;

    if (!dateValue) return null;

    return dateValue;
  };

  // ================= FORMAT DATE =================
  const formatDate = (sale: any) => {
    const dateValue = getSaleDate(sale);

    if (!dateValue) return "No date";

    const d = new Date(dateValue);

    if (isNaN(d.getTime())) {
      return "Invalid date";
    }

    return d.toLocaleString("en-US", {
      timeZone: "Africa/Mogadishu",
    });
  };

  // ================= SORT SALES =================
  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => {
      const dateA = getSaleDate(a);
      const dateB = getSaleDate(b);

      const timeA = dateA
        ? new Date(dateA).getTime()
        : 0;

      const timeB = dateB
        ? new Date(dateB).getTime()
        : 0;

      return timeB - timeA;
    });
  }, [sales]);

  // ================= FILTER SALES =================
  const filteredSales = useMemo(() => {
    if (!filterDate) {
      return sortedSales;
    }

    return sortedSales.filter((s) => {
      const dateValue = getSaleDate(s);

      if (!dateValue) return false;

      const saleDay = new Date(dateValue)
        .toISOString()
        .slice(0, 10);

      return saleDay === filterDate;
    });
  }, [sortedSales, filterDate]);

  // ================= TOTAL REVENUE =================
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => acc + Number(sale.total || 0),
      0
    );
  }, [filteredSales]);

  // ================= DAILY SUMMARY =================
  const dailySummary = useMemo(() => {
    const map: Record<string, number> = {};

    sales.forEach((sale) => {
      const dateValue = getSaleDate(sale);

      if (!dateValue) return;

      const day = new Date(dateValue)
        .toISOString()
        .slice(0, 10);

      map[day] =
        (map[day] || 0) + Number(sale.total || 0);
    });

    return map;
  }, [sales]);

  // ================= CHART DATA =================
  const chartData = useMemo(() => {
    return Object.entries(dailySummary)
      .map(([date, total]) => ({
        date,
        total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailySummary]);

  // ================= THEME =================
  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  // ================= AUTH LOADING SCREEN =================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}
    >
      <Sidebar />

      <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center rounded-full bg-theme-input border border-theme px-4 py-2 text-sm text-theme-primary hover:bg-theme-card transition"
          >
            ← Back to Dashboard
          </Link>

          <div>
            <h2 className="text-3xl font-bold">
              Sales Dashboard
            </h2>

            <p className="text-theme-secondary mt-2">
              View and analyze sales data and revenue trends.
            </p>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-100 mb-6">
            {error}
          </div>
        )}

        {/* FILTER */}
        <div className="flex flex-wrap gap-4 items-center mb-6">
          <label className="text-sm text-theme-secondary">
            Filter by date:
          </label>

          <input
            type="date"
            className="bg-theme-input border border-theme px-3 py-2 rounded-2xl outline-none text-theme-primary focus:border-cyan-400"
            value={filterDate}
            onChange={(e) =>
              setFilterDate(e.target.value)
            }
          />

          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-sm text-red-400 hover:text-red-300 transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* TOTAL */}
        <div className="mb-6 rounded-2xl bg-theme-card border border-theme p-5 shadow-soft">
          <p className="text-sm text-theme-secondary mb-2">
            Total Revenue
          </p>

          <h3 className="text-3xl font-bold text-green-400">
            ${totalRevenue.toFixed(2)}
          </h3>
        </div>

        {/* TABLE */}
        <div className="bg-theme-card rounded-2xl overflow-auto mb-6 border border-theme shadow-soft">
          <table className="w-full min-w-175">
            <thead className="bg-theme-surface">
              <tr>
                <th className="p-4 text-left text-theme-secondary">Invoice</th>
                <th className="p-4 text-left text-theme-secondary">Customer</th>
                <th className="p-4 text-left text-theme-secondary">Product</th>
                <th className="p-4 text-left text-theme-secondary">Qty</th>
                <th className="p-4 text-left text-theme-secondary">Total</th>
                <th className="p-4 text-left text-theme-secondary">Date</th>
              </tr>
            </thead>

            <tbody>
              {salesLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-theme-secondary"
                  >
                    <div className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-theme border-opacity-30 border-t-cyan-500 animate-spin" />
                      Fetching sales...
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-theme-secondary"
                  >
                    No sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-t border-theme hover:bg-theme-surface-soft transition-colors duration-150"
                  >
                    <td className="p-4 text-sm text-theme-secondary">
                      {sale.order_id || "-"}
                    </td>
                    <td className="p-4">
                      {sale.customer_name || "Walk-in"}
                    </td>
                    <td className="p-4">
                      {sale.productName || "Unknown"}
                    </td>

                    <td className="p-4">
                      {sale.quantity}
                    </td>

                    <td className="p-4 text-green-400 font-medium">
                      $
                      {Number(
                        sale.total || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-4 text-sm text-theme-secondary">
                      {formatDate(sale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* DAILY SUMMARY */}
        <div className="bg-theme-card border border-theme p-5 rounded-2xl mb-6 shadow-soft">
          <h3 className="text-lg font-semibold mb-4">
            Daily Revenue
          </h3>

          {salesLoading ? (
            <p className="text-theme-secondary">
              Loading summary...
            </p>
          ) : Object.keys(dailySummary).length === 0 ? (
            <p className="text-theme-secondary">
              No data available
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(dailySummary)
                .sort((a, b) =>
                  b[0].localeCompare(a[0])
                )
                .map(([date, total]) => (
                  <li
                    key={date}
                    className="flex justify-between border-b border-slate-700/20 pb-2"
                  >
                    <span>{date}</span>

                    <span className="text-green-400 font-medium">
                      ${Number(total).toFixed(2)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* CHART */}
        <div className="bg-theme-card border border-theme p-5 rounded-2xl shadow-soft">
          <h3 className="text-lg font-semibold mb-4">
            Revenue Chart
          </h3>

          {salesLoading ? (
            <div className="h-72 flex items-center justify-center text-theme-secondary">
              Loading chart...
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart data={chartData}>
                  <XAxis dataKey="date" />

                  <YAxis />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="total"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}