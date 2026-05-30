import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, requireActiveSubscription } from "@/lib/api";

const CategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(50, "Category name must be 50 characters or less"),
});

const CategoryUpdateSchema = z.object({
  oldName: z.string().trim().min(1),
  newName: z.string().trim().min(1).max(50, "Category name must be 50 characters or less"),
});

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("name")
    .eq("tenant_id", tenantContext.tenantId)
    .order("name", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data?.map((item) => item.name) ?? []);
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

  if (!["owner", "accountant"].includes(tenantContext.role)) {
    return jsonError("Only owners or accountants can create categories", 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = CategorySchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { name } = parseResult.data;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return jsonError(existingError.message, 500);
  }

  if (existing) {
    return jsonError("Category already exists", 409);
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({
      name,
      tenant_id: tenantContext.tenantId,
      user_id: tenantContext.userId,
      created_by: tenantContext.userId,
    })
    .select("name")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Failed to create category", 500);
  }

  return jsonSuccess(data.name, 201);
}

export async function PATCH(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  if (!["owner", "accountant"].includes(tenantContext.role)) {
    return jsonError("Only owners or accountants can edit categories", 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = CategoryUpdateSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { oldName, newName } = parseResult.data;

  const { data: existingNew, error: existingNewError } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("name", newName)
    .limit(1)
    .maybeSingle();

  if (existingNewError) {
    return jsonError(existingNewError.message, 500);
  }

  if (existingNew) {
    return jsonError("Category with the new name already exists", 409);
  }

  const { error } = await supabaseAdmin
    .from("categories")
    .update({ name: newName })
    .eq("tenant_id", tenantContext.tenantId)
    .eq("name", oldName);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ oldName, newName });
}

export async function DELETE(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  if (!["owner", "accountant"].includes(tenantContext.role)) {
    return jsonError("Only owners or accountants can delete categories", 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = CategorySchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { name } = parseResult.data;

  const { error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("tenant_id", tenantContext.tenantId)
    .eq("name", name);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ name });
}
