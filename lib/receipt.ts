export type ReceiptItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ReceiptMeta = {
  businessName?: string;
  businessAddress?: string;
  businessContact?: string;
  invoiceNumber: string;
  date: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  title?: string;
};

function formatMoney(value: number) {
  return value.toFixed(2);
}

export function generateReceiptHtml(meta: ReceiptMeta, items: ReceiptItem[]) {
  const businessName = meta.businessName?.trim() || "Business";
  const businessAddress = meta.businessAddress?.trim() || "";
  const businessContact = meta.businessContact?.trim() || "";
  const invoiceNumber = meta.invoiceNumber || "-";
  const date = meta.date || "";
  const customerName = meta.customerName?.trim() || "Walk-in Customer";
  const customerAddress = meta.customerAddress?.trim() || "";
  const customerPhone = meta.customerPhone?.trim() || "";
  const title = meta.title || "Sale Invoice";

  const rows = items
    .map(
      (item, index) =>
        `<tr>
          <td class="no-col">${index + 1}</td>
          <td class="description-col">${item.description}</td>
          <td class="qty-col">${item.quantity}</td>
          <td class="unit-col value-right">$${formatMoney(item.unitPrice)}</td>
          <td class="total-col value-right">$${formatMoney(item.total)}</td>
        </tr>`
    )
    .join("");

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  return `
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            body { font-family: Arial, sans-serif; padding: 6px 4px; color: #111; width: 68mm; max-width: 100%; font-size: 10px; line-height: 1.2; word-wrap: break-word; }
            h1 { font-size: 13px; margin: 0 0 6px; text-align: center; }
            .section { margin-bottom: 6px; }
            .details p { margin: 2px 0; }
            .divider { border-top: 1px dashed #999; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
            th, td { padding: 2px 0; vertical-align: top; font-size: 9px; word-break: break-word; }
            th { text-align: left; font-weight: 600; }
            .no-col { width: 8%; text-align: left; }
            .description-col { width: 42%; text-align: left; padding-right: 4px; }
            .qty-col { width: 12%; text-align: center; }
            .unit-col { width: 18%; text-align: right; padding-right: 4px; }
            .total-col { width: 20%; text-align: right; padding-right: 4px; }
            .value-right { text-align: right; padding-right: 4px; }
            .footer-row td { font-size: 10px; font-weight: 700; padding-top: 6px; }
          </style>
        </head>
        <body>
          <h1>${businessName}</h1>
          <div class="section details">
            ${businessAddress ? `<p>${businessAddress}</p>` : ""}
            ${businessContact ? `<p>${businessContact}</p>` : ""}
          </div>
          <div class="divider"></div>
          <div class="section details">
            <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            ${customerAddress ? `<p><strong>Address:</strong> ${customerAddress}</p>` : ""}
            ${customerPhone ? `<p><strong>Phone:</strong> ${customerPhone}</p>` : ""}
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th class="no-col">No</th>
                <th class="description-col">Item Description</th>
                <th class="qty-col">Qty</th>
                <th class="value-right">Unit Price</th>
                <th class="value-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr class="footer-row">
                <td colspan="4"><strong>Grand Total</strong></td>
                <td class="value-right"><strong>$${formatMoney(grandTotal)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;
}

export function printReceiptHtml(html: string, existingWindow?: Window | null) {
  if (typeof window === "undefined") return;

  const printWindow =
    existingWindow && !existingWindow.closed
      ? existingWindow
      : window.open("", "_blank", "width=600,height=800");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
