export type SaleIdempotencyItem = {
  product_id: string;
  quantity: number;
  unit?: "base" | "converted";
};

export type SaleIdempotencyRequest = {
  items: SaleIdempotencyItem[];
  order_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  paid?: boolean;
  type?: "sale" | "return";
  refund_reason?: string;
};

function normalizedText(value: string | undefined): string | null {
  return value?.trim() || null;
}

export function canonicalizeSaleRequest(
  request: SaleIdempotencyRequest,
  userId: string,
  role: string,
  orderIdIsGenerated = !request.order_id
) {
  return {
    user_id: userId,
    role,
    items: request.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit || "base",
    })),
    order_id: orderIdIsGenerated ? null : request.order_id ?? null,
    customer_name: normalizedText(request.customer_name),
    customer_address: normalizedText(request.customer_address),
    customer_phone: normalizedText(request.customer_phone),
    paid: request.type === "return" ? true : request.paid !== false,
    type: request.type || "sale",
    refund_reason: normalizedText(request.refund_reason),
  };
}

export function createSaleIdempotencyKey(): string {
  return crypto.randomUUID();
}
