import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";

const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const SingleSaleSchema = SaleItemSchema;
const BulkSaleSchema = z.object({ items: z.array(SaleItemSchema).min(1) });

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "200");

  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("id, product_id, product_name, quantity, total, created_at, user_id")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data ?? []);
}

export async function POST(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  if (!["owner", "sales"].includes(tenantContext.role)) {
    return jsonError("Only owners or sales users can record sales", 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const salePayload = BulkSaleSchema.safeParse(payload);
  const singlePayload = SingleSaleSchema.safeParse(payload);

  if (!salePayload.success && !singlePayload.success) {
    const errors = [salePayload, singlePayload]
      .flatMap((result) =>
        result.success ? [] : result.error.issues.map((issue) => issue.message)
      )
      .filter(Boolean);
    return jsonError(errors.join(", "), 422);
  }

  const items = salePayload.success
    ? salePayload.data.items
    : ([singlePayload.data] as Array<z.infer<typeof SaleItemSchema>>);

  const normalized = items.reduce<Array<{ product_id: string; quantity: number }>>(
    (acc, item: { product_id: string; quantity: number }) => {
      const existing = acc.find((entry) => entry.product_id === item.product_id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        acc.push({ ...item });
      }
      return acc;
    },
    []
  );

  const rollback: Array<{ id: string; stock: number }> = [];
  const productRows: Array<{ id: string; name: string; price: number; quantity: number }> = [];

  const rollbackStock = async () => {
    for (const rollbackItem of rollback) {
      const { error: rollbackError } = await supabaseAdmin
        .from("products")
        .update({ stock: rollbackItem.stock })
        .eq("id", rollbackItem.id)
        .eq("tenant_id", tenantContext.tenantId);

      if (rollbackError) {
        console.error("Sales route: rollback stock failed", {
          rollbackItem,
          rollbackError,
        });
      }
    }
  };

  for (const item of normalized) {
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock")
      .eq("id", item.product_id)
      .eq("tenant_id", tenantContext.tenantId)
      .single();

    if (productError || !product) {
      if (rollback.length > 0) {
        await rollbackStock();
      }
      return jsonError(productError?.message || "Product not found", 404);
    }

    if (product.stock < item.quantity) {
      if (rollback.length > 0) {
        await rollbackStock();
      }
      return jsonError(`Insufficient stock for ${product.name}`, 400);
    }

    const { data: updatedProducts, error: updateError } = await supabaseAdmin
      .from("products")
      .update({ stock: product.stock - item.quantity })
      .eq("id", item.product_id)
      .eq("tenant_id", tenantContext.tenantId)
      .gte("stock", item.quantity)
      .select();

    if (updateError || !updatedProducts?.length) {
      console.error("Sales route: failed to reserve stock", {
        productId: item.product_id,
        tenantId: tenantContext.tenantId,
        quantity: item.quantity,
        updateError,
      });
      if (rollback.length > 0) {
        await rollbackStock();
      }
      return jsonError(updateError?.message || "Failed to reserve stock", 500);
    }

    rollback.push({ id: product.id, stock: product.stock });
    productRows.push({ id: product.id, name: product.name, price: Number(product.price), quantity: item.quantity });
  }

  const salesRows = productRows.map((product) => ({
    product_id: product.id,
    product_name: product.name,
    quantity: product.quantity,
    total: product.quantity * product.price,
    tenant_id: tenantContext.tenantId,
    user_id: tenantContext.userId,
  }));

  let { data: inserted, error: insertError } = await supabaseAdmin
    .from("sales")
    .insert(salesRows)
    .select("id, product_id, product_name, quantity, total, created_at, user_id");

  if (insertError || !inserted) {
    console.error("Sales route: failed to insert sale rows", {
      salesRows,
      insertError,
    });

    const missingCreatedBy = insertError?.message?.includes("created_by") ||
      insertError?.code === "PGRST204";

    if (missingCreatedBy) {
      console.warn("Sales route: retrying sale insert without created_by column");
      const fallbackRows = salesRows;
      const fallbackResult = await supabaseAdmin
        .from("sales")
        .insert(fallbackRows)
        .select("id, product_id, product_name, quantity, total, created_at, user_id");

      inserted = fallbackResult.data;
      insertError = fallbackResult.error;
    }
  }

  if (insertError || !inserted) {
    await rollbackStock();
    return jsonError(insertError?.message || "Failed to record sale", 500);
  }

  return jsonSuccess(inserted);
}
