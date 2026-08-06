import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, logAudit, requireActiveSubscription } from "@/lib/api";
import { parseMissingSalesColumns, stripMissingSalesColumns } from "../../../lib/salesFallback";
import { mapSaleRecord } from "../../../lib/apiMappers";

const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  // quantity may be in base units or converted units depending on `unit` below
  quantity: z.coerce.number().positive(),
  unit: z.enum(["base", "converted"]).optional(),
});

const SaleMetadataSchema = z.object({
  order_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_address: z.string().optional(),
  customer_phone: z.string().optional(),
  paid: z.boolean().optional(),
  type: z.enum(["sale", "return"]).optional(),
  refund_reason: z.string().optional(),
});

const SingleSaleSchema = SaleItemSchema.merge(SaleMetadataSchema);
const BulkSaleSchema = z.object({ items: z.array(SaleItemSchema).min(1) }).merge(SaleMetadataSchema);

// parseMissingSalesColumns and stripMissingSalesColumns moved to lib/salesFallback.ts

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
  const q = (url.searchParams.get("q") || "").trim();
  const dateFilter = (url.searchParams.get("date") || "").trim();

  let query = supabaseAdmin
    .from("sales")
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (tenantContext.role === "sales") {
    query = query.eq("user_id", tenantContext.userId);
  }

  // Apply server-side query filter if present
  if (q) {
    // Search common searchable fields
    const escaped = q.replace(/[,]/g, " ");
    const textFilters = [
      `product_name.ilike.%${escaped}%`,
      `order_id.ilike.%${escaped}%`,
      `customer_name.ilike.%${escaped}%`,
      `customer_phone.ilike.%${escaped}%`,
    ];

    query = query.or(textFilters.join(","));
  }

  // Filter by exact date (yyyy-mm-dd) if provided
  if (dateFilter) {
    // cast created_at to date string using Postgres date cast via range filter
    query = query.eq("created_at::date", dateFilter as any);
  }

  const { data, error } = await query;

  let salesData: any[] = [];

  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      // Try a minimal fallback select (keep metadata intact if possible)
      const fallbackQuery = supabaseAdmin
        .from("sales")
        .select("*")
        .eq("tenant_id", tenantContext.tenantId)
        .order("created_at", { ascending: false })
        .limit(safeLimit);

      if (tenantContext.role === "sales") {
        fallbackQuery.eq("user_id", tenantContext.userId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        return jsonError(fallbackError.message, 500);
      }
      salesData = (fallbackData || []).map((sale: any) => ({
        ...sale,
        date: sale.created_at,
      }));
    } else {
      return jsonError(error.message, 500);
    }
  } else {
    salesData = (data || []).map((sale: any) => ({
      ...sale,
      date: sale.created_at,
    }));
  }
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

  const enrichedSales = salesData.map((sale: any) => {
    const mappedSale = mapSaleRecord(sale);
    return {
      ...mappedSale,
      user_email: sale.user_email || userEmailMap[sale.user_id] || sale.user_id || "unknown",
    };
  });

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
  const isReturn = metadata.type === "return";
  const orderId = metadata.order_id || `INV-${Date.now()}`;
  const customerName = metadata.customer_name?.trim() || null;
  const customerAddress = metadata.customer_address?.trim() || null;
  const customerPhone = metadata.customer_phone?.trim() || null;
  const isPaid = isReturn ? true : metadata.paid !== false;

  if (!isReturn && !isPaid && (!customerName || !customerPhone)) {
    return jsonError("Customer name and phone are required for unpaid sales", 422);
  }

  // For safety, do not attempt to normalize items before we fetch product conversion metadata.
  // We'll process each item sequentially so we can honor `unit` (base or converted).
  const normalized = items as Array<{ product_id: string; quantity: number; unit?: string }>;

  const rollback: Array<{ id: string; stock: number; stock_remainder?: number }> = [];
  const allocationRollback: Array<{ id: string; quantity: number }> = [];
  const productRows: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: 'base' | 'converted';
    quantity_unit: string;
    lineTotal: number;
  }> = [];
  const isSalesUser = tenantContext.role === "sales";

  const rollbackStock = async () => {
    for (const rollbackItem of rollback) {
      const updatePayload: Record<string, any> = { stock: rollbackItem.stock };
      if (typeof rollbackItem.stock_remainder === "number") {
        updatePayload.stock_remainder = rollbackItem.stock_remainder;
      }

      const { error: rollbackError } = await supabaseAdmin
        .from("products")
        .update(updatePayload)
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
      .select("id, name, price, stock, base_unit, converted_unit, conversion_rate, stock_remainder")
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

    if (isReturn) {
      const unitMode = (item as any).unit === "converted" ? "converted" : "base";
      const conversionRate = typeof product.conversion_rate === "number" && Number.isFinite(product.conversion_rate)
        ? product.conversion_rate
        : null;

      if (unitMode === "converted") {
        if (!conversionRate) {
          return jsonError(`Product ${product.name} does not support converted-unit returns`, 422);
        }

        const existingConverted = (product.stock || 0) * conversionRate + (product.stock_remainder || 0);
        const newConverted = existingConverted + item.quantity;
        const newStock = Math.floor(newConverted / conversionRate);
        const newRemainder = newConverted % conversionRate;

        const { data: updatedProducts, error: updateError } = await supabaseAdmin
          .from("products")
          .update({ stock: newStock, stock_remainder: newRemainder })
          .eq("id", item.product_id)
          .eq("tenant_id", tenantContext.tenantId)
          .select();

        if (updateError || !updatedProducts?.length) {
          console.error("Sales route: failed to restore stock (converted return)", {
            productId: item.product_id,
            tenantId: tenantContext.tenantId,
            quantity: item.quantity,
            updateError,
          });
          return jsonError(updateError?.message || "Failed to restore stock", 500);
        }

        rollback.push({ id: product.id, stock: product.stock });
      } else {
        const newStock = (product.stock || 0) + item.quantity;

        const { data: updatedProducts, error: updateError } = await supabaseAdmin
          .from("products")
          .update({ stock: newStock })
          .eq("id", item.product_id)
          .eq("tenant_id", tenantContext.tenantId)
          .select();

        if (updateError || !updatedProducts?.length) {
          console.error("Sales route: failed to restore stock (return)", {
            productId: item.product_id,
            tenantId: tenantContext.tenantId,
            quantity: item.quantity,
            updateError,
          });
          return jsonError(updateError?.message || "Failed to restore stock", 500);
        }

        rollback.push({ id: product.id, stock: product.stock });
      }
    } else if (isSalesUser) {
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
      // For sales users we expect `item.quantity` to be in base units (legacy behavior).
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
      // Non-sales users can sell in either base or converted units. Honor the `unit` flag.
      const unitMode = (item as any).unit === "converted" ? "converted" : "base";
      const conversionRate = typeof product.conversion_rate === "number" && Number.isFinite(product.conversion_rate)
        ? product.conversion_rate
        : null;

      if (unitMode === "converted") {
        if (!conversionRate) {
          if (rollback.length > 0) {
            await rollbackStock();
          }
          return jsonError(`Product ${product.name} does not support converted-unit sales`, 422);
        }

        const availableInConverted = (product.stock || 0) * conversionRate + (product.stock_remainder || 0);
        if ((item.quantity) > availableInConverted) {
          if (rollback.length > 0) {
            await rollbackStock();
          }
          return jsonError(`Insufficient stock for ${product.name}`, 400);
        }

        // Compute new totals after selling `item.quantity` converted units
        const remainingConverted = availableInConverted - item.quantity;
        const newStock = Math.floor(remainingConverted / conversionRate);
        const newRemainder = remainingConverted % conversionRate;

        const { data: updatedProducts, error: updateError } = await supabaseAdmin
          .from("products")
          .update({ stock: newStock, stock_remainder: newRemainder })
          .eq("id", item.product_id)
          .eq("tenant_id", tenantContext.tenantId)
          .gte("stock", 0)
          .select();

        if (updateError || !updatedProducts?.length) {
          console.error("Sales route: failed to reserve stock (converted)", {
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
      } else {
        // base unit sale (legacy behavior)
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
    }

    const unitMode = isReturn
      ? (item.unit === "converted" ? "converted" : "base")
      : isSalesUser
        ? "base"
        : item.unit === "converted"
          ? "converted"
          : "base";
    const unitLabel = unitMode === "converted"
      ? product.converted_unit?.trim() || "converted unit"
      : product.base_unit?.trim() || "base unit";
    const conversionRate = typeof product.conversion_rate === "number" && Number.isFinite(product.conversion_rate)
      ? product.conversion_rate
      : null;

    let lineTotal = item.quantity * Number(product.price);
    if (unitMode === "converted" && conversionRate) {
      const baseQuantity = item.quantity / conversionRate;
      lineTotal = baseQuantity * Number(product.price);
    }

    if (isReturn) {
      lineTotal = -Math.abs(lineTotal);
    }

    productRows.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: item.quantity,
      unit: unitMode,
      quantity_unit: unitLabel,
      lineTotal,
    });
  }

  const salesRows = productRows.map((product) => ({
    product_id: product.id,
    product_name: product.name,
    quantity: product.quantity,
    type: metadata.type || "sale",
    ...(metadata.type === "return"
      ? { refund_reason: metadata.refund_reason || null }
      : {}),
    unit: product.unit,
    quantity_unit: product.quantity_unit,
    total: product.lineTotal,
    tenant_id: tenantContext.tenantId,
    user_id: tenantContext.userId,
    created_by: tenantContext.userId,
    order_id: orderId,
    customer_name: customerName,
    customer_address: customerAddress,
    customer_phone: customerPhone,
    paid: isPaid,
  }));

  // Try first insert
  let { data: inserted, error: insertError } = await supabaseAdmin
    .from("sales")
    .insert(salesRows)
    .select("*");

  if (insertError || !inserted) {
    console.error("Sales route: failed to insert sale rows", {
      salesRows,
      insertError,
    });

    // If DB reports missing columns, attempt a targeted retry that only strips the reported missing columns.
    const missingColumns = parseMissingSalesColumns(insertError);
    if (missingColumns.length > 0) {
      console.warn("Sales route: retrying sale insert without missing sales columns", missingColumns);
      const fallbackSalesRows = salesRows.map((row) => stripMissingSalesColumns(row, missingColumns));
      const fallbackResult = await supabaseAdmin
        .from("sales")
        .insert(fallbackSalesRows)
        .select("*");

      inserted = fallbackResult.data;
      insertError = fallbackResult.error;
    }

    // Special-case: if the error mentions `created_by`, attempt to insert without it (some older schemas lack it).
    if ((insertError && /created_by/i.test(insertError.message)) && !inserted) {
      console.warn("Sales route: retrying sale insert without created_by column");
      const fallbackRowsWithoutCreatedBy = salesRows.map(({ created_by, ...rest }) => rest);
      const fallbackResult = await supabaseAdmin
        .from("sales")
        .insert(fallbackRowsWithoutCreatedBy)
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
