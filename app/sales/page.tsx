"use client";

import { useMemo, useState } from "react";
import { Sale, LoadingState } from "../../types";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type SalesPageProps = {
  sales: Sale[];
  loading: LoadingState;
};

export default function SalesPage({ sales, loading }: SalesPageProps) {
  const [filterDate, setFilterDate] = useState("");

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

    return d.toLocaleString();
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

  return (
    <div className="p-6 text-white space-y-6">
      {/* TITLE */}
      <h2 className="text-3xl font-bold">Sales Dashboard</h2>

      {loading.error && (
        <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-100">
          {loading.error}
        </div>
      )}

      {/* FILTER */}
      <div className="flex gap-4 items-center">
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
      <p className="text-xl">
        Total Revenue:{" "}
        <span className="text-green-400">${totalRevenue}</span>
      </p>

      {/* TABLE */}
      <div className="bg-white/10 rounded-2xl overflow-auto">
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
            {loading.isLoading ? (
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
                  <td className="p-3">{s.productName || s.productName}</td>
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
      <div className="bg-white/5 p-4 rounded-2xl">
        <h3 className="text-lg mb-3">Daily Revenue</h3>
        {loading.isLoading ? (
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
        {loading.isLoading ? (
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
  );
}