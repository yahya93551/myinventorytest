import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  // Only owners can view activity logs
  if (tenantContext.role !== 'owner') {
    return jsonError('Forbidden: only tenant owners can view activity logs', 403);
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

    // Support filtering by performer ID or email
    if (performedBy) {
      if (performedBy.includes("@")) {
        // map email -> user_id(s) from tenant_members
        const { data: membersByEmail, error: membersError } = await supabaseAdmin
          .from('tenant_members')
          .select('user_id')
          .eq('user_email', performedBy)
          .eq('tenant_id', tenantContext.tenantId);

        if (!membersError && membersByEmail && membersByEmail.length > 0) {
          const ids = membersByEmail.map((m: any) => m.user_id);
          query = query.in('performed_by', ids);
        } else {
          // No matching user email for this tenant -> return empty result
          return jsonSuccess({ activities: [], count: 0, page, perPage, totalPages: 0 });
        }
      } else {
        query = query.eq("performed_by", performedBy);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/activity] Database error:", error);
      return jsonError(error.message, 500);
    }

    // Enhance the response with performer email addresses when available
    const rows = data ?? [];
    const performerIds = Array.from(new Set(rows.map((r: any) => r.performed_by).filter(Boolean)));
    let emailMap: Record<string, string> = {};
    if (performerIds.length > 0) {
      const { data: members, error: membersError } = await supabaseAdmin
        .from('tenant_members')
        .select('user_id, user_email')
        .in('user_id', performerIds);

      if (!membersError && members) {
        for (const m of members) {
          if (m?.user_id) emailMap[m.user_id] = m.user_email || m.user_id;
        }
      }
    }

    const enrichedData = rows.map((r: any) => ({
      ...r,
      performed_by_email: r.performed_by ? emailMap[r.performed_by] || null : null,
    }));

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
