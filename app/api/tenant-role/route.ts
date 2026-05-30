import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);

  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const { userId } = tenantContext;
  const { data: adminMembership, error: adminError } = await supabaseAdmin
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (adminError) {
    return jsonError(adminError.message, 500);
  }

  return jsonSuccess(
    {
      role: tenantContext.role,
      is_admin: adminMembership?.role === "admin",
    },
    200
  );
}
