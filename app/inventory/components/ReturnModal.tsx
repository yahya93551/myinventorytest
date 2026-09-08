import { useEffect, useState } from "react";
import { Product, Sale } from "../../../types";

type ReturnContext = {
  invoiceNumber?: string;
  customerName?: string;
  returnDate?: string;
};

type Props = {
  returnItem: Product | null;
  returnAmount: number | "";
  setReturnAmount: (amount: number | "") => void;
  returnReason: string;
  setReturnReason: (value: string) => void;
  setReturnItem: (item: Product | null) => void;
  saveReturn: () => Promise<void> | void;
  saleContext?: Sale | null;
  returnContext?: ReturnContext;
};

export default function ReturnModal({
  returnItem,
  returnAmount,
  setReturnAmount,
  returnReason,
  setReturnReason,
  setReturnItem,
  saveReturn,
  saleContext,
  returnContext,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalStatus, setModalStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!modalStatus) return;

    const timeoutId = window.setTimeout(() => {
      setModalStatus(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [modalStatus]);

  if (!returnItem) return null;

  const isValidAmount = typeof returnAmount === "number" && Number.isFinite(returnAmount) && returnAmount > 0;
  const enteredQuantity = isValidAmount ? returnAmount : 0;
  const invoiceNumber =
    saleContext?.orderId ||
    saleContext?.order_id ||
    returnContext?.invoiceNumber ||
    "No sale record";
  const customerName =
    saleContext?.customerName ||
    saleContext?.customer_name ||
    returnContext?.customerName ||
    "Customer not available";
  const returnDate =
    saleContext?.createdAt ||
    saleContext?.date ||
    returnContext?.returnDate ||
    new Date().toLocaleString();
  const unitLabel =
    saleContext?.unit === "converted"
      ? saleContext?.quantityUnit || saleContext?.quantity_unit || returnItem.converted_unit?.trim() || "converted unit"
      : saleContext?.quantityUnit || saleContext?.quantity_unit || returnItem.base_unit?.trim() || "base unit";
  const hasSaleContext = Boolean(
    saleContext ||
    (returnContext?.invoiceNumber && returnContext.invoiceNumber !== "No sale record") ||
    (returnContext?.customerName && returnContext.customerName !== "Customer not available")
  );
  const totalAmount = Number(returnItem.price || 0) * enteredQuantity;
  const canSubmit = isValidAmount && !isProcessing;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setModalStatus(null);

    try {
      await saveReturn();
      setModalStatus({
        type: "success",
        text: `${returnItem.name} has been returned to inventory.`,
      });
    } catch {
      setModalStatus({
        type: "error",
        text: "Unable to process this return. Please check the quantity and try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 overflow-y-auto px-4 py-6 flex items-center justify-center z-50">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-theme-card p-6 shadow-2xl text-theme-primary">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Return product</h2>
            <p className="mt-1 text-sm text-theme-secondary">{returnItem.name}</p>
          </div>
          <span className="rounded-full border border-amber-700 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900">
            Return
          </span>
        </div>
        <p className="mb-3 text-xs text-theme-secondary">Return date: {returnDate}</p>

        <div className="mb-4 rounded-2xl border border-theme bg-theme-surface/80 p-3 text-theme-primary shadow-inner">
          <p className="mb-2 text-sm font-semibold">Sale summary</p>
          <p className="text-xs text-theme-secondary mb-2">
            Invoice: {invoiceNumber}
          </p>
          <p className="text-xs text-theme-secondary mb-3">
            Customer: {customerName}
          </p>
          <p className="text-xs text-theme-secondary mb-3">
            Return unit: {unitLabel}
          </p>
          {!hasSaleContext && (
            <p className="mb-3 text-[11px] text-amber-300">
              No matching sale record was found. You can still continue with the return if the quantity is valid.
            </p>
          )}
          <div className="mb-3 text-sm text-theme-primary">Product: {returnItem.name}</div>
          <div className="grid grid-cols-2 gap-3 text-xs text-theme-secondary">
            <div>
              <span className="block text-theme-secondary">Qty</span>
              <span className="font-semibold text-theme-primary">{enteredQuantity}</span>
            </div>
            <div>
              <span className="block text-theme-secondary">Total</span>
              <span className="font-semibold text-theme-primary">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <label className="block text-sm text-theme-secondary">
          Quantity to return ({unitLabel})
          <input
            className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={returnAmount}
            onChange={(e) => setReturnAmount(e.target.value === "" ? "" : Number(e.target.value))}
            onWheel={(e) => e.currentTarget.blur()}
            onKeyDown={(e) => {
              if (["ArrowUp", "ArrowDown", "e", "E", "+", "-"].includes(e.key)) {
                e.preventDefault();
              }
            }}
            placeholder="Enter quantity"
            disabled={isProcessing}
          />
        </label>

        <p className="mt-2 text-xs text-theme-secondary">
          This will add the selected quantity back into stock and save the return reason.
        </p>

        <label className="mt-4 block text-sm text-theme-secondary">
          Return reason (optional)
          <textarea
            className="mt-2 w-full min-h-28 rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Describe why this product was returned"
            disabled={isProcessing}
          />
        </label>

        <div className="mt-5 flex justify-between">
          <button
            type="button"
            onClick={() => setReturnItem(null)}
            disabled={isProcessing}
            className="rounded-xl border border-theme px-3 py-2 text-sm text-theme-secondary transition hover:bg-theme-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              !canSubmit
                ? "bg-slate-500 text-slate-200 cursor-not-allowed"
                : "bg-theme-accent text-slate-950 hover:bg-cyan-400"
            }`}
          >
            {isProcessing ? "Processing return..." : "Confirm return"}
          </button>
        </div>
      </div>

      {modalStatus && (
        <div
          className={`fixed left-1/2 top-4 z-60 max-w-sm -translate-x-1/2 rounded-xl border border-opacity-80 px-3 py-2 text-center text-sm font-bold shadow-lg backdrop-blur-sm ${
            modalStatus.type === "success" ? "toast-success" : "toast-error"
          }`}
        >
          {modalStatus.text}
        </div>
      )}
    </div>
  );
}
