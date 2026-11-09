"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { Sale, Product } from "../../types";
import { apiGet, apiPost } from "@/lib/apiClient";
import ReturnModal from "../inventory/components/ReturnModal";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useBusinessSettings } from "@/hooks/useCustomFields";
import { useTheme } from "@/lib/theme-context";
import { generateReceiptHtml, printReceiptHtml } from "@/lib/receipt";
import { mapSaleRecord } from "@/lib/apiMappers";
import { createSaleIdempotencyKey } from "@/lib/saleIdempotency";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [returnItem, setReturnItem] = useState<Product | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [returnAmount, setReturnAmount] = useState<number | "">(1);
  const [returnReason, setReturnReason] = useState("");
  const [returnStatus, setReturnStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const pendingReturnKey = useRef<{ signature: string; key: string } | null>(null);
  const { dark } = useTheme();
  const { data: tenantRoleData, isLoading: tenantRoleLoading } = useTenantRole();
  const { data: businessSettings } = useBusinessSettings();

  const { loading } = useRequireAuth();

  const showBackToDashboard =
    !tenantRoleLoading && tenantRoleData?.role !== "sales";

  useEffect(() => {
    if (!returnStatus) return;

    const timeoutId = window.setTimeout(() => {
      setReturnStatus(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [returnStatus]);

  // ================= FETCH SALES =================
  useEffect(() => {
    const fetchSales = async () => {
      setSalesLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (filterDate) params.set("date", filterDate);

        const response = await apiGet<Sale[]>(`/api/sales?${params.toString()}`);

        const mapped = (response.data || []).map((sale: any) => {
          const normalized = mapSaleRecord(sale) as any;
          return {
            ...normalized,
            productName: normalized.productName || normalized.product_name || "Unknown",
            date: normalized.date || normalized.createdAt || normalized.created_at,
          } as Sale;
        });

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
  }, [loading, searchQuery, filterDate]);

  // Debounce search input -> update `searchQuery` after short delay
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ================= SAFE DATE =================
  const getSaleDate = (sale: any): string | null => {
    const dateValue = sale.date || sale.createdAt || sale.created_at;

    if (!dateValue) return null;

    return dateValue;
  };

  const getSaleProductId = (sale: any) => sale?.productId || sale?.product_id;
  const getSaleProductName = (sale: any) => sale?.productName || sale?.product_name || "Unknown";
  const getSaleCustomerName = (sale: any) => sale?.customerName || sale?.customer_name || "Customer not available";
  const getSaleInvoiceNumber = (sale: any) => sale?.orderId || sale?.order_id || "No sale record";
  const getSaleCreatedAt = (sale: any) => sale?.createdAt || sale?.created_at || sale?.date;
  const getSignedSaleTotal = (sale: any) => {
    const value = Number(sale?.total || 0);
    return (sale?.type ?? "sale") === "return" ? -Math.abs(value) : Math.abs(value);
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

  const getRemainingReturnQuantity = (sale: Sale) => {
    const saleOrderId = getSaleInvoiceNumber(sale);
    const saleProductId = getSaleProductId(sale);
    const saleCustomerName = getSaleCustomerName(sale);

    let soldQty = 0;
    let returnedQty = 0;

    for (const candidate of sales) {
      const candidateOrderId = getSaleInvoiceNumber(candidate);
      const candidateProductId = getSaleProductId(candidate);
      const candidateCustomerName = getSaleCustomerName(candidate);
      const sameInvoice = !saleOrderId || !candidateOrderId || candidateOrderId === saleOrderId;
      const sameProduct = candidateProductId === saleProductId || getSaleProductName(candidate) === getSaleProductName(sale);
      const sameCustomer = !saleCustomerName || !candidateCustomerName || candidateCustomerName === saleCustomerName;

      if (!sameInvoice || !sameProduct || !sameCustomer) {
        continue;
      }

      const quantity = Number(candidate.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      if ((candidate.type ?? "sale") === "return") {
        returnedQty += quantity;
      } else {
        soldQty += quantity;
      }
    }

    return Math.max(0, soldQty - returnedQty);
  };

  const getQuantityLabel = (sale: Sale) => {
    const quantity = Number(sale.quantity ?? 0);
    const explicitUnit = sale.quantityUnit || sale.quantity_unit;

    if (sale.unit === "converted") {
      return `${quantity} ${explicitUnit || "converted"}`;
    }

    if (explicitUnit) {
      return `${quantity} ${explicitUnit}`;
    }

    return String(quantity);
  };

  const handlePrintSale = (sale: Sale) => {
    if (typeof window === "undefined") return;

    const saleDate = formatDate(sale);
    const quantity = Number(sale.quantity || 0);
    const totalValue = Number(sale.total || 0);
    const total = totalValue.toFixed(2);
    const unitPrice = quantity > 0 ? totalValue / quantity : 0;
    const quantityLabel = getQuantityLabel(sale);

    const businessName = businessSettings?.business_name?.trim() || "Business";
    const businessAddress = businessSettings?.business_address?.trim() || "";
    const businessContact =
      businessSettings?.business_contact_phone?.trim() ||
      businessSettings?.business_contact_email?.trim() ||
      "";

    const receiptHtml = generateReceiptHtml(
      {
        businessName,
        businessAddress,
        businessContact,
        invoiceNumber: sale.orderId || sale.order_id || "-",
        date: saleDate,
        customerName: sale.customerName || sale.customer_name || "Walk-in Customer",
        customerPhone: sale.customerPhone || sale.customer_phone || "-",
        title: "Sale Invoice",
      },
      [
        {
          description: sale.productName || "Unknown",
          quantity,
          unitPrice,
          total: Number(total),
        },
      ]
    );

    printReceiptHtml(receiptHtml);
  };

  const handleReturnSale = (sale: Sale) => {
    pendingReturnKey.current = null;
    const productId = getSaleProductId(sale) || "";
    const productName = getSaleProductName(sale) || "Product";

    setReturnSale(sale);
    setReturnItem({
      id: productId || `temp-${sale.id}`,
      name: productName,
      category: "",
      cost_price: 0,
      price: Number(sale.total || 0),
      stock: 0,
      image_url: undefined,
      user_id: undefined,
      custom_data: {},
      base_unit: sale.quantityUnit || sale.quantity_unit || "unit",
      converted_unit: undefined,
      conversion_rate: undefined,
      stock_remainder: 0,
      createdAt: getSaleCreatedAt(sale) || sale.date || sale.createdAt,
      updatedAt: getSaleCreatedAt(sale) || sale.date || sale.createdAt,
    } as Product);
    setReturnAmount(1);
    setReturnReason("");
    setReturnStatus(null);
  };

  const saveReturn = async () => {
    if (!returnItem) return;

    const quantity = typeof returnAmount === "number" ? returnAmount : Number(returnAmount);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setReturnStatus({ type: "error", text: "Please enter a valid return quantity above 0." });
      return;
    }

    const saleForReturn = returnSale ?? sales.find((sale) => {
      const saleProductId = getSaleProductId(sale);
      return saleProductId === returnItem.id || getSaleProductName(sale) === returnItem.name;
    });

    try {
      const returnPayload = {
        product_id: returnItem.id,
        quantity,
        type: "return" as const,
        order_id: saleForReturn ? getSaleInvoiceNumber(saleForReturn) : undefined,
        customer_name: saleForReturn ? getSaleCustomerName(saleForReturn) : undefined,
        customer_phone: saleForReturn ? (saleForReturn.customerPhone || saleForReturn.customer_phone) : undefined,
        refund_reason: returnReason || undefined,
      };
      const signature = JSON.stringify(returnPayload);
      const key = pendingReturnKey.current?.signature === signature
        ? pendingReturnKey.current.key
        : createSaleIdempotencyKey();
      pendingReturnKey.current = { signature, key };
      await apiPost<void>("/api/sales", {
        ...returnPayload,
        idempotency_key: key,
      });
      pendingReturnKey.current = null;

      const returnRowBase = saleForReturn || returnSale || {
        id: returnItem.id,
        productId: returnItem.id,
        productName: returnItem.name,
        quantity: 0,
        total: 0,
        type: "sale",
        orderId: undefined,
        order_id: undefined,
        customerName: "Walk-in",
        customer_name: "Walk-in",
        createdAt: new Date().toISOString(),
      } as Sale;

      const originalQty = Number(returnRowBase.quantity || 0);
      const returnTotal = originalQty > 0
        ? Number(returnRowBase.total || 0) * (quantity / originalQty)
        : Number(returnRowBase.total || 0);

      setSales((prevSales) => [
        {
          ...returnRowBase,
          id: `${returnRowBase.id || returnItem.id}-return-${Date.now()}`,
          productId: returnItem.id,
          product_id: returnItem.id,
          productName: returnItem.name,
          product_name: returnItem.name,
          quantity,
          total: returnTotal,
          type: "return",
          orderId: getSaleInvoiceNumber(returnRowBase),
          order_id: getSaleInvoiceNumber(returnRowBase),
          customerName: getSaleCustomerName(returnRowBase),
          customer_name: getSaleCustomerName(returnRowBase),
          date: getSaleCreatedAt(returnRowBase) || new Date().toISOString(),
          createdAt: getSaleCreatedAt(returnRowBase) || new Date().toISOString(),
        } as Sale,
        ...prevSales,
      ]);

      setReturnStatus({ type: "success", text: `${returnItem.name} has been returned to inventory.` });
      setReturnItem(null);
      setReturnSale(null);
      setReturnAmount(1);
      setReturnReason("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to process this return.";
      setReturnStatus({ type: "error", text: message });
      throw err;
    }
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
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sortedSales.filter((s) => {
      const dateValue = getSaleDate(s);
      if (!dateValue) return false;

      const saleDay = new Date(dateValue)
        .toISOString()
        .slice(0, 10);

      const matchesDate = !filterDate || saleDay === filterDate;
      const searchTarget = [
        s.orderId,
        s.order_id,
        s.customerName,
        s.customer_name,
        s.customerPhone,
        s.customer_phone,
        s.productName,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(" ");

      const matchesSearch =
        !normalizedQuery || searchTarget.includes(normalizedQuery);

      return matchesDate && matchesSearch;
    });
  }, [sortedSales, filterDate, searchQuery]);

  // ================= TOTAL REVENUE =================
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => acc + getSignedSaleTotal(sale),
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
        (map[day] || 0) + getSignedSaleTotal(sale);
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
        {returnItem && (
          <ReturnModal
            returnItem={returnItem}
            returnAmount={returnAmount}
            setReturnAmount={setReturnAmount}
            returnReason={returnReason}
            setReturnReason={setReturnReason}
            setReturnItem={(value) => {
              if (!value) pendingReturnKey.current = null;
              setReturnItem(value);
              if (!value) setReturnSale(null);
            }}
            saveReturn={saveReturn}
            saleContext={returnSale}
            returnContext={{
              invoiceNumber: getSaleInvoiceNumber(returnSale || {}),
              customerName: getSaleCustomerName(returnSale || {}),
              returnDate: getSaleCreatedAt(returnSale || {}) || new Date().toLocaleString(),
            }}
          />
        )}

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4">
          {showBackToDashboard && (
            <Link
              href="/"
              className="inline-flex w-fit items-center rounded-full bg-theme-input border border-theme px-4 py-2 text-sm text-theme-primary hover:bg-theme-card transition"
            >
              ← Back to Dashboard
            </Link>
          )}

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
            Search sales:
          </label>

          <input
            type="search"
            placeholder="Order, customer, product..."
            className="bg-theme-input border border-theme px-3 py-2 rounded-2xl outline-none text-theme-primary focus:border-cyan-400"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

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

          {(filterDate || searchQuery) && (
            <button
              onClick={() => {
                setFilterDate("");
                setSearchQuery("");
              }}
              className="text-sm text-red-400 hover:text-red-300 transition"
            >
              Clear filters
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
                <th className="p-4 text-left text-theme-secondary">Action</th>
              </tr>
            </thead>

            <tbody>
              {salesLoading ? (
                <tr>
                  <td
                    colSpan={7}
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
                    colSpan={7}
                    className="p-6 text-center text-theme-secondary"
                  >
                    No sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const isReturnedSale = (sale.type ?? "sale") === "return";
                  const signedTotal = getSignedSaleTotal(sale);
                  const remainingReturnQty = getRemainingReturnQuantity(sale);
                  const returnedQty = Math.max(0, Number(sale.quantity || 0) - remainingReturnQty);
                  const canReturnSale = !isReturnedSale && remainingReturnQty > 0;

                  return (
                    <tr
                      key={sale.id}
                      className={`border-t border-theme transition-colors duration-150 ${
                        isReturnedSale
                          ? "bg-rose-500/8 border-l-2 border-l-rose-400"
                          : "hover:bg-theme-surface-soft"
                      }`}
                    >
                      <td className="p-4 text-sm text-theme-secondary">
                        {sale.orderId || sale.order_id || "-"}
                      </td>
                      <td className="p-4">
                        {sale.customerName || sale.customer_name || "Walk-in"}
                      </td>
                      <td className="p-4">
                        {sale.productName || "Unknown"}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span>{getQuantityLabel(sale)}</span>
                          {!isReturnedSale && Number(sale.quantity || 0) > 0 && returnedQty > 0 && (
                            <span className="text-[10px] text-amber-300">
                              {remainingReturnQty > 0 ? `${returnedQty} returned · ${remainingReturnQty} left` : `${returnedQty} returned`}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className={`p-4 font-medium ${isReturnedSale ? "text-rose-300" : "text-green-400"}`}>
                        {signedTotal >= 0 ? "$" : "-$"}
                        {Math.abs(signedTotal).toFixed(2)}
                      </td>

                      <td className="p-4 text-sm text-theme-secondary">
                        {formatDate(sale)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleReturnSale(sale)}
                            disabled={!canReturnSale}
                            className={`min-w-[92px] whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                              canReturnSale
                                ? "border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                          >
                            {isReturnedSale ? "Returned" : canReturnSale ? "Return" : "No return left"}
                          </button>
                          {!isReturnedSale && (
                            <button
                              onClick={() => handlePrintSale(sale)}
                              className="rounded-xl border border-cyan-700 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-900 transition hover:bg-cyan-100"
                            >
                              Print
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {returnStatus && (
          <div
            className={`fixed left-1/2 top-4 z-60 max-w-sm -translate-x-1/2 rounded-xl border border-opacity-80 px-3 py-2 text-center text-sm font-bold shadow-lg backdrop-blur-sm ${
              returnStatus.type === "success" ? "toast-success" : "toast-error"
            }`}
          >
            {returnStatus.text}
          </div>
        )}

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