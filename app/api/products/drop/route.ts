import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, jsonError, jsonSuccess, logAudit } from "@/lib/api";

const DropSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().positive("Quantity to drop must be greater than zero"),
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

  const parseResult = DropSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id, quantity } = parseResult.data;

  const { data: allocations, error: allocationsError } = await supabaseAdmin
    .from("inventory_takes")
    .select("id, remaining_quantity")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("user_id", tenantContext.userId)
    .eq("product_id", id)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });

  if (allocationsError) {
    return jsonError(allocationsError.message, 500);
  }

  const totalRemaining = (allocations || []).reduce((sum: number, allocation: any) => {
    return sum + (allocation?.remaining_quantity || 0);
  }, 0);

  if (totalRemaining <= 0) {
    return jsonError("No taken stock available to drop", 400);
  }

  if (quantity > totalRemaining) {
    return jsonError("Cannot drop more than the taken quantity", 400);
  }

  let remainingToDrop = quantity;
  const allocationRollbacks: Array<{ id: string; remaining_quantity: number }> = [];

  for (const allocation of allocations || []) {
    if (remainingToDrop <= 0) break;
    const consume = Math.min(allocation.remaining_quantity, remainingToDrop);
    const newRemaining = allocation.remaining_quantity - consume;

    const { error: updateError } = await supabaseAdmin
      .from("inventory_takes")
      .update({ remaining_quantity: newRemaining })
      .eq("id", allocation.id);

    if (updateError) {
      for (const rollback of allocationRollbacks) {
        await supabaseAdmin
          .from("inventory_takes")
          .update({ remaining_quantity: rollback.remaining_quantity })
          .eq("id", rollback.id);
      }
      return jsonError(updateError.message || "Failed to drop taken stock", 500);
    }

    allocationRollbacks.push({ id: allocation.id, remaining_quantity: allocation.remaining_quantity });
    remainingToDrop -= consume;
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("stock")
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (productError || !product) {
    for (const rollback of allocationRollbacks) {
      await supabaseAdmin
        .from("inventory_takes")
        .update({ remaining_quantity: rollback.remaining_quantity })
        .eq("id", rollback.id);
    }
    return jsonError(productError?.message || "Product not found", 404);
  }

  const { data: updatedProduct, error: updateProductError } = await supabaseAdmin
    .from("products")
    .update({ stock: (product.stock || 0) + quantity })
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .select("stock")
    .single();

  if (updateProductError || !updatedProduct) {
    for (const rollback of allocationRollbacks) {
      await supabaseAdmin
        .from("inventory_takes")
        .update({ remaining_quantity: rollback.remaining_quantity })
        .eq("id", rollback.id);
    }
    return jsonError(updateProductError?.message || "Failed to restore product stock", 500);
  }

  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    "DROP",
    "product",
    req,
    id,
    {
      droppedQuantity: quantity,
      newStock: updatedProduct.stock,
    }
  );

  return jsonSuccess({ dropped: quantity, stock: updatedProduct.stock });
}
