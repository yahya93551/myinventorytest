"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../../types";
import { X } from "lucide-react";
import { useBusinessSettings } from "@/hooks/useCustomFields";
import { useTenantRole } from "@/hooks/useTenantRole";
import { countryOptions, normalizePhoneNumber, isPhoneNumber, splitPhoneNumber } from "@/lib/auth";
import { generateReceiptHtml, printReceiptHtml } from "@/lib/receipt";

type BulkSaleLine = {
  productId: string;
  quantity: number;
  unit?: "base" | "converted";
};

type SaleMeta = {
  order_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  paid?: boolean;
};

type Props = {
  isOpen: boolean;
  pageMode?: boolean;
  products: Product[];
  onClose: () => void;
  onConfirm: (items: BulkSaleLine[], metadata?: SaleMeta) => Promise<boolean>;
  showMessage: (type: "success" | "error", text: string) => void;
};

export default function BulkSellModal({
  isOpen,
  pageMode = false,
  products,
  onClose,
  onConfirm,
  showMessage,
}: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [printAfterSale, setPrintAfterSale] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [unitModes, setUnitModes] = useState<Record<string, "base" | "converted">>({});
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+252");
  const [isPaidSale, setIsPaidSale] = useState(true);
  const { data: businessSettings } = useBusinessSettings();
  const { data: tenantRoleData } = useTenantRole();
  const tenantRole = tenantRoleData?.role;
  const useAllocatedQuantity = tenantRole === "sales" && businessSettings?.business_type === "warehouse";
  const printWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuantities({});
      setError(null);
      setIsProcessing(false);
      setPrintAfterSale(false);
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
      setCountryCode("+252");
      setIsPaidSale(true);
      setOrderId("");
      setUnitModes({});
    } else if (typeof window !== "undefined") {
      setOrderId(`INV-${Date.now()}`);
    }
  }, [isOpen]);

  useEffect(() => {
    setLocalSearch("");
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  const availableProducts = useMemo(() => {
    return products.filter((product) => {
      const available = useAllocatedQuantity
        ? Number(product.allocated_quantity || 0)
        : Number(product.stock || 0);
      const remainder = Number(product.stock_remainder || 0);
      return available > 0 || remainder > 0;
    });
  }, [products, useAllocatedQuantity]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [availableProducts, searchQuery]);

  const selectedLines = useMemo(() => {
    return availableProducts
      .map((product) => {
        const quantity = Number(quantities[product.id] || 0);
        const unit = unitModes[product.id] || "base";

        const conversionRate = typeof product.conversion_rate === "number" ? product.conversion_rate : 0;
        const isConverted = unit === "converted" && conversionRate > 0;
        const price = Number(product.price || 0);
        const lineTotal = isConverted ? (quantity / conversionRate) * price : quantity * price;

        return {
          product,
          quantity,
          unit,
          lineTotal,
        };
      })
      .filter((line) => line.quantity > 0);
  }, [availableProducts, quantities, unitModes]);

  const total = useMemo(
    () => selectedLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [selectedLines]
  );

  const handleQuantityChange = (productId: string, value: string) => {
    const sanitized = value === "" ? "" : String(Number(value) >= 0 ? Number(value) : "");
    setQuantities((prev) => ({ ...prev, [productId]: sanitized }));
    setError(null);
  };

  const handleUnitModeChange = (
    productId: string,
    mode: "base" | "converted"
  ) => {
    setUnitModes((prev) => ({ ...prev, [productId]: mode }));
    setError(null);
  };

  const printReceipt = (lines: Array<{ name: string; quantity: number; price: number; total: number }>) => {
    if (typeof window === "undefined") return;

    const formattedDate = new Date().toLocaleString("so-SO", {
      timeZone: "Africa/Mogadishu",
    });

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
        invoiceNumber: orderId,
        date: formattedDate,
        customerName: customerName || "Walk-in Customer",
        customerAddress: customerAddress || "-",
        customerPhone: customerPhone || "-",
        title: "Sale Invoice",
      },
      lines.map((item) => ({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
      }))
    );

    printReceiptHtml(receiptHtml, printWindowRef.current);
  };

  const handleConfirm = async () => {
    if (selectedLines.length === 0) {
      setError("Select at least one product and quantity to sell.");
      return;
    }

    const invalidLine = selectedLines.find((line) => {
      const availableBase = useAllocatedQuantity
        ? Number(line.product.allocated_quantity || 0)
        : Number(line.product.stock || 0);
      const conversionRate = typeof line.product.conversion_rate === "number" ? line.product.conversion_rate : 0;
      const available = line.unit === "converted" && conversionRate > 0
        ? availableBase * conversionRate + Number(line.product.stock_remainder || 0)
        : availableBase;
      return line.quantity > available;
    });
    if (invalidLine) {
      setError(`Quantity for ${invalidLine.product.name} cannot exceed available stock.`);
      return;
    }

    const rawPhone = customerPhone.trim();
    const phoneValue = rawPhone.startsWith("+") ? rawPhone : `${countryCode}${rawPhone}`;

    if (!isPaidSale && (!customerName.trim() || !rawPhone)) {
      setError("Customer name and phone are required for unpaid sales.");
      return;
    }

    if (rawPhone && !isPhoneNumber(phoneValue)) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const payload = selectedLines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      unit: (line.unit === "converted" ? "converted" : "base") as "base" | "converted",
    }));

    let printWindow: Window | null = null;
    if (printAfterSale && typeof window !== "undefined") {
      printWindow = window.open("", "_blank", "width=600,height=800");
      if (printWindow) {
        printWindowRef.current = printWindow;
      }
    }

    const success = await onConfirm(payload, {
      order_id: orderId,
      customer_name: customerName || undefined,
      customer_address: customerAddress || undefined,
      customer_phone: rawPhone ? normalizePhoneNumber(phoneValue) : undefined,
      paid: isPaidSale,
    });

    if (!success) {
      if (printWindowRef.current && !printWindowRef.current.closed) {
        printWindowRef.current.close();
      }
      setError("Bulk sale failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (printAfterSale) {
      const linesToPrint = selectedLines.map((line) => ({
        name: line.product.name,
        quantity: line.quantity,
        price: line.product.price,
        total: line.lineTotal,
      }));
      printReceipt(linesToPrint);
    }

    showMessage("success", "Bulk sale completed successfully.");
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={pageMode ? "w-full px-0 py-0" : "fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-6"}>
      <div className={pageMode ? "bg-theme-card border-theme p-6 rounded-4xl w-full max-w-5xl mx-auto text-theme-primary max-h-[none] overflow-visible shadow-2xl ring-1 ring-white/5" : "bg-theme-card border-theme p-6 rounded-4xl w-[min(95vw,900px)] text-theme-primary max-h-[90vh] overflow-auto shadow-2xl ring-1 ring-white/5"}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Sell Multiple Items</h2>
            <p className="mt-1 text-sm text-theme-secondary max-w-xl">Choose quantities for each product and confirm in a single checkout.</p>
            {useAllocatedQuantity ? (
              <p className="mt-2 text-sm text-theme-secondary">
                Warehouse sales users can only sell quantities already allocated from stock.
              </p>
            ) : (
              <p className="mt-2 text-sm text-theme-secondary">
                Retail shop users can sell directly from available stock.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-theme-secondary rounded-full p-2 transition hover:bg-white/5 hover:text-theme-primary"
            aria-label="Close bulk sell modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="rounded-[28px] border border-theme/50 bg-theme-surface p-4 mb-4 text-sm text-theme-secondary">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-2 font-semibold border-b border-theme/50 pb-2 mb-3 text-theme-primary">
              <span>Product</span>
              <span className="text-right">Price</span>
              <span className="text-right">Stock</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Qty</span>
            </div>
            <div className="px-2 mb-3">
              <input
                type="search"
                placeholder="Search products..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="mb-2 w-full rounded-2xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-theme-secondary">No products available for bulk sale.</div>
            ) : (
              filteredProducts.map((product) => {
                const hasConversion =
                  product.base_unit?.trim() &&
                  product.converted_unit?.trim() &&
                  typeof product.conversion_rate === "number" &&
                  product.conversion_rate > 0;
                const unit = unitModes[product.id] || "base";
                const conversionRate = Number(product.conversion_rate || 0);
                const availableBase = useAllocatedQuantity
                  ? Number(product.allocated_quantity || 0)
                  : Number(product.stock || 0);
                const availableConverted = hasConversion
                  ? availableBase * conversionRate + Number(product.stock_remainder || 0)
                  : 0;
                const stockLabel = hasConversion
                  ? `${availableBase} ${product.base_unit || "base"} + ${product.stock_remainder || 0} ${product.converted_unit} (${availableConverted} ${product.converted_unit})`
                  : `${availableBase} ${product.base_unit || "units"}`;
                const maxQty = unit === "converted" ? availableConverted : availableBase;

                return (
                  <div key={product.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-2 py-3 border-b border-theme/30 last:border-b-0 hover:bg-white/5 transition">
                    <div className="space-y-1">
                      <p className="font-medium text-theme-primary">{product.name}</p>
                      <p className="text-xs text-theme-secondary">{product.category || "Uncategorized"}</p>
                    </div>
                    <span className="text-right text-theme-secondary">${product.price}</span>
                    <span className="text-right text-theme-secondary">{stockLabel}</span>
                    <div>
                      {hasConversion ? (
                        <select
                          value={unit}
                          onChange={(e) =>
                            handleUnitModeChange(
                              product.id,
                              e.target.value as "base" | "converted"
                            )
                          }
                          disabled={isProcessing}
                          className="w-full rounded-2xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                        >
                          <option value="base">
                            {product.base_unit?.trim() || "Base"}
                          </option>
                          <option value="converted">
                            {product.converted_unit?.trim() || "Converted"}
                          </option>
                        </select>
                      ) : (
                        <span className="block rounded-2xl border border-theme/50 bg-theme-input px-3 py-2 text-right text-theme-secondary">
                          {product.base_unit?.trim() || "unit"}
                        </span>
                      )}
                    </div>
                    <input
                      className="w-full rounded-2xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                      type="number"
                      min={0}
                      max={maxQty}
                      value={quantities[product.id] ?? ""}
                      onChange={(e) =>
                        handleQuantityChange(product.id, e.target.value)
                      }
                      disabled={isProcessing}
                    />
                  </div>
                );
              })
            )}
        </div>

        <div className="mb-4 rounded-[28px] border border-theme/50 bg-theme-surface p-5 text-theme-primary">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold mb-1">Invoice & Customer</p>
              <p className="text-xs text-theme-secondary">Invoice #: {orderId}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/20 px-3 py-2 text-xs text-theme-secondary">
              {selectedLines.length} item{selectedLines.length === 1 ? "" : "s"} selected
            </div>
          </div>
          <div className="grid gap-3 mt-3">
            <input
              className="rounded-2xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer name"
            />
            <input
              className="rounded-2xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer address"
            />
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isProcessing}
                className="select-base w-28!"
              >
                {countryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.code}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 rounded bg-theme-input px-3 py-2 text-theme-primary"
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={isProcessing}
                placeholder="Phone number"
              />
            </div>
            <div className="mt-4 rounded-2xl border border-theme/50 bg-slate-950/20 p-4">
              <p className="text-sm font-semibold text-theme-primary mb-3">Payment status</p>
              <div className="flex flex-wrap gap-4 text-sm text-theme-secondary">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bulkSalePaid"
                    value="paid"
                    checked={isPaidSale}
                    disabled={isProcessing}
                    onChange={() => setIsPaidSale(true)}
                    className="h-4 w-4 rounded border-theme bg-theme-input"
                  />
                  Paid
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bulkSalePaid"
                    value="unpaid"
                    checked={!isPaidSale}
                    disabled={isProcessing}
                    onChange={() => setIsPaidSale(false)}
                    className="h-4 w-4 rounded border-theme bg-theme-input"
                  />
                  Pay later (create debt)
                </label>
              </div>
              {!isPaidSale && (
                <p className="mt-3 text-xs text-amber-300">
                  Customer name and phone number are required for unpaid sales.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-theme/50 bg-slate-950/20 p-4 text-sm text-theme-secondary flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-theme-primary">Total</p>
            <p className="text-lg text-green-300 font-semibold">${total}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              checked={printAfterSale}
              onChange={() => setPrintAfterSale((prev) => !prev)}
              disabled={isProcessing}
              className="h-4 w-4 rounded border-theme bg-theme-input text-green-500"
            />
            Print receipt after sale
          </label>
        </div>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-theme/50 px-4 py-2 text-theme-secondary transition hover:border-theme hover:bg-white/5"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-2xl bg-green-600 px-4 py-2 text-white transition disabled:opacity-50 disabled:pointer-events-none"
            disabled={isProcessing || selectedLines.length === 0}
          >
            {isProcessing ? "Processing..." : "Confirm bulk sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
