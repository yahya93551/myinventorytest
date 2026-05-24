import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") || "20")));
  const offset = (page - 1) * perPage;
  
  // Optional filters
  const action = url.searchParams.get("action"); // CREATE, SELL, LOAD, RESTOCK, BULK_CREATE, UPDATE, DELETE, LOGIN, LOGOUT
  const entity = url.searchParams.get("entity"); // product, sale, user, etc
  const performedBy = url.searchParams.get("performed_by");

  try {
    let query = supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantContext.tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    // Apply optional filters
    if (action) {
      query = query.eq("action", action.toUpperCase());
    }
    if (entity) {
      query = query.eq("entity", entity);
    }
    if (performedBy) {
      query = query.eq("performed_by", performedBy);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/activity] Database error:", error);
      return jsonError(error.message, 500);
    }

    // Enhance the response with user information if available
    const enrichedData = data ?? [];

    return jsonSuccess({
      activities: enrichedData,
      count: count ?? 0,
      page,
      perPage,
      totalPages: Math.ceil((count ?? 0) / perPage),
    });
  } catch (err) {
    console.error("[GET /api/activity] Unexpected error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to fetch activity logs",
      500
    );
  }
}
