import { useState } from "react";
import { Product } from "../../types";

type Props = {
  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  confirmSell: () => Promise<boolean | void> | void;
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
          <title>Sale Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 24px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            tfoot td { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Sale Receipt</h1>
          <p>Product: ${sellItem.name}</p>
          <p>Date: ${formattedDate}</p>
          <table>
            <thead>
              <tr><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${sellQty}</td>
                <td>$${sellItem.price}</td>
                <td>$${total}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr><td colspan="2">Grand Total</td><td>$${total}</td></tr>
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
    if (isProcessing) return;
    if (!canConfirm) {
      setError("Please enter a valid quantity within available stock.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await confirmSell();

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-2xl w-96 text-white">
        <h2 className="text-xl mb-2">Sell Product</h2>
        <p className="text-gray-400 mb-1">
          {sellItem.name} — Stock: {sellItem.stock}
        </p>
        <p className="text-xs text-gray-500 mb-3">Date: {formattedDate}</p>

        <input
          className="p-2 rounded bg-white/10 w-full mb-2"
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

        <label className="mb-3 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-500 bg-slate-800 text-green-500"
            checked={printAfterSale}
            disabled={isProcessing}
            onChange={() => setPrintAfterSale((prev) => !prev)}
          />
          Print receipt after sale
        </label>

        <p className="text-xs text-gray-500 mb-3">
          Enter a quantity between 1 and {sellItem.stock}.
        </p>

        {error && (
          <p className="text-sm text-red-300 mb-3">{error}</p>
        )}

        <div className="mb-4 text-sm text-green-400">Total: ${total}</div>

        <div className="flex justify-between">
          <button
            onClick={() => setSellItem(null)}
            className="text-gray-400"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-green-600 px-4 py-2 rounded-xl disabled:opacity-50"
            disabled={isProcessing || !canConfirm}
          >
            {isProcessing ? "Processing..." : "Confirm Sell"}
          </button>
        </div>
      </div>
    </div>
  );
}