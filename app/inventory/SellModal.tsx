import { useEffect, useState } from "react";
import { apiPost } from "@/lib/apiClient";
import { Product } from "../../types";

type SaleMeta = {
  order_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
};

type Props = {
  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  confirmSell: (metadata?: SaleMeta) => Promise<boolean | void> | void;
};

export default function SellModal({
  sellItem,
  sellQty,
  setSellQty,
  setSellItem,
  confirmSell,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printAfterSale, setPrintAfterSale] = useState(false);
  const [orderId, setOrderId] = useState(() => `INV-${Date.now()}`);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [goodsLoaded, setGoodsLoaded] = useState(false);

  useEffect(() => {
    if (sellItem) {
      setOrderId(`INV-${Date.now()}`);
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
      setPrintAfterSale(false);
      setError(null);
      setGoodsLoaded(false);
    }
  }, [sellItem]);

  if (!sellItem) return null;

  const now = new Date();
  const formattedDate = now.toLocaleString("so-SO", {
    timeZone: "Africa/Mogadishu",
  });
  const total = sellQty * sellItem.price;
  const canConfirm = sellQty >= 1 && sellQty <= sellItem.stock;

  const printReceipt = () => {
    if (typeof window === "undefined") return;

    const receiptHtml = `
      <html>
        <head>
          <title>Sale Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 24px; margin-bottom: 16px; }
            .section { margin-bottom: 16px; }
            .details p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
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
              <tr>
                <td>1</td>
                <td>${sellItem.name}</td>
                <td>${sellQty}</td>
                <td>$${sellItem.price}</td>
                <td>$${total}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr><td colspan="4">Grand Total</td><td>$${total}</td></tr>
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

  const logLoadAction = async () => {
    try {
      await apiPost('/api/activity/log', {
        action: 'LOAD',
        entity: 'product',
        entity_id: sellItem?.id,
        details: {
          productName: sellItem?.name,
          quantity: sellQty,
          stockAvailable: sellItem?.stock,
        },
      });
    } catch (err) {
      console.warn('Unable to track load activity', err);
    }
  };

  const handleConfirm = async () => {
    if (isProcessing) return;
    if (!canConfirm) {
      setError("Please enter a valid quantity within available stock.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await confirmSell({
        order_id: orderId,
        customer_name: customerName || undefined,
        customer_address: customerAddress || undefined,
        customer_phone: customerPhone || undefined,
      });

      // Only keep modal open if confirmSell explicitly returns false
      // If it returns undefined (void) or true, we assume success and close
      if (result === false) {
        setIsProcessing(false);
        return;
      }

      if (printAfterSale) {
        printReceipt();
      }

      // Success: close modal
      setSellItem(null);
    } catch (error) {
      console.error("Sale error:", error);
      setError("Unable to complete sale. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 overflow-y-auto px-4 py-6 flex items-center justify-center z-50">
      <div className="border border-theme bg-theme-card p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-theme-primary">
        <h2 className="text-xl mb-2">Sell Product</h2>
        <p className="text-theme-secondary mb-1">
          {sellItem.name} — Stock: {sellItem.stock}
        </p>
        <p className="text-xs text-theme-secondary mb-3">Date: {formattedDate}</p>

        <div className="mb-4 rounded-2xl border border-theme p-3 bg-theme-surface text-theme-primary">
          <p className="text-sm font-semibold mb-2">Invoice & Customer</p>
          <p className="text-xs text-theme-secondary mb-2">Invoice #: {orderId}</p>
          <p className="text-xs text-theme-secondary mb-3">
            Load the selected goods first, then confirm the sale.
          </p>
          <button
            type="button"
            onClick={async () => {
              setGoodsLoaded(true);
              await logLoadAction();
            }}
            disabled={isProcessing || goodsLoaded}
            className="mb-4 rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {goodsLoaded ? "Goods loaded" : "Load goods details"}
          </button>
          <label className="block text-sm text-theme-secondary mb-2">
            Customer name
            <input
              className="mt-1 w-full rounded bg-theme-input px-3 py-2 text-theme-primary"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isProcessing}
              placeholder="Walk-in customer"
            />
          </label>
          <label className="block text-sm text-theme-secondary mb-2">
            Address
            <input
              className="mt-1 w-full rounded bg-theme-input px-3 py-2 text-theme-primary"
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer address"
            />
          </label>
          <label className="block text-sm text-theme-secondary">
            Phone
            <input
              className="mt-1 w-full rounded bg-theme-input px-3 py-2 text-theme-primary"
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer phone"
            />
          </label>
        </div>

        <input
          className="p-2 rounded bg-theme-input w-full mb-2 text-theme-primary"
          type="number"
          min={1}
          max={sellItem.stock}
          value={sellQty}
          onChange={(e) => {
            const value = Number(e.target.value);
            const nextQty = Number.isNaN(value)
              ? 1
              : Math.max(1, Math.min(value, sellItem.stock));

            setError(null);
            setSellQty(nextQty);
          }}
          disabled={isProcessing}
        />

        <label className="mb-3 flex items-center gap-2 text-sm text-theme-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-theme bg-theme-input text-green-500"
            checked={printAfterSale}
            disabled={isProcessing}
            onChange={() => setPrintAfterSale((prev) => !prev)}
          />
          Print receipt after sale
        </label>

        <p className="text-xs text-theme-secondary mb-3">
          Enter a quantity between 1 and {sellItem.stock}.
        </p>

        {error && (
          <p className="text-sm text-red-300 mb-3">{error}</p>
        )}

        <div className="mb-4 text-sm text-green-400">Total: ${total}</div>

        <div className="flex justify-between">
          <button
            onClick={() => setSellItem(null)}
            className="text-theme-secondary"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-green-600 px-4 py-2 rounded-xl disabled:opacity-50"
            disabled={isProcessing || !canConfirm || !goodsLoaded}
          >
            {isProcessing ? "Processing..." : goodsLoaded ? "Confirm Sell" : "Load goods first"}
          </button>
        </div>
      </div>
    </div>
  );
}