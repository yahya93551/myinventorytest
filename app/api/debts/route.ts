import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonSuccess, requireRole, requireActiveSubscription } from "@/lib/api";

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
  payment_amount: z.number()
    .positive("Payment amount must be greater than zero")
    .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7, "Payment amount can have at most two decimal places")
    .optional(),
}).refine(
  (payload) => payload.payment_amount === undefined || (payload.paid === undefined && payload.note === undefined),
  "Record a payment separately from other debt updates",
);

const DeleteDebtSchema = z.object({
  id: z.string().uuid("Debt id must be a valid UUID"),
});

async function loadDebtPayments(tenantId: string, debtId?: string) {
  const pageSize = 500;
  const payments: { id: string; debt_id: string; amount: number; paid_at: string }[] = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabaseAdmin
      .from("debt_payment_records")
      .select("id, debt_id, amount, paid_at")
      .eq("tenant_id", tenantId)
      .order("paid_at", { ascending: false })
      .order("id", { ascending: false });
    if (debtId) query = query.eq("debt_id", debtId);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) return { payments: null, error };

    const page = data || [];
    payments.push(...page);
    if (page.length < pageSize) return { payments, error: null };
  }
}

async function recordDebtPayment(tenantId: string, debtId: string, amount: number) {
  const { data, error } = await supabaseAdmin.rpc("record_debt_payment", {
    p_tenant_id: tenantId,
    p_debt_id: debtId,
    p_payment_amount: amount,
  });

  if (error) {
    const message = error.message || "Failed to record debt payment";
    const debtError = message.match(/DEBT_(NOT_FOUND|OVERPAYMENT|INVALID):\s*(.*)/);
    const clientMessage = debtError?.[2] || message;
    const status = debtError?.[1] === "NOT_FOUND" ? 404
      : debtError?.[1] === "OVERPAYMENT" ? 400
      : debtError?.[1] === "INVALID" ? 422
      : 500;
    return jsonError(clientMessage, status);
  }

  if (!data) return jsonError("Failed to record debt payment", 500);

  const { payments, error: paymentError } = await loadDebtPayments(tenantId, debtId);

  if (paymentError) return jsonError(paymentError.message, 500);
  return jsonSuccess({ ...data, payments: payments || [] });
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

  const { data, error } = await supabaseAdmin
    .from("debts")
    .select("id, customer_name, customer_phone, amount, amount_paid, note, date, paid, created_at")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  const debts = data || [];
  if (debts.length === 0) return jsonSuccess([]);

  const { payments, error: paymentError } = await loadDebtPayments(tenantContext.tenantId);

  if (paymentError) return jsonError(paymentError.message, 500);

  const paymentsByDebt = new Map<string, NonNullable<typeof payments>>();
  for (const payment of payments || []) {
    const debtPayments = paymentsByDebt.get(payment.debt_id) || [];
    debtPayments.push(payment);
    paymentsByDebt.set(payment.debt_id, debtPayments);
  }

  return jsonSuccess(debts.map((debt) => ({
    ...debt,
    payments: paymentsByDebt.get(debt.id) || [],
  })));
}

export async function POST(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
  if ("error" in tenantContextOrError) {
    return jsonError(tenantContextOrError.error, tenantContextOrError.status);
  }
  const tenantContext = tenantContextOrError;

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

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
      amount_paid: 0,
      date,
      note,
      paid: false,
    })
    .select("id, customer_name, customer_phone, amount, amount_paid, note, date, paid, created_at")
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

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

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

  const { id, paid, note, payment_amount } = parseResult.data;

  if (payment_amount !== undefined) {
    return recordDebtPayment(tenantContext.tenantId, id, payment_amount);
  }

  if (paid === true && note === undefined) {
    const { data: debt, error } = await supabaseAdmin
      .from("debts")
      .select("amount, amount_paid")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!debt) return jsonError("Debt record was not found", 404);

    const remaining = Number(debt.amount) - Number(debt.amount_paid || 0);
    if (remaining > 0) return recordDebtPayment(tenantContext.tenantId, id, remaining);
  }

  const updates: Record<string, unknown> = {};

  if (paid !== undefined) {
    updates.paid = paid;
    if (paid) {
      const { data: debt, error } = await supabaseAdmin
        .from("debts")
        .select("amount")
        .eq("tenant_id", tenantContext.tenantId)
        .eq("id", id)
        .maybeSingle();

      if (error) return jsonError(error.message, 500);
      if (!debt) return jsonError("Debt record was not found", 404);
      updates.amount_paid = debt.amount;
    } else {
      updates.amount_paid = 0;
    }
  }
  if (note !== undefined) {
    updates.note = note;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("debts")
    .update(updates)
    .eq("tenant_id", tenantContext.tenantId)
    .eq("id", id)
    .select("id, customer_name, customer_phone, amount, amount_paid, note, date, paid, created_at")
    .single();

  if (updateError || !data) {
    return jsonError(updateError?.message || "Failed to update debt", 500);
  }

  return jsonSuccess(data);
}

export async function DELETE(req: Request) {
  const tenantContextOrError = await requireRole(req, ["owner"]);
  if ("error" in tenantContextOrError) {
    return jsonError(tenantContextOrError.error, tenantContextOrError.status);
  }
  const tenantContext = tenantContextOrError;

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

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
