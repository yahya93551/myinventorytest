import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, jsonError, jsonSuccess, logAudit } from "@/lib/api";

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
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (productError || !product) {
    return jsonError(productError?.message || "Product not found", 404);
  }

  if (product.tenant_id !== tenantContext.tenantId) {
    return jsonError("You do not have permission to restock this product", 403);
  }

  const { data, error: restockError } = await supabaseAdmin.rpc("restock_inventory_stock_transaction", {
    p_tenant_id: tenantContext.tenantId,
    p_product_id: id,
    p_amount: amount,
  });

  if (restockError) {
    const message = restockError.message || "Failed to restock product";
    const separator = message.indexOf(":");
    const errorCode = separator > 0 ? message.slice(0, separator) : "";
    const clientMessage = separator > 0 ? message.slice(separator + 1).trim() : message;
    const status = errorCode === "RESTOCK_NOT_FOUND" ? 404
      : errorCode === "RESTOCK_INVALID" ? 422
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
    "RESTOCK",
    "product",
    req,
    id,
    {
      amount,
      previousStock: result.previous_stock,
      newStock: result.stock,
    }
  );

  return jsonSuccess({ stock: result.stock });
}
