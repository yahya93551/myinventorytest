import { useEffect, useState } from "react";
import { Product } from "../../types";
import { useBusinessSettings } from "@/hooks/useCustomFields";
import { countryOptions, normalizePhoneNumber, isPhoneNumber, splitPhoneNumber } from "@/lib/auth";

type SaleMeta = {
  order_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  paid?: boolean;
};

type Props = {
  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  confirmSell: (metadata?: SaleMeta) => Promise<boolean | void> | void;
  tenantRole: string;
};

export default function SellModal({
  sellItem,
  sellQty,
  setSellQty,
  setSellItem,
  confirmSell,
  tenantRole,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printAfterSale, setPrintAfterSale] = useState(false);
  const [orderId, setOrderId] = useState(() => `INV-${Date.now()}`);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+252");
  const [isPaidSale, setIsPaidSale] = useState(true);

  const { data: businessSettings } = useBusinessSettings();

  useEffect(() => {
    if (sellItem) {
      setOrderId(`INV-${Date.now()}`);
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
      setCountryCode("+252");
      setPrintAfterSale(false);
      setIsPaidSale(true);
      setError(null);
    }
  }, [sellItem]);

  if (!sellItem) return null;

  const now = new Date();
  const formattedDate = now.toLocaleString("so-SO", {
    timeZone: "Africa/Mogadishu",
  });
  const availableToSell = tenantRole === "sales" ? sellItem.allocated_quantity ?? 0 : sellItem.stock;
  const total = sellQty * sellItem.price;
  const canConfirm = sellQty >= 1 && sellQty <= availableToSell;

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
            <h3>Business Information</h3>
            <p><strong>Name:</strong> ${businessSettings?.business_name || "-"}</p>
            <p><strong>Address:</strong> ${businessSettings?.business_address || "-"}</p>
            <p><strong>Contact:</strong> ${businessSettings?.business_contact_phone || businessSettings?.business_contact_email || "-"}</p>
            <hr />
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

  const handleConfirm = async () => {
    if (isProcessing) return;
    if (!canConfirm) {
      setError("Please enter a valid quantity within available stock.");
      return;
    }

    const rawPhone = customerPhone.trim();
    const phoneValue = rawPhone.startsWith("+") ? rawPhone : `${countryCode}${rawPhone}`;

    if (!isPaidSale && (!customerName.trim() || !rawPhone)) {
      setError("Customer name and phone are required for unpaid sales.");
      return;
    }

    if (rawPhone && !isPhoneNumber(phoneValue)) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await confirmSell({
        order_id: orderId,
        customer_name: customerName || undefined,
        customer_address: customerAddress || undefined,
        customer_phone: rawPhone ? normalizePhoneNumber(phoneValue) : undefined,
        paid: isPaidSale,
      });

      if (result === false) {
        setError("Sale could not be completed. Please verify the quantity and try again.");
        return;
      }

      if (printAfterSale) {
        printReceipt();
      }

      setSellItem(null);
    } catch (error) {
      console.error("Sale error:", error);
      const message = error instanceof Error ? error.message : "Unable to complete sale. Please try again.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 overflow-y-auto px-4 py-6 flex items-center justify-center z-50">
      <div className="border border-theme bg-theme-card p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-theme-primary">
        <h2 className="text-xl mb-2">Sell Product</h2>
        <p className="text-theme-secondary mb-1">
          {sellItem.name} — Available: {availableToSell}
        </p>
        <p className="text-xs text-theme-secondary mb-3">Date: {formattedDate}</p>

        <div className="mb-4 rounded-2xl border border-theme p-3 bg-theme-surface text-theme-primary">
          <p className="text-sm font-semibold mb-2">Invoice & Customer</p>
          <p className="text-xs text-theme-secondary mb-2">Invoice #: {orderId}</p>
          <p className="text-xs text-theme-secondary mb-3">
            {tenantRole === "sales"
              ? "You can only sell the quantity you have taken from stock."
              : "Enter invoice details and confirm the sale."}
          </p>
          <div className="mb-3 text-sm text-theme-primary">
            Available to sell: {availableToSell}
          </div>
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
            <div className="mt-1 flex gap-2">
              <select
                className="w-24 rounded bg-slate-950 px-3 py-2 text-slate-100"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isProcessing}
              >
                {countryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.code}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 rounded bg-theme-input px-3 py-2 text-theme-primary"
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={isProcessing}
                placeholder="Phone number"
              />
            </div>
          </label>
          <div className="mt-4 rounded-2xl border border-theme bg-theme-surface p-3">
            <p className="text-sm font-semibold text-theme-primary mb-2">Payment status</p>
            <div className="flex flex-wrap gap-4 text-sm text-theme-secondary">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="salePaid"
                  value="paid"
                  checked={isPaidSale}
                  disabled={isProcessing}
                  onChange={() => setIsPaidSale(true)}
                  className="h-4 w-4 rounded border-theme bg-theme-input"
                />
                Paid
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="salePaid"
                  value="unpaid"
                  checked={!isPaidSale}
                  disabled={isProcessing}
                  onChange={() => setIsPaidSale(false)}
                  className="h-4 w-4 rounded border-theme bg-theme-input"
                />
                Pay later (create debt)
              </label>
            </div>
            {!isPaidSale && (
              <p className="mt-2 text-xs text-amber-300">
                Customer name and phone number are required for unpaid sales.
              </p>
            )}
          </div>
        </div>

        <input
          className="p-2 rounded bg-theme-input w-full mb-2 text-theme-primary"
          type="number"
          min={1}
          max={availableToSell}
          value={sellQty}
          onChange={(e) => {
            const value = Number(e.target.value);
            const nextQty = Number.isNaN(value)
              ? 1
              : Math.max(1, Math.min(value, availableToSell));

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
          Enter a quantity between 1 and {availableToSell}.
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
            disabled={isProcessing || !canConfirm}
          >
            {isProcessing ? "Processing..." : "Confirm Sell"}
          </button>
        </div>
      </div>
    </div>
  );
}