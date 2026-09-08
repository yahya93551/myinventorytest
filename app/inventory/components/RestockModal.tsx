import { useEffect, useState } from "react";
import { Product } from "../../../types";

type Props = {
  restockItem: Product | null;
  restockAmount: number | "";
  setRestockAmount: (amount: number | "") => void;
  setRestockItem: (item: Product | null) => void;
  saveRestock: () => Promise<boolean> | boolean;
};

export default function RestockModal({
  restockItem,
  restockAmount,
  setRestockAmount,
  setRestockItem,
  saveRestock,
}: Props) {
  const [restockStatus, setRestockStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  useEffect(() => {
    if (!restockStatus) return;

    const timeoutId = window.setTimeout(() => {
      setRestockStatus(null);
      if (restockStatus.type === "success") {
        setRestockItem(null);
      }
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [restockStatus, setRestockItem]);

  if (!restockItem) return null;

  const isValidAmount = typeof restockAmount === "number" && restockAmount > 0;

  const handleSaveRestock = async () => {
    if (!restockItem) return;

    if (isSubmitting || isCoolingDown) {
      setRestockStatus({ type: "error", text: "Please wait 10 seconds before trying again." });
      return;
    }

    if (!isValidAmount) {
      setRestockStatus({ type: "error", text: "Restock amount must be greater than 0" });
      return;
    }

    setIsSubmitting(true);
    setIsCoolingDown(true);
    setRestockStatus(null);

    const timeoutId = window.setTimeout(() => {
      setIsCoolingDown(false);
    }, 10000);

    try {
      const success = await Promise.resolve(saveRestock());

      if (success) {
        setRestockStatus({
          type: "success",
          text: `${restockItem.name} has been restocked successfully.`,
        });
      } else {
        setRestockStatus({
          type: "error",
          text: `Failed to restock ${restockItem.name}. Please try again.`,
        });
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
      window.setTimeout(() => setIsCoolingDown(false), 10000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-theme bg-theme-card p-6 shadow-2xl text-theme-primary">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Load goods for {restockItem.name}</h2>
            <p className="mt-1 text-sm text-theme-secondary">
              Current stock: {restockItem.stock}. How many units do you want to load?
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRestockItem(null)}
            className="rounded-2xl border border-theme bg-theme-input px-3 py-2 text-sm text-theme-secondary transition hover:bg-theme-surface"
          >
            Close
          </button>
        </div>

        <label className="block text-sm text-theme-secondary">
          Quantity to add
          <input
            className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min={1}
            step={1}
            value={restockAmount}
            onWheel={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "e", "E", "+", "-", ".", ","].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              const raw = e.target.value;

              if (raw === "") {
                setRestockAmount("");
                return;
              }

              const nextValue = raw.replace(/[^0-9]/g, "");
              setRestockAmount(nextValue === "" ? "" : Number(nextValue));
            }}
            placeholder="Enter amount to add"
          />
        </label>

        <p className="mt-3 text-sm text-theme-secondary">
          This only increases stock and keeps the product details unchanged.
        </p>

        {restockStatus && (
          <div
            className={`fixed left-1/2 top-4 z-60 max-w-sm -translate-x-1/2 rounded-xl border px-3 py-2 text-center text-sm font-bold shadow-lg backdrop-blur-sm ${
              restockStatus.type === "success"
                ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                : "border-red-700 bg-red-50 text-red-900"
            }`}
          >
            {restockStatus.text}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setRestockItem(null)}
            className="rounded-2xl border border-theme bg-theme-card px-4 py-3 text-sm font-semibold text-theme-secondary transition hover:bg-theme-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveRestock}
            disabled={!isValidAmount || isSubmitting || isCoolingDown}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${!isValidAmount || isSubmitting || isCoolingDown ? "bg-slate-500 text-slate-200 cursor-not-allowed" : "bg-theme-accent text-slate-950 hover:bg-cyan-400"}`}
          >
            {isSubmitting ? "Loading..." : isCoolingDown ? "Wait 10s" : "Load Goods"}
          </button>
        </div>
      </div>
    </div>
  );
}
