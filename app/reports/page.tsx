"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/apiClient";
import { Sale } from "../../types";
import Sidebar from "@/components/Sidebar";
import SalesRouteGuard from "@/components/SalesRouteGuard";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";
import { jsPDF } from "jspdf";

import {
  Download,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Star,
} from "lucide-react";

export default function ReportsPage() {
  const { loading } = useRequireAuth();
  const { dark } = useTheme();

  const [sales, setSales] = useState<Array<Sale & { user_email?: string; user_id?: string }>>([]);
  const [filter, setFilter] = useState<"7d" | "30d" | "all">("all");
  const [loadingSales, setLoadingSales] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ================= LOAD SALES =================
  useEffect(() => {
    const loadSales = async () => {
      setLoadingSales(true);
      setError(null);

      try {
        const response = await apiGet<Sale[]>("/api/sales?limit=100");

        const mapped: Sale[] = (response.data || []).map(
          (sale: any) => ({
            ...sale,
            productName:
              sale.product_name ||
              sale.productName ||
              "Unknown",
            date:
              sale.date || sale.created_at,
          })
        );

        setSales(mapped);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load reports"
        );

        setSales([]);
      } finally {
        setLoadingSales(false);
      }
    };

    // Wait until auth finishes
    if (!loading) {
      loadSales();
    }
  }, [loading]);

  // ================= SAFE DATE =================
  const getSaleDate = (
    sale: any
  ): Date | null => {
    const dateValue =
      sale.date || sale.created_at;

    if (!dateValue) return null;

    const d = new Date(dateValue);

    return isNaN(d.getTime()) ? null : d;
  };

  // ================= FILTER SALES =================
  const filteredSales = useMemo(() => {
    const now = new Date();

    return sales.filter((sale) => {
      const saleDate = getSaleDate(sale);

      if (!saleDate) return false;

      if (filter === "all") return true;

      const diffDays =
        (now.getTime() -
          saleDate.getTime()) /
        (1000 * 60 * 60 * 24);

      if (filter === "7d") {
        return diffDays <= 7;
      }

      if (filter === "30d") {
        return diffDays <= 30;
      }

      return true;
    });
  }, [sales, filter]);

  // ================= TOTAL REVENUE =================
  const revenue = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0
    );
  }, [filteredSales]);

  // ================= ORDERS =================
  const orders = filteredSales.length;

  // ================= AVERAGE =================
  const average = useMemo(() => {
    if (!orders) return "0.00";

    return (
      revenue / orders
    ).toFixed(2);
  }, [revenue, orders]);

  // ================= LATEST SALE =================
  const latestSale = useMemo(() => {
    if (filteredSales.length === 0) {
      return "No sales yet";
    }

    const latest = filteredSales[0];

    const saleDate = getSaleDate(latest);

    return saleDate
      ? saleDate.toLocaleString(
          "en-US",
          {
            timeZone:
              "Africa/Mogadishu",
          }
        )
      : "Invalid date";
  }, [filteredSales]);

  // ================= TOP PRODUCT =================
  const topProduct = useMemo(() => {
    const map: Record<string, number> =
      {};

    filteredSales.forEach((sale) => {
      const name =
        sale.productName || "Unknown";

      map[name] =
        (map[name] || 0) +
        Number(sale.quantity || 0);
    });

    return (
      Object.entries(map).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || "No sales"
    );
  }, [filteredSales]);

  // ================= PER USER =================
  const perUser = useMemo(() => {
    const map: Record<string, number> = {};

    filteredSales.forEach((sale: any) => {
      const user = sale.user_email || sale.user_id || "unknown";

      map[user] = (map[user] || 0) + Number(sale.total || 0);
    });

    return map;
  }, [filteredSales]);

  // ================= PER PRODUCT =================
  const perProduct = useMemo(() => {
    const map: Record<string, number> =
      {};

    filteredSales.forEach((sale) => {
      const name =
        sale.productName || "Unknown";

      map[name] =
        (map[name] || 0) +
        Number(sale.quantity || 0);
    });

    return map;
  }, [filteredSales]);

  // ================= DOWNLOAD PDF =================
  const downloadPdf = () => {
    const doc = new jsPDF({
      unit: "pt",
      format: "letter",
    });

    const margin = 40;
    const lineHeight = 18;

    let y = 60;

    doc.setFontSize(20);
    doc.text("Sales Report", margin, y);

    y += lineHeight * 2;

    doc.setFontSize(11);

    doc.text("Product", margin, y);
    doc.text("Qty", margin + 260, y);
    doc.text("Total", margin + 340, y);
    doc.text("Date", margin + 420, y);

    y += lineHeight;

    filteredSales.forEach((sale) => {
      const saleDate =
        getSaleDate(sale);

      if (y > 740) {
        doc.addPage();
        y = 60;
      }

      doc.text(
        sale.productName || "Unknown",
        margin,
        y,
        {
          maxWidth: 200,
        }
      );

      doc.text(
        String(sale.quantity ?? ""),
        margin + 260,
        y
      );

      doc.text(
        `$${Number(
          sale.total || 0
        ).toFixed(2)}`,
        margin + 340,
        y
      );

      doc.text(
        saleDate
          ? saleDate.toLocaleString(
              "en-US",
              {
                timeZone:
                  "Africa/Mogadishu",
              }
            )
          : "No date",
        margin + 420,
        y,
        {
          maxWidth: 180,
        }
      );

      y += lineHeight;
    });

    doc.save("sales-report.pdf");
  };

  // ================= THEME =================
  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  // ================= AUTH LOADING =================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-surface text-theme-primary">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded-full border-2 border-theme border-opacity-30 border-t-cyan-500 animate-spin" />
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}
    >
      <SalesRouteGuard />
      <Sidebar />

      <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
        <div className="mx-auto max-w-7xl">
          {/* HEADER */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Link
                  href="/"
                  className="rounded-full bg-theme-input border border-theme px-3 py-1 text-sm text-theme-primary hover:bg-theme-card transition"
                >
                  ← Back to Dashboard
                </Link>
              </div>

              <h2 className="text-3xl font-semibold">
                Reports
              </h2>

              <p className="text-theme-secondary mt-2">
                Latest sale: {latestSale}
              </p>

              {/* FILTERS */}
              <div className="flex flex-wrap gap-2 mt-4 items-center">
                <button
                  onClick={() =>
                    setFilter("7d")
                  }
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    filter === "7d"
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-theme-input text-theme-secondary"
                  }`}
                >
                  7D
                </button>

                <button
                  onClick={() =>
                    setFilter("30d")
                  }
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    filter === "30d"
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-theme-input text-theme-secondary"
                  }`}
                >
                  30D
                </button>

                <button
                  onClick={() =>
                    setFilter("all")
                  }
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    filter === "all"
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-theme-input text-theme-secondary"
                  }`}
                >
                  ALL
                </button>

                <button
                  onClick={() => setFilter("all")}
                  className="ml-auto rounded-full border border-theme px-4 py-2 text-sm font-semibold text-theme-primary hover:bg-theme-card transition"
                >
                  View all
                </button>
              </div>
            </div>

            {/* DOWNLOAD */}
            <button
              onClick={downloadPdf}
              className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 flex items-center gap-2 hover:opacity-90 transition"
            >
              <Download size={20} />
              Download PDF
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-100">
              {error}
            </div>
          )}

          {/* LOADING */}
          {loadingSales && (
            <div className="mb-6 rounded-2xl bg-theme-card p-4 text-theme-secondary">
              Loading sales report...
            </div>
          )}

          {/* STATS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-3xl bg-theme-card p-6 border border-theme flex gap-4">
              <DollarSign className="text-green-400" />

              <div>
                <p>Total Revenue</p>

                <p className="text-2xl font-bold">
                  ${revenue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-theme-card p-6 border border-theme flex gap-4">
              <ShoppingBag className="text-blue-400" />

              <div>
                <p>Orders</p>

                <p className="text-2xl font-bold">
                  {orders}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-theme-card p-6 border border-theme flex gap-4">
              <TrendingUp className="text-purple-400" />

              <div>
                <p>Average</p>

                <p className="text-2xl font-bold">
                  ${average}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-theme-card p-6 border border-theme flex gap-4">
              <Star className="text-yellow-400" />

              <div>
                <p>Top Product</p>

                <p className="text-lg font-bold">
                  {topProduct}
                </p>
              </div>
            </div>
          </div>

          {/* PER USER */}
          <div className="bg-theme-card p-6 rounded-2xl mb-6 border border-theme">
            <h3 className="mb-4 text-lg font-semibold">
              Revenue per User
            </h3>

            {Object.entries(perUser).map(
              ([user, total], index) => (
                <div
                  key={`${user}-${index}`}
                  className="flex justify-between py-2 border-b border-theme"
                >
                  <span className="truncate">
                    {user}
                  </span>

                  <span className="text-green-400">
                    $
                    {Number(total).toFixed(
                      2
                    )}
                  </span>
                </div>
              )
            )}
          </div>

          {/* PER PRODUCT */}
          <div className="bg-theme-card p-6 rounded-2xl mb-6 border border-theme">
            <h3 className="mb-4 text-lg font-semibold">
              Sales per Product
            </h3>

            {Object.entries(perProduct).map(
              ([product, qty], index) => (
                <div
                  key={`${product}-${index}`}
                  className="flex justify-between py-2 border-b border-theme"
                >
                  <span>{product}</span>

                  <span>{qty} pcs</span>
                </div>
              )
            )}
          </div>

          {/* TABLE */}
          <div className="bg-theme-card p-6 rounded-2xl border border-theme overflow-auto">
            <h3 className="mb-4 text-lg font-semibold">
              Recent Sales
            </h3>

            <table className="w-full min-w-175 text-left">
              <thead className="text-theme-secondary">
                <tr>
                  <th className="pb-3">
                    Product
                  </th>

                  <th className="pb-3">
                    Qty
                  </th>

                  <th className="pb-3">
                    Total
                  </th>

                  <th className="pb-3">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-theme-muted"
                    >
                      No sales recorded yet
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(
                    (sale) => {
                      const saleDate =
                        getSaleDate(
                          sale
                        );

                      return (
                        <tr
                          key={sale.id}
                          className="border-t border-theme"
                        >
                          <td className="py-3">
                            {sale.productName ||
                              "Unknown"}
                          </td>

                          <td className="py-3">
                            {
                              sale.quantity
                            }
                          </td>

                          <td className="py-3 text-green-400">
                            $
                            {Number(
                              sale.total ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td className="py-3 text-sm text-theme-secondary">
                            {saleDate
                              ? saleDate.toLocaleString(
                                  "en-US",
                                  {
                                    timeZone:
                                      "Africa/Mogadishu",
                                  }
                                )
                              : "No date"}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
