"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [step, setStep] = useState<"products" | "summary" | "checkout">("products");
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
  const getAvailableBase = useCallback((product: Product) => useAllocatedQuantity
    ? Number(product.allocation_availability?.base_quantity || 0)
    : Number(product.stock || 0), [useAllocatedQuantity]);
  const getAvailableConverted = useCallback((product: Product, conversionRate: number) => useAllocatedQuantity
    ? Number(product.allocation_availability?.converted_quantity || 0)
    : Number(product.stock || 0) * conversionRate + Number(product.stock_remainder || 0), [useAllocatedQuantity]);

  useEffect(() => {
    if (!isOpen) {
      setQuantities({});
      setError(null);
      setStep("products");
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
      const available = getAvailableBase(product);
      const remainder = useAllocatedQuantity ? 0 : Number(product.stock_remainder || 0);
      const conversionRate = Number(product.conversion_rate || 0);
      const convertedAvailability = conversionRate > 0
        ? getAvailableConverted(product, conversionRate)
        : remainder;
      return available > 0 || convertedAvailability > 0;
    });
  }, [getAvailableBase, getAvailableConverted, products, useAllocatedQuantity]);

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

        const conversionRate = useAllocatedQuantity
          ? Number(product.allocation_availability?.conversion_rate || 0)
          : typeof product.conversion_rate === "number" ? product.conversion_rate : 0;
        const isConverted = unit === "converted" && conversionRate > 0;
        const price = Number(product.price || 0);
        const unitPrice = isConverted ? price / conversionRate : price;
        const lineTotal = quantity * unitPrice;

        return {
          product,
          quantity,
          unit,
          unitPrice,
          lineTotal,
        };
      })
      .filter((line) => line.quantity > 0);
  }, [availableProducts, quantities, unitModes, useAllocatedQuantity]);

  const total = useMemo(
    () => selectedLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [selectedLines]
  );

  const getUnitLabel = (product: Product, unit: "base" | "converted") => {
    if (unit === "converted" && product.converted_unit?.trim()) {
      return product.converted_unit.trim();
    }
    return product.base_unit?.trim() || "unit";
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const sanitized = value.replace(/\D/g, "");
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
      const conversionRate = typeof line.product.conversion_rate === "number" ? line.product.conversion_rate : 0;
      const available = line.unit === "converted" && conversionRate > 0
        ? getAvailableConverted(line.product, conversionRate)
        : getAvailableBase(line.product);
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

    const payload = selectedLines.map((line) => {
      const productUnit = line.unit === "converted" ? "converted" : "base";
      return {
        productId: line.product.id,
        quantity: Number(line.quantity),
        unit: productUnit as "base" | "converted",
      };
    });

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
        price: line.unitPrice,
        total: line.lineTotal,
      }));
      printReceipt(linesToPrint);
    }

    showMessage("success", "Bulk sale completed successfully.");
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  const renderProductsStep = () => (
    <>
      <div className="mb-4 rounded-2xl border border-theme/50 bg-theme-surface/80 p-3 text-sm text-theme-secondary">
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="text-sm font-semibold text-theme-primary">Quick sell list</div>
          <div className="text-xs text-theme-secondary">{filteredProducts.length} products</div>
        </div>
        <div className="mb-3 px-2">
          <input
            type="search"
            placeholder="Search products..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="mb-2 w-full rounded-xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-4 text-center text-theme-secondary">No products available for bulk sale.</div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const hasConversion =
                product.base_unit?.trim() &&
                product.converted_unit?.trim() &&
                typeof product.conversion_rate === "number" &&
                product.conversion_rate > 0;
              const unit = unitModes[product.id] || "base";
              const conversionRate = Number(product.conversion_rate || 0);
              const availableBaseQuantity = getAvailableBase(product);
              const availableConvertedQuantity = hasConversion
                ? getAvailableConverted(product, conversionRate)
                : 0;
              const stockLabel = hasConversion
                ? useAllocatedQuantity
                  ? `${availableBaseQuantity} ${product.base_unit || "base"} + ${availableConvertedQuantity} ${product.converted_unit} allocated`
                  : `${availableBaseQuantity} ${product.base_unit || "base"} + ${product.stock_remainder || 0} ${product.converted_unit} (${availableConvertedQuantity} ${product.converted_unit})`
                : `${availableBaseQuantity} ${product.base_unit || "units"}`;
              const maxQty = unit === "converted" ? availableConvertedQuantity : availableBaseQuantity;

              return (
                <div key={product.id} className="rounded-2xl border border-theme/50 bg-theme-card/70 p-3 shadow-sm transition hover:border-cyan-400/40 hover:bg-white/3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-theme-primary">{product.name}</p>
                      <p className="text-xs text-theme-secondary">{product.category || "Uncategorized"}</p>
                    </div>
                    <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-sm font-semibold text-cyan-300">
                      ${product.price}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1.25fr_0.9fr_0.95fr]">
                    <div className="rounded-xl border border-theme/50 bg-theme-surface px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-theme-secondary">Stock</div>
                      <div className="mt-1 text-sm font-medium text-theme-primary">{stockLabel}</div>
                    </div>

                    <div>
                      {hasConversion ? (
                        <div className="rounded-xl border border-theme/50 bg-theme-surface px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-theme-secondary">Unit</div>
                          <select
                            value={unit}
                            onChange={(e) =>
                              handleUnitModeChange(
                                product.id,
                                e.target.value as "base" | "converted"
                              )
                            }
                            disabled={isProcessing}
                            className="mt-1 w-full rounded-lg border border-theme/50 bg-theme-input px-2 py-1.5 text-sm text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                          >
                            <option value="base">{product.base_unit?.trim() || "Base"}</option>
                            <option value="converted">{product.converted_unit?.trim() || "Converted"}</option>
                          </select>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-theme/50 bg-theme-surface px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-theme-secondary">Unit</div>
                          <div className="mt-1 text-sm text-theme-primary">{product.base_unit?.trim() || "unit"}</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="rounded-xl border border-theme/50 bg-theme-surface px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-theme-secondary">Qty</div>
                        <input
                          className="mt-1 w-full rounded-lg border border-theme/50 bg-theme-input px-2 py-1.5 text-sm text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          max={maxQty}
                          value={quantities[product.id] ?? ""}
                          onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                          onWheel={(e) => e.preventDefault()}
                          onKeyDown={(e) => {
                            const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End", "Enter"];
                            if (/^[0-9]$/.test(e.key) || allowedKeys.includes(e.key)) {
                              return;
                            }
                            if (e.ctrlKey || e.metaKey || e.altKey) {
                              return;
                            }
                            e.preventDefault();
                          }}
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-theme/50 bg-slate-950/20 p-4 text-sm text-theme-secondary sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-theme-primary">Order summary</p>
          <p className="text-lg font-semibold text-green-300">${total}</p>
        </div>
        <div className="rounded-xl bg-slate-950/20 px-3 py-2 text-xs text-theme-secondary">
          {selectedLines.length} item{selectedLines.length === 1 ? "" : "s"} selected
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 mt-4 border-t border-theme/50 px-3 pb-1 pt-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-theme/50 px-4 py-2 text-theme-secondary transition hover:border-theme hover:bg-white/5"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={() => setStep("summary")}
            className="rounded-xl bg-green-600 px-4 py-2 text-white transition hover:bg-green-500 disabled:opacity-50 disabled:pointer-events-none"
            disabled={isProcessing || selectedLines.length === 0}
          >
            Go to summary
          </button>
        </div>
      </div>
    </>
  );

  const renderSummaryStep = () => (
    <>
      <div className="mb-4 rounded-2xl border border-theme/50 bg-theme-surface/80 p-5 text-theme-primary">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-theme-secondary">Summary</p>
          <h3 className="mt-2 text-2xl font-bold text-theme-primary">{selectedLines.length} item{selectedLines.length === 1 ? "" : "s"}</h3>
        </div>

        <div className="space-y-3">
          {selectedLines.map((line) => (
            <div key={line.product.id} className="flex items-center justify-between gap-4 rounded-xl border border-theme/50 bg-theme-card/70 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-theme-primary">{line.product.name}</p>
                <p className="text-xs text-theme-secondary">
                  Qty: {line.quantity} {getUnitLabel(line.product, line.unit || "base")}
                </p>
              </div>
              <p className="font-semibold text-green-300">${line.lineTotal.toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between text-sm text-theme-secondary">
            <span>Total</span>
            <span className="text-2xl font-bold text-green-300">${total}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={() => setStep("products")}
          className="rounded-xl border border-theme/50 px-4 py-2 text-theme-secondary transition hover:border-theme hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => setStep("checkout")}
          className="rounded-xl bg-green-600 px-4 py-2 text-white transition hover:bg-green-500"
        >
          Continue
        </button>
      </div>
    </>
  );

  const renderCheckoutStep = () => (
    <>
      <div className="mb-4 rounded-2xl border border-theme/50 bg-theme-surface/80 p-5 text-theme-primary">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-theme-secondary">Total</p>
            <p className="mt-2 text-3xl font-bold text-green-300">${total}</p>
          </div>
          <div className="rounded-xl border border-theme/50 bg-slate-950/20 px-3 py-2 text-xs text-theme-secondary">
            {selectedLines.length} item{selectedLines.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-theme-primary">Customer</label>
            <input
              className="w-full rounded-xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isProcessing}
              placeholder="Name"
            />
          </div>

          <input
            className="rounded-xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            type="text"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            disabled={isProcessing}
            placeholder="Address"
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
              className="flex-1 rounded-xl border border-theme/50 bg-theme-input px-3 py-2 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={isProcessing}
              placeholder="Phone"
            />
          </div>

          <div className="mt-3 rounded-2xl border border-theme/50 bg-slate-950/20 p-4">
            <p className="mb-3 text-sm font-semibold text-theme-primary">Payment</p>
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
                Pay later
              </label>
            </div>
          </div>

          <label className="mt-2 flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              checked={printAfterSale}
              onChange={() => setPrintAfterSale((prev) => !prev)}
              disabled={isProcessing}
              className="h-4 w-4 rounded border-theme bg-theme-input text-green-500"
            />
            Print receipt
          </label>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={() => setStep("summary")}
          className="rounded-xl border border-theme/50 px-4 py-2 text-theme-secondary transition hover:border-theme hover:bg-white/5"
          disabled={isProcessing}
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          className="rounded-xl bg-green-600 px-4 py-2 text-white transition hover:bg-green-500 disabled:opacity-50 disabled:pointer-events-none"
          disabled={isProcessing || selectedLines.length === 0}
        >
          {isProcessing ? "Processing..." : "Confirm Sale"}
        </button>
      </div>
    </>
  );

  return (
    <div className={pageMode ? "w-full px-0 py-0" : "fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-6"}>
      <div className={pageMode ? "bg-theme-card border border-theme/60 p-6 rounded-3xl w-full max-w-5xl mx-auto text-theme-primary max-h-none overflow-visible shadow-xl" : "bg-theme-card border border-theme/60 p-5 rounded-3xl w-[min(95vw,900px)] text-theme-primary max-h-[90vh] overflow-auto shadow-xl"}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-theme-primary">Sell Multiple Items</h2>
            <p className="mt-1 text-sm text-theme-secondary max-w-xl">Choose quantities for each product, review the order, and complete the sale.</p>
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
            className="rounded-full p-2 text-theme-secondary transition hover:bg-white/5 hover:text-theme-primary"
            aria-label="Close bulk sell modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {step === "products" && renderProductsStep()}
        {step === "summary" && renderSummaryStep()}
        {step === "checkout" && renderCheckoutStep()}
      </div>
    </div>
  );
}
