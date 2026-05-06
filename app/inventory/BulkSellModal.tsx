"use client";

import { useEffect, useMemo, useState } from "react";
import { Product } from "../../types";
import { X, ShoppingCart } from "lucide-react";

type BulkSaleLine = {
  productId: string;
  quantity: number;
};

type Props = {
  isOpen: boolean;
  products: Product[];
  onClose: () => void;
  onConfirm: (items: BulkSaleLine[]) => Promise<boolean>;
  showMessage: (type: "success" | "error", text: string) => void;
};

export default function BulkSellModal({
  isOpen,
  products,
  onClose,
  onConfirm,
  showMessage,
}: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printAfterSale, setPrintAfterSale] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuantities({});
      setError(null);
      setIsProcessing(false);
      setPrintAfterSale(false);
    }
  }, [isOpen]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.stock > 0),
    [products]
  );

  const selectedLines = useMemo(
    () =>
      availableProducts
        .map((product) => ({
          product,
          quantity: quantities[product.id] ?? 0,
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

  const handleQuantityChange = (productId: string, value: number, max: number) => {
    const quantity = Number.isNaN(value) ? 0 : Math.max(0, Math.min(value, max));
    setQuantities((prev) => ({ ...prev, [productId]: quantity }));
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
          <title>Sale Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 24px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            tfoot td { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Sale Receipt</h1>
          <p>Date: ${formattedDate}</p>
          <table>
            <thead>
              <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${lines
                .map(
                  (item) =>
                    `<tr><td>${item.name}</td><td>${item.quantity}</td><td>$${item.price}</td><td>$${item.total}</td></tr>`
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr><td colspan="3">Grand Total</td><td>$${totalAmount}</td></tr>
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

    setIsProcessing(true);
    setError(null);

    const payload = selectedLines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }));

    const success = await onConfirm(payload);

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
      <div className="bg-gray-900 p-6 rounded-2xl w-[min(95vw,900px)] text-white max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Sell Multiple Items</h2>
            <p className="text-sm text-gray-400">Choose quantities for each product and confirm.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close bulk sell modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-3 mb-3 text-sm text-gray-300">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 font-semibold border-b border-white/10 pb-2">
            <span>Product</span>
            <span className="text-right">Price</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Qty</span>
          </div>
          {availableProducts.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No products available for bulk sale.</div>
          ) : (
            availableProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-2 py-2 border-b border-white/10">
                <span>{product.name}</span>
                <span className="text-right">${product.price}</span>
                <span className="text-right">{product.stock}</span>
                <input
                  className="w-full rounded bg-white/10 px-2 py-1 text-slate-900"
                  type="number"
                  min={0}
                  max={product.stock}
                  value={quantities[product.id] ?? 0}
                  onChange={(e) =>
                    handleQuantityChange(product.id, Number(e.target.value), product.stock)
                  }
                  disabled={isProcessing}
                />
              </div>
            ))
          )}
        </div>

        <div className="mb-4 text-sm text-gray-300">
          Total: <span className="text-green-300">${total}</span>
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={printAfterSale}
            onChange={() => setPrintAfterSale((prev) => !prev)}
            disabled={isProcessing}
            className="h-4 w-4 rounded border-gray-500 bg-slate-800 text-green-500"
          />
          Print receipt after sale
        </label>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-gray-300"
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
