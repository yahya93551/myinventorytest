import { Product } from "../../../types";

type Props = {
  dropItem: Product | null;
  dropAmount: number | "";
  setDropAmount: (amount: number | "") => void;
  setDropItem: (item: Product | null) => void;
  saveDrop: () => void;
};

export default function DropModal({
  dropItem,
  dropAmount,
  setDropAmount,
  setDropItem,
  saveDrop,
}: Props) {
  if (!dropItem) return null;

  const available = dropItem.allocated_quantity ?? 0;
  const isValidQuantity = typeof dropAmount === "number" && dropAmount > 0 && dropAmount <= available;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-theme bg-theme-card p-6 shadow-2xl text-theme-primary">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Drop taken stock for {dropItem.name}</h2>
            <p className="mt-1 text-sm text-theme-secondary">
              You have taken {available} item{available === 1 ? "" : "s"}. Enter how many to return to inventory.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDropItem(null)}
            className="rounded-2xl border border-theme bg-theme-input px-3 py-2 text-sm text-theme-secondary transition hover:bg-theme-surface"
          >
            Close
          </button>
        </div>

        <label className="block text-sm text-theme-secondary">
          Quantity to drop
          <input
            className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            type="number"
            min={1}
            max={available}
            step={1}
            value={dropAmount}
            onChange={(e) => setDropAmount(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Enter quantity to drop"
          />
        </label>

        {!isValidQuantity && (
          <p className="mt-3 text-sm text-red-400">
            Quantity must be between 1 and {available}.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setDropItem(null)}
            className="rounded-2xl border border-theme bg-theme-card px-4 py-3 text-sm font-semibold text-theme-secondary transition hover:bg-theme-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveDrop}
            disabled={!isValidQuantity}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isValidQuantity
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-slate-500 text-slate-200 cursor-not-allowed"
            }`}
          >
            Drop taken stock
          </button>
        </div>
      </div>
    </div>
  );
}
