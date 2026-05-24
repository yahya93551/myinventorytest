"use client";

import { useEffect, useMemo, useState } from "react";
import { Product } from "../../types";
import { X, ShoppingCart } from "lucide-react";

type BulkSaleLine = {
  productId: string;
  quantity: number;
};

type SaleMeta = {
  order_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
};

type Props = {
  isOpen: boolean;
  products: Product[];
  onClose: () => void;
  onConfirm: (items: BulkSaleLine[], metadata?: SaleMeta) => Promise<boolean>;
  showMessage: (type: "success" | "error", text: string) => void;
};

export default function BulkSellModal({
  isOpen,
  products,
  onClose,
  onConfirm,
  showMessage,
}: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [printAfterSale, setPrintAfterSale] = useState(false);
  const [orderId, setOrderId] = useState(() => `INV-${Date.now()}`);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setQuantities({});
      setError(null);
      setIsProcessing(false);
      setPrintAfterSale(false);
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
    } else {
      setOrderId(`INV-${Date.now()}`);
    }
  }, [isOpen]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.stock > 0),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [availableProducts, searchQuery]);

  const selectedLines = useMemo(
    () =>
      availableProducts
        .map((product) => ({
          product,
          quantity: Number(quantities[product.id] || 0),
        }))
        .filter((line) => line.quantity > 0),
    [availableProducts, quantities]
  );

  const total = useMemo(
    () =>
      selectedLines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0
      ),
    [selectedLines]
  );

  const handleQuantityChange = (productId: string, value: string) => {
    const sanitized = value === "" ? "" : String(Number(value) >= 0 ? Number(value) : "");
    setQuantities((prev) => ({ ...prev, [productId]: sanitized }));
    setError(null);
  };

  const printReceipt = (lines: Array<{name:string; quantity:number; price:number; total:number;}>) => {
    if (typeof window === "undefined") return;

    const totalAmount = lines.reduce((sum, item) => sum + item.total, 0);
    const formattedDate = new Date().toLocaleString("so-SO", {
      timeZone: "Africa/Mogadishu",
    });

    const receiptHtml = `
      <html>
        <head>
          <title>Sale Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 24px; margin-bottom: 16px; }
            .section { margin-bottom: 16px; }
            .details p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            tfoot td { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Sale Invoice</h1>
          <div class="section details">
            <p><strong>Invoice #:</strong> ${orderId}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Customer:</strong> ${customerName || "Walk-in Customer"}</p>
            <p><strong>Address:</strong> ${customerAddress || "-"}</p>
            <p><strong>Phone:</strong> ${customerPhone || "-"}</p>
          </div>
          <table>
            <thead>
              <tr><th>No.</th><th>Item Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${lines
                .map(
                  (item, index) =>
                    `<tr><td>${index + 1}</td><td>${item.name}</td><td>${item.quantity}</td><td>$${item.price}</td><td>$${item.total}</td></tr>`
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr><td colspan="4">Grand Total</td><td>$${totalAmount}</td></tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow) return;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleConfirm = async () => {
    if (selectedLines.length === 0) {
      setError("Select at least one product and quantity to sell.");
      return;
    }

    const invalidLine = selectedLines.find((line) => line.quantity > line.product.stock);
    if (invalidLine) {
      setError(`Quantity for ${invalidLine.product.name} cannot exceed available stock.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    const payload = selectedLines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }));

    const success = await onConfirm(payload, {
      order_id: orderId,
      customer_name: customerName || undefined,
      customer_address: customerAddress || undefined,
      customer_phone: customerPhone || undefined,
    });

    if (!success) {
      setError("Bulk sale failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (printAfterSale) {
      printReceipt(
        selectedLines.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          price: line.product.price,
          total: line.product.price * line.quantity,
        }))
      );
    }

    showMessage("success", "Bulk sale completed successfully.");
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-theme-card border-theme p-6 rounded-2xl w-[min(95vw,900px)] text-theme-primary max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Sell Multiple Items</h2>
            <p className="text-sm text-theme-secondary">Choose quantities for each product and confirm.</p>
          </div>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary"
            aria-label="Close bulk sell modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="grid gap-3 mb-3 text-sm text-theme-secondary">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 font-semibold border-b border-theme pb-2">
            <span>Product</span>
            <span className="text-right">Price</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Qty</span>
          </div>
          <div className="px-2">
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2 w-full rounded bg-theme-input px-3 py-2 text-theme-primary"
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-4 text-center text-theme-secondary">No products available for bulk sale.</div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-2 py-2 border-b border-theme">
                <span>{product.name}</span>
                <span className="text-right">${product.price}</span>
                <span className="text-right">{product.stock}</span>
                <input
                  className="w-full rounded bg-theme-input px-2 py-1 text-theme-primary"
                  type="number"
                  min={0}
                  max={product.stock}
                  value={quantities[product.id] ?? ""}
                  onChange={(e) =>
                    handleQuantityChange(product.id, e.target.value)
                  }
                  disabled={isProcessing}
                />
              </div>
            ))
          )}
        </div>

        <div className="mb-4 rounded-2xl border border-theme p-4 bg-theme-surface text-theme-primary">
          <p className="text-sm font-semibold mb-3">Invoice & Customer</p>
          <p className="text-xs text-theme-secondary mb-3">Invoice #: {orderId}</p>
          <div className="grid gap-3">
            <input
              className="rounded bg-theme-input px-3 py-2 text-theme-primary"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer name"
            />
            <input
              className="rounded bg-theme-input px-3 py-2 text-theme-primary"
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer address"
            />
            <input
              className="rounded bg-theme-input px-3 py-2 text-theme-primary"
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer phone"
            />
          </div>
        </div>

        <div className="mb-4 text-sm text-theme-secondary">
          Total: <span className="text-green-300">${total}</span>
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm text-theme-secondary">
          <input
            type="checkbox"
            checked={printAfterSale}
            onChange={() => setPrintAfterSale((prev) => !prev)}
            disabled={isProcessing}
            className="h-4 w-4 rounded border-theme bg-theme-input text-green-500"
          />
          Print receipt after sale
        </label>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-theme px-4 py-2 text-theme-secondary"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-xl bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            disabled={isProcessing || selectedLines.length === 0}
          >
            {isProcessing ? "Processing..." : "Confirm bulk sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
