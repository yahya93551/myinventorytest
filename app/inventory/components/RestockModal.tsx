import { Product } from "../../../types";

type Props = {
  restockItem: Product | null;
  restockAmount: number;
  setRestockAmount: (amount: number) => void;
  setRestockItem: (item: Product | null) => void;
  saveRestock: () => void;
};

export default function RestockModal({
  restockItem,
  restockAmount,
  setRestockAmount,
  setRestockItem,
  saveRestock,
}: Props) {
  if (!restockItem) return null;

  const isValidAmount = restockAmount > 0;

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
            type="number"
            min={1}
            step={1}
            value={restockAmount}
            onChange={(e) => setRestockAmount(Number(e.target.value))}
            placeholder="Enter amount to add"
          />
        </label>

        <p className="mt-3 text-sm text-theme-secondary">
          This only increases stock and keeps the product details unchanged.
        </p>

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
            onClick={saveRestock}
            disabled={!isValidAmount}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isValidAmount ? "bg-theme-accent text-slate-950 hover:bg-cyan-400" : "bg-slate-500 text-slate-200 cursor-not-allowed"}`}
          >
            Load Goods
          </button>
        </div>
      </div>
    </div>
  );
}
