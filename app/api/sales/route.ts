import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, logAudit, requireActiveSubscription } from "@/lib/api";
import { mapSaleRecord } from "../../../lib/apiMappers";
import { canonicalizeSaleRequest } from "@/lib/saleIdempotency";

const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  // quantity may be in base units or converted units depending on `unit` below
  quantity: z.coerce.number().positive(),
  unit: z.enum(["base", "converted"]).optional(),
});

const SaleMetadataSchema = z.object({
  idempotency_key: z.string().uuid(),
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
  try { payload = await req.json(); } catch { return jsonError("Invalid JSON payload", 400); }

  const salePayload = BulkSaleSchema.safeParse(payload);
  const singlePayload = SingleSaleSchema.safeParse(payload);
  if (!salePayload.success && !singlePayload.success) {
    const errors = [salePayload, singlePayload].flatMap((result) => result.success ? [] : result.error.issues.map((issue) => issue.message)).filter(Boolean);
    return jsonError(errors.join(", "), 422);
  }

  const payloadData = salePayload.success ? salePayload.data : singlePayload.data;
  const items = salePayload.success ? salePayload.data.items : [singlePayload.data!];
  const metadata = payloadData as z.infer<typeof SaleMetadataSchema>;
  const idempotencyKey = metadata.idempotency_key;
  const orderIdIsGenerated = !metadata.order_id;
  const orderId = metadata.order_id || `INV-${Date.now()}`;
  const customerName = metadata.customer_name?.trim() || null;
  const customerAddress = metadata.customer_address?.trim() || null;
  const customerPhone = metadata.customer_phone?.trim() || null;
  const isPaid = metadata.type === "return" ? true : metadata.paid !== false;
  const canonicalRequest = canonicalizeSaleRequest({
    items,
    order_id: metadata.order_id,
    customer_name: metadata.customer_name,
    customer_address: metadata.customer_address,
    customer_phone: metadata.customer_phone,
    paid: metadata.paid,
    type: metadata.type,
    refund_reason: metadata.refund_reason,
  }, tenantContext.userId, tenantContext.role, orderIdIsGenerated);

  if (metadata.type !== "return" && !isPaid && (!customerName || !customerPhone)) {
    return jsonError("Customer name and phone are required for unpaid sales", 422);
  }

  const { data, error } = await supabaseAdmin.rpc("commit_sale_transaction", {
    p_tenant_id: tenantContext.tenantId,
    p_user_id: tenantContext.userId,
    p_role: tenantContext.role,
    p_items: canonicalRequest.items,
    p_order_id: orderId,
    p_customer_name: customerName,
    p_customer_address: customerAddress,
    p_customer_phone: customerPhone,
    p_paid: isPaid,
    p_type: metadata.type || "sale",
    p_refund_reason: metadata.refund_reason || null,
    p_idempotency_key: idempotencyKey,
    p_order_id_is_generated: orderIdIsGenerated,
    p_request_payload: canonicalRequest,
  });

  if (error) {
    const message = error.message || "Failed to complete sale.";
    const separator = message.indexOf(":");
    const errorCode = separator > 0 ? message.slice(0, separator) : "";
    const clientMessage = separator > 0 ? message.slice(separator + 1).trim() : message;
    const status = errorCode === "SALE_NOT_FOUND" ? 404
      : errorCode === "SALE_STOCK" ? 400
      : errorCode === "SALE_INVALID" ? 422
      : errorCode === "SALE_CONFLICT" || errorCode === "SALE_IDEMPOTENCY_CONFLICT" ? 409
      : 500;
    return jsonError(clientMessage, status);
  }

  const rpcResult = data as { result?: unknown; replayed?: boolean } | null;
  const inserted = Array.isArray(rpcResult?.result) ? rpcResult.result as Array<Record<string, unknown>> : [];
  const totalQuantity = inserted.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  if (!rpcResult?.replayed) {
    await logAudit(tenantContext.tenantId, tenantContext.userId, "SELL", "sale", req, undefined, {
      orderId,
      itemCount: inserted.length,
      totalQuantity,
      items: inserted,
      customerName,
    });
  }

  return jsonSuccess(inserted);
}
