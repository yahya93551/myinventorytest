import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, jsonError, jsonSuccess, logAudit, requireActiveSubscription } from "@/lib/api";

const LoadSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().positive("Quantity to take must be greater than zero"),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner", "accountant", "sales"]);
  if ("error" in tenantContextOrError) {
    return jsonError(tenantContextOrError.error, tenantContextOrError.status);
  }
  const tenantContext = tenantContextOrError;

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = LoadSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id, quantity, reason } = parseResult.data;

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (productError || !product) {
    return jsonError(productError?.message || "Product not found", 404);
  }

  if (product.tenant_id !== tenantContext.tenantId) {
    return jsonError("You do not have permission to load this product", 403);
  }

  const { data, error: loadError } = await supabaseAdmin.rpc("load_inventory_stock_transaction", {
    p_tenant_id: tenantContext.tenantId,
    p_user_id: tenantContext.userId,
    p_product_id: id,
    p_quantity: quantity,
    p_reason: reason || null,
  });

  if (loadError) {
    const message = loadError.message || "Failed to take stock";
    const separator = message.indexOf(":");
    const errorCode = separator > 0 ? message.slice(0, separator) : "";
    const clientMessage = separator > 0 ? message.slice(separator + 1).trim() : message;
    const status = errorCode === "LOAD_NOT_FOUND" ? 404
      : errorCode === "LOAD_STOCK" ? 400
      : errorCode === "LOAD_INVALID" ? 422
      : 500;
    return jsonError(clientMessage, status);
  }

  const result = data as { stock?: unknown; previous_stock?: unknown } | null;
  if (!result || typeof result.stock !== "number") {
    return jsonError("Failed to update stock", 500);
  }

  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    "TAKE",
    "product",
    req,
    id,
    {
      quantity,
      reason,
      previousStock: result.previous_stock,
      newStock: result.stock,
    }
  );

  return jsonSuccess({ stock: result.stock });
}
