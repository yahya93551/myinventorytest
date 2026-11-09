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

  const { data, error } = await supabaseAdmin.rpc("drop_inventory_take_transaction", {
    p_tenant_id: tenantContext.tenantId,
    p_user_id: tenantContext.userId,
    p_product_id: id,
    p_quantity: quantity,
  });

  if (error) {
    const message = error.message || "Failed to drop taken stock";
    const separator = message.indexOf(":");
    const errorCode = separator > 0 ? message.slice(0, separator) : "";
    const clientMessage = separator > 0 ? message.slice(separator + 1).trim() : message;
    const status = errorCode === "DROP_NOT_FOUND" ? 404
      : errorCode === "DROP_NO_STOCK" || errorCode === "DROP_EXCEEDS_TAKEN" ? 400
      : errorCode === "DROP_CONFLICT" ? 409
      : errorCode === "DROP_INVALID" ? 422
      : 500;
    return jsonError(clientMessage, status);
  }

  const result = data as { stock?: unknown } | null;
  if (!result || typeof result.stock !== "number") {
    return jsonError("Failed to restore product stock", 500);
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
      newStock: result.stock,
    }
  );

  return jsonSuccess({ dropped: quantity, stock: result.stock });
}
