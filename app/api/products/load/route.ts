import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireRole, jsonError, jsonSuccess, logAudit } from "@/lib/api";

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
    .select("tenant_id, stock, name")
    .eq("id", id)
    .single();

  if (productError || !product) {
    return jsonError(productError?.message || "Product not found", 404);
  }

  if (product.tenant_id !== tenantContext.tenantId) {
    return jsonError("You do not have permission to load this product", 403);
  }

  const existingStock = typeof product.stock === "number" ? product.stock : 0;
  if (quantity > existingStock) {
    return jsonError("Cannot take more than available stock", 400);
  }

  const newStock = existingStock - quantity;

  const { data: updatedProduct, error: updateError } = await supabaseAdmin
    .from("products")
    .update({ stock: newStock })
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .gte("stock", quantity)
    .select("stock")
    .single();

  if (updateError || !updatedProduct) {
    return jsonError(updateError?.message || "Failed to update stock", 500);
  }

  const { error: insertTakeError } = await supabaseAdmin.from("inventory_takes").insert({
    tenant_id: tenantContext.tenantId,
    user_id: tenantContext.userId,
    product_id: id,
    product_name: product.name,
    quantity_taken: quantity,
    remaining_quantity: quantity,
    reason: reason || null,
    created_by: tenantContext.userId,
  });

  if (insertTakeError) {
    console.error("Inventory load route: failed to insert allocation record", insertTakeError);
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
      previousStock: existingStock,
      newStock: updatedProduct.stock,
    }
  );

  return jsonSuccess({ stock: updatedProduct.stock });
}
