import { Product } from "../../../types";

type Props = {
  returnItem: Product | null;
  returnAmount: number | "";
  setReturnAmount: (amount: number | "") => void;
  returnReason: string;
  setReturnReason: (value: string) => void;
  setReturnItem: (item: Product | null) => void;
  saveReturn: () => void;
};

export default function ReturnModal({
  returnItem,
  returnAmount,
  setReturnAmount,
  returnReason,
  setReturnReason,
  setReturnItem,
  saveReturn,
}: Props) {
  if (!returnItem) return null;

  const isValidAmount = typeof returnAmount === "number" && returnAmount > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-theme bg-theme-card p-6 shadow-2xl text-theme-primary">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Return {returnItem.name}</h2>
            <p className="mt-1 text-sm text-theme-secondary">
              Increase inventory stock and record the return reason.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReturnItem(null)}
            className="rounded-2xl border border-theme bg-theme-input px-3 py-2 text-sm text-theme-secondary transition hover:bg-theme-surface"
          >
            Close
          </button>
        </div>

        <label className="block text-sm text-theme-secondary">
          Return quantity
          <input
            className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            type="number"
            min={1}
            step={1}
            value={returnAmount}
            onChange={(e) => setReturnAmount(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Enter quantity to return"
          />
        </label>

        <label className="mt-4 block text-sm text-theme-secondary">
          Return reason (optional)
          <textarea
            className="mt-2 w-full min-h-30 rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Describe why this product was returned"
          />
        </label>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setReturnItem(null)}
            className="rounded-2xl border border-theme bg-theme-card px-4 py-3 text-sm font-semibold text-theme-secondary transition hover:bg-theme-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveReturn}
            disabled={!isValidAmount}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isValidAmount ? "bg-theme-accent text-slate-950 hover:bg-cyan-400" : "bg-slate-500 text-slate-200 cursor-not-allowed"}`}
          >
            Process return
          </button>
        </div>
      </div>
    </div>
  );
}
