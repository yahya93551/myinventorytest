import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, logAudit, requireActiveSubscription } from "@/lib/api";

const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const SaleMetadataSchema = z.object({
  order_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_address: z.string().optional(),
  customer_phone: z.string().optional(),
  paid: z.boolean().optional(),
});

const SingleSaleSchema = SaleItemSchema.merge(SaleMetadataSchema);
const BulkSaleSchema = z.object({ items: z.array(SaleItemSchema).min(1) }).merge(SaleMetadataSchema);

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "100");
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  let query = supabaseAdmin
    .from("sales")
    .select("id, product_id, product_name, quantity, total, order_id, customer_name, customer_address, customer_phone, paid, user_id, created_by, created_at")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (tenantContext.role === "sales") {
    query = query.eq("user_id", tenantContext.userId);
  }

  const { data, error } = await query;

  if (error) {
    return jsonError(error.message, 500);
  }

  const salesData = (data || []).map((sale: any) => ({
    ...sale,
    date: sale.created_at,
  }));
  const userIds = Array.from(
    new Set(
      salesData
        .map((sale: any) => sale.user_id)
        .filter(Boolean)
    )
  );

  let userEmailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: members, error: membersError } = await supabaseAdmin
      .from("tenant_members")
      .select("user_id, user_email")
      .in("user_id", userIds);

    if (!membersError && members) {
      for (const member of members) {
        if (member?.user_id) {
          userEmailMap[member.user_id] = member.user_email || member.user_id;
        }
      }
    }
  }

  const enrichedSales = salesData.map((sale: any) => ({
    ...sale,
    user_email:
      sale.user_email || userEmailMap[sale.user_id] || sale.user_id || "unknown",
  }));

  return jsonSuccess(enrichedSales);
}

