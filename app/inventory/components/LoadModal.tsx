import { Product } from "../../../types";

type Props = {
  loadItem: Product | null;
  loadAmount: number;
  loadNote: string;
  setLoadAmount: (amount: number) => void;
  setLoadNote: (note: string) => void;
  setLoadItem: (item: Product | null) => void;
  saveLoad: () => void;
};

export default function LoadModal({
  loadItem,
  loadAmount,
  loadNote,
  setLoadAmount,
  setLoadNote,
  setLoadItem,
  saveLoad,
}: Props) {
  if (!loadItem) return null;

  const isValidQuantity = loadAmount > 0 && loadAmount <= loadItem.stock;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-theme bg-theme-card p-6 shadow-2xl text-theme-primary">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Take from stock for {loadItem.name}</h2>
            <p className="mt-1 text-sm text-theme-secondary">
              Available stock: {loadItem.stock}. Enter quantity to take and optional reason.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoadItem(null)}
            className="rounded-2xl border border-theme bg-theme-input px-3 py-2 text-sm text-theme-secondary transition hover:bg-theme-surface"
          >
            Close
          </button>
        </div>

        <label className="block text-sm text-theme-secondary">
          Quantity to take
          <input
            className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            type="number"
            min={1}
            max={loadItem.stock}
            step={1}
            value={loadAmount}
            onChange={(e) => setLoadAmount(Number(e.target.value))}
            placeholder="Enter quantity to take"
          />
        </label>

        <label className="block text-sm text-theme-secondary mt-4">
          Reason (optional)
          <textarea
            className="mt-2 w-full min-h-25 rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            value={loadNote}
            onChange={(e) => setLoadNote(e.target.value)}
            placeholder="Optional note for this take"
          />
        </label>

        {!isValidQuantity && (
          <p className="mt-3 text-sm text-red-400">
            Quantity must be between 1 and {loadItem.stock}.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setLoadItem(null)}
            className="rounded-2xl border border-theme bg-theme-card px-4 py-3 text-sm font-semibold text-theme-secondary transition hover:bg-theme-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveLoad}
            disabled={!isValidQuantity}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isValidQuantity
                ? "bg-theme-accent text-slate-950 hover:bg-cyan-400"
                : "bg-slate-500 text-slate-200 cursor-not-allowed"
            }`}
          >
            Take from Stock
          </button>
        </div>
      </div>
    </div>
  );
}
