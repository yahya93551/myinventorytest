import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireRole, jsonError, jsonSuccess } from "@/lib/api";
import { fallbackSystemFields } from "@/lib/customFields";

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("custom_fields")
      .select("*")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("is_system", true)
      .order("field_order", { ascending: true });

    if (error) {
      // If table missing or other DB issue, fall back to embedded defaults
      return jsonSuccess(fallbackSystemFields.map((f) => ({ ...f, tenant_id: tenantContext.tenantId })), 200);
    }

    // If no system rows exist, return fallback system fields with tenant_id populated
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return jsonSuccess(fallbackSystemFields.map((f) => ({ ...f, tenant_id: tenantContext.tenantId })), 200);
    }

    return jsonSuccess(data, 200);
  } catch (err) {
    return jsonSuccess(fallbackSystemFields.map((f) => ({ ...f, tenant_id: tenantContext.tenantId })), 200);
  }
}

export async function PATCH(req: Request) {
  // Only owners may update standard field visibility/properties
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

  const schema = z.object({
    id: z.string().uuid(),
    updates: z.object({
      display_name: z.string().max(200).optional(),
      is_visible: z.boolean().optional(),
      field_order: z.number().int().optional(),
      description: z.string().max(500).optional(),
    }).partial(),
  });

  const parseResult = schema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const { id, updates } = parseResult.data;

  // Verify field belongs to tenant and is a system field
  const { data: field, error: fieldError } = await supabaseAdmin
    .from("custom_fields")
    .select("tenant_id, is_system")
    .eq("id", id)
    .maybeSingle();

  if (fieldError) {
    return jsonError(fieldError.message, 500);
  }

  if (!field || field.tenant_id !== tenantContext.tenantId) {
    return jsonError("Standard field not found", 404);
  }

  if (!field.is_system) {
    return jsonError("Cannot update non-system field via standard-fields endpoint", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("custom_fields")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data);
}

