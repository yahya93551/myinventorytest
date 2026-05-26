import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireRole, jsonError, jsonSuccess, logAudit } from "@/lib/api";

const RestockSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int().positive("Restock amount must be greater than zero"),
});

export async function POST(req: Request) {
  // Require owner role
  const tenantContextOrError = await requireRole(req, ["owner"]);
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

  const parseResult = RestockSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id, amount } = parseResult.data;

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("tenant_id, stock")
    .eq("id", id)
    .single();

  if (productError || !product) {
    return jsonError(productError?.message || "Product not found", 404);
  }

  if (product.tenant_id !== tenantContext.tenantId) {
    return jsonError("You do not have permission to restock this product", 403);
  }

  const newStock = (typeof product.stock === "number" ? product.stock : 0) + amount;

  const { data: updatedProduct, error: updateError } = await supabaseAdmin
    .from("products")
    .update({ stock: newStock })
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .select("stock")
    .single();

  if (updateError || !updatedProduct) {
    return jsonError(updateError?.message || "Failed to update stock", 500);
  }

  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    "RESTOCK",
    "product",
    req,
    id,
    {
      amount,
      previousStock: product.stock,
      newStock: updatedProduct.stock,
    }
  );

  return jsonSuccess({ stock: updatedProduct.stock });
}
