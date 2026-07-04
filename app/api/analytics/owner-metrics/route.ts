import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, requireActiveSubscription, jsonError, jsonSuccess } from "@/lib/api";

export async function GET(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
  if ("error" in tenantContextOrError) {
    return jsonError(tenantContextOrError.error, tenantContextOrError.status);
  }
  const tenantContext = tenantContextOrError;

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  try {
    const { data: takes, error: takesError } = await supabaseAdmin
      .from("inventory_takes")
      .select("remaining_quantity")
      .eq("tenant_id", tenantContext.tenantId)
      .gt("remaining_quantity", 0);

    if (takesError) {
      return jsonError(takesError.message, 500);
    }

    const takenNotSoldTotal = (takes || []).reduce((sum: number, t: any) => sum + (t?.remaining_quantity || 0), 0);
    const takenNotSoldCount = (takes || []).length;

    const takenNotSoldUserIds = Array.from(
      new Set(
        (takes || [])
          .map((t: any) => t?.user_id)
          .filter((id: any) => typeof id === "string" && id.length > 0)
      )
    );

    let takenNotSoldUserEmails: string[] = [];
    if (takenNotSoldUserIds.length > 0) {
      const { data: members, error: membersError } = await supabaseAdmin
        .from("tenant_members")
        .select("user_email")
        .in("user_id", takenNotSoldUserIds)
        .eq("tenant_id", tenantContext.tenantId);

      if (!membersError && Array.isArray(members)) {
        takenNotSoldUserEmails = members
          .map((member: any) => member.user_email)
          .filter((email: any) => typeof email === "string" && email.length > 0);
      }
    }

    const { data: debts, error: debtsError } = await supabaseAdmin
      .from("debts")
      .select("amount")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("paid", false);

    if (debtsError) {
      return jsonError(debtsError.message, 500);
    }

    const unpaidDebtsTotal = (debts || []).reduce((sum: number, d: any) => sum + Number(d?.amount || 0), 0);
    const unpaidDebtsCount = (debts || []).length;

    return jsonSuccess({
      taken_not_sold_total: takenNotSoldTotal,
      taken_not_sold_count: takenNotSoldCount,
      taken_not_sold_user_emails: takenNotSoldUserEmails,
      unpaid_debts_total: unpaidDebtsTotal,
      unpaid_debts_count: unpaidDebtsCount,
    });
  } catch (err: any) {
    return jsonError(err?.message || String(err), 500);
  }
}
