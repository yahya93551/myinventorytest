import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireRole, jsonError, jsonSuccess, requireActiveSubscription } from "@/lib/api";

const CUSTOM_FIELDS_TABLE_NAME = "custom_fields";

function getErrorMessage(error: unknown) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message;
  }

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
    message.includes(`column \"${columnName}\" does not exist`) ||
    message.includes(`column ${columnName} does not exist on relation`) ||
    message.includes(`column \"${CUSTOM_FIELDS_TABLE_NAME}\".${columnName} does not exist`)
  );
}

function handleCustomFieldsSchemaError(error: unknown) {
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

async function initializeSystemFieldsForTenant(tenantId: string, userId: string) {
  try {
    // Try using the SQL function first
    const { error } = await supabaseAdmin.rpc('initialize_system_fields', {
      target_tenant_id: tenantId,
      creator_user_id: userId,
    });

    if (!error) {
      return; // Success
    }

    // If RPC fails, fall back to direct insertion
    console.warn("RPC initialize_system_fields failed, using direct insertion:", error);
  } catch (e) {
    console.warn("RPC initialize_system_fields not available, using direct insertion:", e);
  }

  // Fallback: Direct insertion
  const systemFieldsToInsert = [
    { field_name: "name", display_name: "Name", field_type: "text" },
    { field_name: "category", display_name: "Category", field_type: "text" },
    { field_name: "cost_price", display_name: "Cost Price", field_type: "currency" },
    { field_name: "price", display_name: "Sell Price", field_type: "currency" },
    { field_name: "stock", display_name: "Stock", field_type: "number" },
  ].map((field, index) => ({
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

const CustomFieldSchema = z.object({
  field_name: z.string().trim().min(1, "Field name is required").max(50),
  display_name: z.string().trim().min(1, "Display name is required").max(100),
  field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'currency']),
  is_required: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  field_order: z.number().int().default(0),
  select_options: z.array(z.string().trim()).optional(),
  default_value: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
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

  // Ensure system fields are initialized for this tenant
  await initializeSystemFieldsForTenant(tenantContext.tenantId, tenantContext.userId);

  const { data, error } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("is_system", false)
    .order("field_order", { ascending: true });

  if (error) {
    const tableError = handleCustomFieldsSchemaError(error);
    if (tableError) return tableError;
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data ?? []);
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

  const parseResult = CustomFieldSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const { field_name, display_name, field_type, is_required, is_visible, field_order, select_options, default_value, description } = parseResult.data;

  // Check if field name already exists for this tenant
  const { data: existing, error: existingError } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .select("id")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("field_name", field_name)
    .maybeSingle();

  if (existingError) {
    const tableError = handleCustomFieldsSchemaError(existingError);
    if (tableError) return tableError;
    return jsonError(existingError.message, 500);
  }

  if (existing) {
    return jsonError("Field name already exists for this tenant", 409);
  }

  const { data, error } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .insert({
      tenant_id: tenantContext.tenantId,
      field_name,
      display_name,
      field_type,
      is_required,
      is_visible,
      field_order,
      select_options,
      default_value,
      description,
      created_by: tenantContext.userId,
    })
    .select()
    .single();

  if (error) {
    const tableError = handleCustomFieldsSchemaError(error);
    if (tableError) return tableError;
    return jsonError(error.message, 500);
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

  const schema = z.object({
    id: z.string().uuid(),
    updates: CustomFieldSchema.partial(),
  });

  const parseResult = schema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const { id, updates } = parseResult.data;

  // Verify field belongs to tenant
  const { data: field, error: fieldError } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .select("tenant_id, is_system")
    .eq("id", id)
    .maybeSingle();

  if (fieldError) {
    const tableError = handleCustomFieldsSchemaError(fieldError);
    if (tableError) return tableError;
    return jsonError(fieldError.message, 500);
  }

  if (!field || field.tenant_id !== tenantContext.tenantId) {
    return jsonError("Custom field not found", 404);
  }

  if (field.is_system) {
    const disallowedUpdates = ["field_name", "field_type", "is_required", "select_options", "default_value"];
    const invalidKeys = Object.keys(updates).filter((key) => disallowedUpdates.includes(key));
    if (invalidKeys.length > 0) {
      return jsonError(
        "Standard fields can only update display_name, is_visible, field_order, and description.",
        400
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const tableError = handleCustomFieldsSchemaError(error);
    if (tableError) return tableError;
    return jsonError(error.message, 500);
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

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const queryId = new URL(req.url).searchParams.get("id");
  const input = payload && typeof payload === "object" ? payload : queryId ? { id: queryId } : null;

  const schema = z.object({
    id: z.string().uuid(),
  });

  const parseResult = schema.safeParse(input);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const { id } = parseResult.data;

  // Verify field belongs to tenant and get full field info
  let field: { tenant_id: string; field_name: string; display_name: string; is_system?: boolean } | null = null;
  let fieldError: unknown = null;

  try {
    const result = await supabaseAdmin
      .from(CUSTOM_FIELDS_TABLE_NAME)
      .select("tenant_id, field_name, display_name, is_system")
      .eq("id", id)
      .maybeSingle();
    field = result.data as any;
    fieldError = result.error;
  } catch (error) {
    fieldError = error;
  }

  if (fieldError) {
    if (isMissingColumnError(fieldError, "is_system")) {
      const fallback = await supabaseAdmin
        .from(CUSTOM_FIELDS_TABLE_NAME)
        .select("tenant_id, field_name, display_name")
        .eq("id", id)
        .maybeSingle();

      field = (fallback.data as any) ?? null;
      fieldError = fallback.error;
      if (fieldError) {
        const tableError = handleCustomFieldsSchemaError(fieldError);
        if (tableError) return tableError;
        return jsonError(getErrorMessage(fieldError), 500);
      }
    } else {
      const tableError = handleCustomFieldsSchemaError(fieldError);
      if (tableError) return tableError;
      return jsonError(getErrorMessage(fieldError), 500);
    }
  }

  if (!field || field.tenant_id !== tenantContext.tenantId) {
    return jsonError("Custom field not found", 404);
  }

  if (field.is_system) {
    return jsonError("Cannot delete standard fields. Hide them instead.", 409);
  }

  const { error } = await supabaseAdmin
    .from(CUSTOM_FIELDS_TABLE_NAME)
    .delete()
    .eq("id", id);

  if (error) {
    const tableError = handleCustomFieldsSchemaError(error);
    if (tableError) return tableError;
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ id });
}
