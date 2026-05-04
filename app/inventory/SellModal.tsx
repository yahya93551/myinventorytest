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

  if (!sellItem) return null;

  const now = new Date();
  const formattedDate = now.toLocaleString();
  const total = sellQty * sellItem.price;

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const result = await confirmSell();

      // Only keep modal open if confirmSell explicitly returns false
      // If it returns undefined (void) or true, we assume success and close
      if (result === false) {
        setIsProcessing(false);
        return;
      }

      // Success: close modal
      setSellItem(null);
    } catch (error) {
      console.error("Sale error:", error);
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
          className="p-2 rounded bg-white/10 w-full mb-4"
          type="number"
          min={1}
          max={sellItem.stock}
          value={sellQty}
          onChange={(e) => setSellQty(Number(e.target.value))}
          disabled={isProcessing}
        />

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
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Confirm Sell"}
          </button>
        </div>
      </div>
    </div>
  );
}