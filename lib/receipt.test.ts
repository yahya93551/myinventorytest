import { describe, expect, it } from 'vitest';
import { generateReceiptHtml } from './receipt';

describe('generateReceiptHtml', () => {
  it('includes fixed column headers and renders a line item correctly', () => {
    const html = generateReceiptHtml(
      {
        businessName: 'Test Shop',
        businessAddress: '123 Market St',
        businessContact: '555-1234',
        invoiceNumber: 'INV-100',
        date: '2026-07-04',
        customerName: 'John Doe',
        customerPhone: '+123456789',
        title: 'Receipt',
      },
      [{ description: 'Product A', quantity: 2, unitPrice: 5.5, total: 11 }]
    );

    expect(html).toContain('<th class="no-col">No</th>');
    expect(html).toContain('<th class="description-col">Item Description</th>');
    expect(html).toContain('<th class="qty-col">Qty</th>');
    expect(html).toContain('<th class="value-right">Unit Price</th>');
    expect(html).toContain('<th class="value-right">Total</th>');
    expect(html).toContain('Product A');
    expect(html).toContain('$11.00');
  });
});
