import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, requireActiveSubscription, jsonError, jsonSuccess } from "@/lib/api";

const PAGE_SIZE = 500;
const MEMBER_LOOKUP_BATCH_SIZE = 200;

async function readOwnerTotals(tenantId: string) {
  let cursor: string | null = null;
  let takenNotSoldTotal = 0;
  let takenNotSoldCount = 0;
  const takenNotSoldUserIds = new Set<string>();

  while (true) {
    let query = supabaseAdmin
      .from("inventory_takes")
      .select("remaining_quantity, user_id, id")
      .eq("tenant_id", tenantId)
      .gt("remaining_quantity", 0)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) {
      query = query.gt("id", cursor);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const take of rows) {
      takenNotSoldTotal += Number(take.remaining_quantity || 0);
      takenNotSoldCount += 1;
      if (typeof take.user_id === "string" && take.user_id.length > 0) takenNotSoldUserIds.add(take.user_id);
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  }

  cursor = null;
  let unpaidDebtsTotal = 0;
  let unpaidDebtsCount = 0;
  while (true) {
    let query = supabaseAdmin
      .from("debts")
      .select("amount, id")
      .eq("tenant_id", tenantId)
      .eq("paid", false)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) {
      query = query.gt("id", cursor);
    }
    const { data, error } = await query;

    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const debt of rows) {
      unpaidDebtsTotal += Number(debt.amount || 0);
      unpaidDebtsCount += 1;
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  }

  return { takenNotSoldTotal, takenNotSoldCount, takenNotSoldUserIds: [...takenNotSoldUserIds], unpaidDebtsTotal, unpaidDebtsCount };
}

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
    const ownerMetrics = await readOwnerTotals(tenantContext.tenantId);

    let takenNotSoldUserEmails: string[] = [];
    if (ownerMetrics.takenNotSoldUserIds.length > 0) {
      for (let offset = 0; offset < ownerMetrics.takenNotSoldUserIds.length; offset += MEMBER_LOOKUP_BATCH_SIZE) {
        const userIdBatch = ownerMetrics.takenNotSoldUserIds.slice(offset, offset + MEMBER_LOOKUP_BATCH_SIZE);
        const { data: members, error: membersError } = await supabaseAdmin
          .from("tenant_members")
          .select("user_email")
          .in("user_id", userIdBatch)
          .eq("tenant_id", tenantContext.tenantId);

        if (membersError) return jsonError(membersError.message, 500);
        takenNotSoldUserEmails.push(...(members || []).map((member) => member.user_email).filter((email): email is string => typeof email === "string" && email.length > 0));
      }
    }

    return jsonSuccess({
      taken_not_sold_total: ownerMetrics.takenNotSoldTotal,
      taken_not_sold_count: ownerMetrics.takenNotSoldCount,
      taken_not_sold_user_emails: takenNotSoldUserEmails,
      unpaid_debts_total: ownerMetrics.unpaidDebtsTotal,
      unpaid_debts_count: ownerMetrics.unpaidDebtsCount,
    });
  } catch (err: any) {
    return jsonError(err?.message || String(err), 500);
  }
}
