import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, requireRole } from "@/lib/api";

const NewDebtSchema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required"),
  customer_phone: z.string().trim().min(1, "Customer phone is required"),
  amount: z.number().nonnegative("Amount must be zero or greater"),
  date: z.string().trim().min(1, "Date is required"),
  note: z.string().optional(),
});

const UpdateDebtSchema = z.object({
  id: z.string().uuid("Debt id must be a valid UUID"),
  paid: z.boolean().optional(),
  note: z.string().optional(),
});

const DeleteDebtSchema = z.object({
  id: z.string().uuid("Debt id must be a valid UUID"),
});

export async function GET(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
  if ("error" in tenantContextOrError) {
    return jsonError(tenantContextOrError.error, tenantContextOrError.status);
  }
  const tenantContext = tenantContextOrError;

  const { data, error } = await supabaseAdmin
    .from("debts")
    .select("id, customer_name, customer_phone, amount, note, date, paid, created_at")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data || []);
}

export async function POST(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
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

  const parseResult = NewDebtSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { customer_name, customer_phone, amount, date, note } = parseResult.data;

  const { data, error } = await supabaseAdmin
    .from("debts")
    .insert({
      tenant_id: tenantContext.tenantId,
      user_id: tenantContext.userId,
      created_by: tenantContext.userId,
      customer_name,
      customer_phone,
      amount,
      date,
      note,
      paid: false,
    })
    .select("id, customer_name, customer_phone, amount, note, date, paid, created_at")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Failed to create debt", 500);
  }

  return jsonSuccess(data, 201);
}

export async function PATCH(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
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

  const parseResult = UpdateDebtSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id, paid, note } = parseResult.data;
  const updates: Record<string, unknown> = {};

  if (paid !== undefined) {
    updates.paid = paid;
  }
  if (note !== undefined) {
    updates.note = note;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("debts")
    .update(updates)
    .eq("tenant_id", tenantContext.tenantId)
    .eq("id", id)
    .select("id, customer_name, customer_phone, amount, note, date, paid, created_at")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Failed to update debt", 500);
  }

  return jsonSuccess(data);
}

export async function DELETE(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
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

  const parseResult = DeleteDebtSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id } = parseResult.data;

  const { error } = await supabaseAdmin
    .from("debts")
    .delete()
    .eq("tenant_id", tenantContext.tenantId)
    .eq("id", id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ id });
}
