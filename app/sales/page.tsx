"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Sale } from "../../types";
import { supabase } from "@/lib/supabase";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [dark, setDark] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login");
      }
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from("sales").select("*");
        if (error) throw error;
        const mapped = (data || []).map((sale: any) => ({
          ...sale,
          productName: sale.product_name || sale.productName || "Unknown",
          date: sale.date || sale.created_at,
        }));
        setSales(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch sales");
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, []);

  // ================= SAFE DATE (supports both 'date' and 'created_at') =================
  const getSaleDate = (sale: any): string | null => {
    const dateValue = sale.date || sale.created_at;
    if (!dateValue) return null;
    return dateValue;
  };

  const formatDate = (sale: any) => {
    const dateValue = getSaleDate(sale);
    if (!dateValue) return "No date";

    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "Invalid date";

    // Somali time (East Africa Time, UTC+3)
    return d.toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' });
  };


  // ================= SORT (NEWEST FIRST) =================
  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => {
      const dateA = getSaleDate(a);
      const dateB = getSaleDate(b);
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      return timeB - timeA;
    });
  }, [sales]);

  // ================= FILTER =================
  const filteredSales = useMemo(() => {
    if (!filterDate) return sortedSales;

    return sortedSales.filter((s) => {
      const dateValue = getSaleDate(s);
      if (!dateValue) return false;
      const saleDay = new Date(dateValue).toISOString().slice(0, 10);
      return saleDay === filterDate;
    });
  }, [sortedSales, filterDate]);

  // ================= TOTAL REVENUE =================
  const totalRevenue = filteredSales.reduce((a, s) => a + s.total, 0);

  // ================= DAILY SUMMARY =================
  const dailySummary = useMemo(() => {
    const map: Record<string, number> = {};

    sales.forEach((s) => {
      const dateValue = getSaleDate(s);
      if (!dateValue) return;

      const day = new Date(dateValue).toISOString().slice(0, 10);
      map[day] = (map[day] || 0) + s.total;
    });

    return map;
  }, [sales]);

  // ================= CHART DATA =================
  const chartData = Object.entries(dailySummary)
    .map(([date, total]) => ({
      date,
      total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}>
      <Sidebar dark={dark} setDark={setDark} />
      <div className="flex-1 p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm text-cyan-400 hover:bg-slate-800"
          >
            ← Back to Dashboard
          </Link>
          <div>
            <h2 className="text-3xl font-bold">Sales Dashboard</h2>
            <p className="text-gray-400 mt-2">
              View and analyze sales data and revenue trends.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-100 mb-6">
            {error}
          </div>
        )}

        {/* FILTER */}
        <div className="flex gap-4 items-center mb-6">
          <label className="text-sm text-gray-300">Filter by date:</label>
          <input
            type="date"
            className="bg-white/10 p-2 rounded"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-sm text-red-400"
            >
              Clear
            </button>
          )}
        </div>

        {/* TOTAL */}
        <p className="text-xl mb-6">
          Total Revenue:{" "}
          <span className="text-green-400">${totalRevenue}</span>
        </p>

        {/* TABLE */}
        <div className="bg-white/10 rounded-2xl overflow-auto mb-6">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th className="text-left">Qty</th>
                <th className="text-left">Total</th>
                <th className="text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Fetching sales...
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400">
                    No sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="border-t border-white/10">
                    <td className="p-3">{s.productName || s.product_name || "Unknown"}</td>
                    <td>{s.quantity}</td>
                    <td>${s.total}</td>
                    <td>{formatDate(s)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* DAILY SUMMARY */}
        <div className="bg-white/5 p-4 rounded-2xl mb-6">
          <h3 className="text-lg mb-3">Daily Revenue</h3>
          {loading ? (
            <p className="text-gray-400">Loading summary...</p>
          ) : Object.keys(dailySummary).length === 0 ? (
            <p className="text-gray-400">No data</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(dailySummary)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, total]) => (
                  <li key={date} className="flex justify-between">
                    <span>{date}</span>
                    <span className="text-green-400">${total}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* CHART */}
        <div className="bg-white/5 p-4 rounded-2xl max-w-full">
          <h3 className="text-lg mb-3">Revenue Chart</h3>
          {loading ? (
            <div className="h-72 flex items-center justify-center text-gray-400">
              Loading chart...
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}