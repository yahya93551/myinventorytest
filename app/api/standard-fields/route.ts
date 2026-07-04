import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireRole, jsonError, jsonSuccess } from "@/lib/api";
import { fallbackSystemFields } from "@/lib/customFields";

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof (error as any).message === "string") {
      return (error as any).message;
    }
    if ("error" in error && typeof (error as any).error === "string") {
      return (error as any).error;
    }
  }
  return String(error);
}

function isMissingCustomFieldsTable(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("could not find the table 'public.custom_fields'") ||
    message.includes("relation \"custom_fields\" does not exist") ||
    message.includes("custom_fields") && message.includes("does not exist");
}

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
    id: z.string().uuid().optional(),
    field_name: z.string().trim().min(1).optional(),
    updates: z.object({
      display_name: z.string().max(200).optional(),
      is_visible: z.boolean().optional(),
      field_order: z.number().int().optional(),
      description: z.string().max(500).optional(),
    }).partial(),
  }).refine((data) => data.id || data.field_name, {
    message: "Either id or field_name is required",
    path: ["id"],
  });

  const parseResult = schema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const { id, field_name, updates } = parseResult.data;

  // Verify field belongs to tenant and is a system field
  const fieldQuery = supabaseAdmin.from("custom_fields").select("tenant_id, is_system, id");
  if (id) {
    fieldQuery.eq("id", id);
  } else {
    fieldQuery.eq("tenant_id", tenantContext.tenantId).eq("field_name", field_name);
  }

  const { data: field, error: fieldError } = await fieldQuery.maybeSingle();

  if (fieldError) {
    return jsonError(fieldError.message, 500);
  }

  if (!field || field.tenant_id !== tenantContext.tenantId) {
    return jsonError("Standard field not found", 404);
  }

  if (!field.is_system) {
    return jsonError("Cannot update non-system field via standard-fields endpoint", 400);
  }

  const updateQuery = supabaseAdmin
    .from("custom_fields")
    .update({ ...updates, updated_at: new Date().toISOString() });

  if (id) {
    updateQuery.eq("id", id);
  } else {
    updateQuery.eq("tenant_id", tenantContext.tenantId).eq("field_name", field_name);
  }

  const { data, error } = await updateQuery.select().single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data);
}

