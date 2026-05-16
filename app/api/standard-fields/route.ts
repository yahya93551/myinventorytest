import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";
import { CustomField } from "@/types";

const CUSTOM_FIELDS_TABLE_NAME = "custom_fields";

const SYSTEM_FIELDS = [
  { field_name: "name", display_name: "Name", field_type: "text" },
  { field_name: "category", display_name: "Category", field_type: "text" },
  { field_name: "cost_price", display_name: "Cost Price", field_type: "currency" },
  { field_name: "price", display_name: "Sell Price", field_type: "currency" },
  { field_name: "stock", display_name: "Stock", field_type: "number" },
] as const;

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

function isMissingColumnError(error: unknown, columnName: string) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes(`column ${CUSTOM_FIELDS_TABLE_NAME}.${columnName} does not exist`) ||
    message.includes(`column ${columnName} does not exist`) ||
    message.includes(`column "${columnName}" does not exist`) ||
    message.includes(`column ${columnName} does not exist on relation`) ||
    message.includes(`column "${CUSTOM_FIELDS_TABLE_NAME}".${columnName} does not exist`)
  );
}

function handleStandardFieldsSchemaError(error: unknown) {
  const message = getErrorMessage(error);

  if (message.includes(`Could not find the table 'public.${CUSTOM_FIELDS_TABLE_NAME}'`)) {
    return jsonError(
      "Custom fields are not installed. Run the Supabase migrations 20260507000010_add_custom_fields.sql and 20260512000011_add_system_fields.sql, then refresh the app.",
      500
    );
  }

  if (isMissingColumnError(error, "is_system")) {
    return jsonError(
      "Custom field support is partially installed. Run the Supabase migration 20260512000011_add_system_fields.sql, then refresh the app.",
      500
    );
  }

  return null;
}

async function initializeStandardFieldsForTenant(tenantId: string, userId: string) {
  try {
    const { error } = await supabaseAdmin.rpc("initialize_system_fields", {
      target_tenant_id: tenantId,
      creator_user_id: userId,
    });

    if (!error) {
      return;
    }

    console.warn("RPC initialize_system_fields failed, using direct insertion:", error);
  } catch (e) {
    console.warn("RPC initialize_system_fields not available, using direct insertion:", e);
  }

  const systemFieldsToInsert = SYSTEM_FIELDS.map((field, index) => ({
    tenant_id: tenantId,
    field_name: field.field_name,
    display_name: field.display_name,
    field_type: field.field_type,
    is_system: true,
    is_required: false,
    is_visible: true,
    field_order: index,
    created_by: userId,
  }));

  const { error: insertError } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .upsert(systemFieldsToInsert, { onConflict: "tenant_id,field_name", ignoreDuplicates: true });

  if (insertError) {
    console.error("Error initializing system fields via direct insertion:", insertError);
  }
}

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  await initializeStandardFieldsForTenant(tenantContext.tenantId, tenantContext.userId);

  const { data, error } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("is_system", true)
    .order("field_order", { ascending: true });

  if (error) {
    const tableError = handleStandardFieldsSchemaError(error);
    if (tableError) return tableError;
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data ?? []);
}

const StandardFieldPatchSchema = z.object({
  id: z.string().uuid(),
  updates: z.object({
    is_visible: z.boolean(),
  }),
});

export async function PATCH(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  if (tenantContext.role !== "owner") {
    return jsonError("Only owners can update standard fields", 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = StandardFieldPatchSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const { id, updates } = parseResult.data;

  const { data: field, error: fieldError } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .select("tenant_id, is_system, is_required")
    .eq("id", id)
    .maybeSingle();

  if (fieldError) {
    return jsonError(fieldError.message, 500);
  }

  if (!field || field.tenant_id !== tenantContext.tenantId) {
    return jsonError("Standard field not found", 404);
  }

  if (!field.is_system) {
    return jsonError("Only standard fields may be updated through this endpoint", 400);
  }

  if (field.is_required && updates.is_visible === false) {
    return jsonError("Required standard fields cannot be hidden", 400);
  }

  const { data, error } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data);
}