export async function POST(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
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

  const payloadData = salePayload.success ? salePayload.data : singlePayload.data;
  const items = salePayload.success
    ? salePayload.data.items
    : ([singlePayload.data] as Array<z.infer<typeof SaleItemSchema>>);

  const metadata = payloadData as z.infer<typeof SaleMetadataSchema>;
  const orderId = metadata.order_id || `INV-${Date.now()}`;
  const customerName = metadata.customer_name?.trim() || null;
  const customerAddress = metadata.customer_address?.trim() || null;
  const customerPhone = metadata.customer_phone?.trim() || null;
  const isPaid = metadata.paid !== false;

  if (!isPaid && (!customerName || !customerPhone)) {
    return jsonError("Customer name and phone are required for unpaid sales", 422);
  }

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
  const allocationRollback: Array<{ id: string; quantity: number }> = [];
  const productRows: Array<{ id: string; name: string; price: number; quantity: number }> = [];
  const isSalesUser = tenantContext.role === "sales";

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

  const rollbackAllocations = async () => {
    for (const rollbackItem of allocationRollback) {
      const { data: takeRecord, error: takeError } = await supabaseAdmin
        .from("inventory_takes")
        .select("remaining_quantity")
        .eq("id", rollbackItem.id)
        .single();

      if (takeError || !takeRecord) {
        console.error("Sales route: rollback allocation failed to load record", {
          rollbackItem,
          takeError,
        });
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from("inventory_takes")
        .update({ remaining_quantity: takeRecord.remaining_quantity + rollbackItem.quantity })
        .eq("id", rollbackItem.id);

      if (updateError) {
        console.error("Sales route: rollback allocation failed", {
          rollbackItem,
          updateError,
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
      if (allocationRollback.length > 0) {
        await rollbackAllocations();
      }
      return jsonError(productError?.message || "Product not found", 404);
    }

    if (isSalesUser) {
      const { data: allocations, error: allocationsError } = await supabaseAdmin
        .from("inventory_takes")
        .select("id, remaining_quantity")
        .eq("tenant_id", tenantContext.tenantId)
        .eq("user_id", tenantContext.userId)
        .eq("product_id", item.product_id)
        .gt("remaining_quantity", 0)
        .order("created_at", { ascending: true });

      if (allocationsError) {
        if (rollback.length > 0) {
          await rollbackStock();
        }
        if (allocationRollback.length > 0) {
          await rollbackAllocations();
        }
        return jsonError(allocationsError.message, 500);
      }

      const totalAvailable = (allocations || []).reduce((sum: number, allocation: any) => sum + (allocation.remaining_quantity || 0), 0);
      if (totalAvailable < item.quantity) {
        if (rollback.length > 0) {
          await rollbackStock();
        }
        if (allocationRollback.length > 0) {
          await rollbackAllocations();
        }
        return jsonError(`Insufficient taken stock for ${product.name}`, 400);
      }

      let remainingToConsume = item.quantity;
      for (const allocation of allocations || []) {
        if (remainingToConsume <= 0) break;
        const consume = Math.min(allocation.remaining_quantity, remainingToConsume);
        const { error: allocationUpdateError } = await supabaseAdmin
          .from("inventory_takes")
          .update({ remaining_quantity: allocation.remaining_quantity - consume })
          .eq("id", allocation.id);

        if (allocationUpdateError) {
          if (rollback.length > 0) {
            await rollbackStock();
          }
          if (allocationRollback.length > 0) {
            await rollbackAllocations();
          }
          return jsonError(allocationUpdateError.message || "Failed to consume taken stock", 500);
        }

        allocationRollback.push({ id: allocation.id, quantity: consume });
        remainingToConsume -= consume;
      }
    } else {
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
    }

    productRows.push({ id: product.id, name: product.name, price: Number(product.price), quantity: item.quantity });
  }

  const salesRows = productRows.map((product) => ({
    product_id: product.id,
    product_name: product.name,
    quantity: product.quantity,
    total: product.quantity * product.price,
    tenant_id: tenantContext.tenantId,
    user_id: tenantContext.userId,
    created_by: tenantContext.userId,
    order_id: orderId,
    customer_name: customerName,
    customer_address: customerAddress,
    customer_phone: customerPhone,
    paid: isPaid,
  }));

  const fallbackRows = salesRows.map(({ order_id, customer_name, customer_address, customer_phone, created_by, paid, ...rest }) => rest);

  let { data: inserted, error: insertError } = await supabaseAdmin
    .from("sales")
    .insert(salesRows)
    .select("*");

  if (insertError || !inserted) {
    console.error("Sales route: failed to insert sale rows", {
      salesRows,
      insertError,
    });

    const shouldRetryWithoutMeta = insertError?.message?.match(/order_id|customer_name|customer_address|customer_phone|paid/i);
    if (shouldRetryWithoutMeta) {
      console.warn("Sales route: retrying sale insert without invoice/customer metadata");
      const retryResult = await supabaseAdmin
        .from("sales")
        .insert(fallbackRows)
        .select("*");
      inserted = retryResult.data;
      insertError = retryResult.error;
    }

    const missingCreatedBy = insertError?.message?.includes("created_by") ||
      insertError?.code === "PGRST204";

    if (insertError && missingCreatedBy) {
      console.warn("Sales route: retrying sale insert without created_by column");
      const fallbackResult = await supabaseAdmin
        .from("sales")
        .insert(fallbackRows)
        .select("*");

      inserted = fallbackResult.data;
      insertError = fallbackResult.error;
    }
  }

  if (insertError || !inserted) {
    await rollbackStock();
    return jsonError(insertError?.message || "Failed to record sale", 500);
  }

  if (!isPaid) {
    const totalAmount = productRows.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const { data: debtData, error: debtError } = await supabaseAdmin
      .from("debts")
      .insert({
        tenant_id: tenantContext.tenantId,
        user_id: tenantContext.userId,
        created_by: tenantContext.userId,
        customer_name: customerName!,
        customer_phone: customerPhone!,
        amount: totalAmount,
        date: new Date().toISOString(),
        note: `Unpaid sale ${orderId}`,
        paid: false,
      })
      .select("id")
      .single();

    if (debtError || !debtData) {
      console.error("Sales route: failed to create debt for unpaid sale", {
        debtError,
        orderId,
        customerName,
        customerPhone,
      });

      const insertedIds = inserted.map((row: any) => row.id).filter(Boolean);
      if (insertedIds.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from("sales")
          .delete()
          .in("id", insertedIds)
          .eq("tenant_id", tenantContext.tenantId);

        if (deleteError) {
          console.error("Sales route: failed to rollback sale rows after debt failure", { deleteError, insertedIds });
        }
      }

      if (rollback.length > 0) {
        await rollbackStock();
      }
      if (allocationRollback.length > 0) {
        await rollbackAllocations();
      }
      return jsonError(debtError?.message || "Failed to record unpaid sale debt", 500);
    }
  }

  const totalQuantity = productRows.reduce((sum, item) => sum + item.quantity, 0);

  // Log audit trail
  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    "SELL",
    "sale",
    req,
    undefined,
    {
      orderId,
      itemCount: productRows.length,
      totalQuantity,
      items: productRows,
      customerName,
    }
  );

  return jsonSuccess(inserted);
}
