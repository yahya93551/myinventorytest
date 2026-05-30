import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, requireActiveSubscription } from "@/lib/api";

const BusinessSettingsSchema = z.object({
  business_type: z.enum(['pharmacy', 'ngo', 'warehouse', 'supermarket', 'retail_shop', 'distributor', 'custom']),
  description: z.string().max(500).optional(),
  business_name: z.string().max(200).optional(),
  business_address: z.string().max(500).optional(),
  business_contact_name: z.string().max(200).optional(),
  business_contact_phone: z.string().max(100).optional(),
  business_contact_email: z.string().email().optional(),
  business_website: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const subscriptionCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subscriptionCheck) {
    return jsonError(subscriptionCheck.error, subscriptionCheck.status);
  }

  const { data, error } = await supabaseAdmin
    .from("business_settings")
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "no rows" error - that's OK
    return jsonError(error.message, 500);
  }

  // If no settings exist, return defaults
  if (!data) {
    return jsonSuccess({
      business_type: 'custom',
      description: null,
    });
  }

  return jsonSuccess(data);
}

export async function POST(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  if (tenantContext.role !== "owner") {
    return jsonError("Only owners can update business settings", 403);
  }

  const subscriptionCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subscriptionCheck) {
    return jsonError(subscriptionCheck.error, subscriptionCheck.status);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = BusinessSettingsSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  const {
    business_type,
    description,
    business_name,
    business_address,
    business_contact_name,
    business_contact_phone,
    business_contact_email,
    business_website,
  } = parseResult.data;

  // Check if settings already exist
  const { data: existing } = await supabaseAdmin
    .from("business_settings")
    .select("id")
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabaseAdmin
      .from("business_settings")
      .update({
        business_type,
        description,
        business_name,
        business_address,
        business_contact_name,
        business_contact_phone,
        business_contact_email,
        business_website,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantContext.tenantId)
      .select()
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess(data);
  }

  // Create new
  const { data, error } = await supabaseAdmin
    .from("business_settings")
    .insert({
      tenant_id: tenantContext.tenantId,
      business_type,
      description,
      business_name,
      business_address,
      business_contact_name,
      business_contact_phone,
      business_contact_email,
      business_website,
    })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess(data, 201);
}
