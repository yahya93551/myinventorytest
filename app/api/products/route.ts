import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, requireRole, jsonError, jsonSuccess, logAudit, requireActiveSubscription } from "@/lib/api";

const missingColumnRegex = /Could not find the '(.+?)' column of 'products'/;

function parseMissingColumns(error: { message?: string } | null) {
  if (!error?.message) return [];
  const match = error.message.match(missingColumnRegex);
  return match ? [match[1]] : [];
}

function stripMissingColumns<T extends Record<string, any>>(payload: T, missingColumns: string[]) {
  const cleaned = { ...payload };
  for (const column of missingColumns) {
    if (column in cleaned) {
      delete cleaned[column];
    }
  }
  return cleaned;
}

const ProductCreateSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  category: z.string().trim().min(1, "Category is required"),
  cost_price: z.coerce.number().nonnegative("Cost price cannot be negative").default(0),
  price: z.coerce.number().nonnegative("Price must be 0 or greater").default(0),
  stock: z
    .coerce.number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative")
    .default(0),
  image_url: z.string().url("Image URL must be valid").optional(),
  custom_data: z.record(z.string(), z.unknown()).optional(),
});

const ProductUpdateSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").optional(),
  category: z.string().trim().min(1, "Category is required").optional(),
  cost_price: z.coerce.number().nonnegative("Cost price cannot be negative").optional(),
  price: z.coerce.number().nonnegative("Price must be 0 or greater").optional(),
  stock: z
    .coerce.number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative")
    .optional(),
  image_url: z.string().url("Image URL must be valid").optional(),
  custom_data: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided for update",
  }
);

const ProductPatchSchema = z.object({
  id: z.string().uuid(),
  updates: ProductUpdateSchema,
});

const ProductDeleteSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  // Check subscription status
  const subCheck = await requireActiveSubscription(tenantContext.tenantId);
  if ("error" in subCheck) {
    return jsonError(subCheck.error, subCheck.status);
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") || "10")));
  const offset = (page - 1) * perPage;

  const { data, error, count } = await supabaseAdmin
    .from("products")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantContext.tenantId)
    .range(offset, offset + perPage - 1)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  const { data: allocations, error: allocationError } = await supabaseAdmin
    .from("inventory_takes")
    .select("product_id, remaining_quantity")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("user_id", tenantContext.userId)
    .gt("remaining_quantity", 0);

  const allocationMap = (allocations || []).reduce<Record<string, number>>((acc, allocation: any) => {
    if (!allocation?.product_id) return acc;
    acc[allocation.product_id] = (acc[allocation.product_id] || 0) + (allocation.remaining_quantity || 0);
    return acc;
  }, {});

  const productsWithAllocation = (data || []).map((product: any) => ({
    ...product,
    allocated_quantity: allocationMap[product.id] ?? 0,
  }));

  return jsonSuccess({ products: productsWithAllocation, count: count ?? 0 });
}

export async function POST(req: Request) {
  try {
    // Phase 1: Context & Authorization (require owner or accountant)
    const tenantContextOrError = await requireRole(req, ["owner", "accountant"]);
    if ("error" in tenantContextOrError) {
      return jsonError(tenantContextOrError.error, tenantContextOrError.status);
    }
    const tenantContext = tenantContextOrError;

    // Check subscription status
    const subCheck = await requireActiveSubscription(tenantContext.tenantId);
    if ("error" in subCheck) {
      return jsonError(subCheck.error, subCheck.status);
    }

    // Phase 2: Parse Request Body
    let payload: unknown;
    try {
      payload = await req.json();
    } catch (err) {
      console.error("[POST /api/products] JSON parse error:", err);
      return jsonError("Invalid JSON payload", 400);
    }

    // Phase 3: Validate Schema
    const parseResult = ProductCreateSchema.safeParse(payload);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues.map((issue) => issue.message).join(", ");
      console.warn("[POST /api/products] Validation failed:", errorMessages, "Payload:", JSON.stringify(payload));
      return jsonError(errorMessages, 422);
    }

    const { name, category, cost_price, price, stock, image_url, custom_data } = parseResult.data;

    // Sanitize custom_data: only allow keys that correspond to visible custom fields for this tenant.
    let sanitizedCustomData = custom_data || {};
    try {
      const { data: tenantCustomFields, error: cfError } = await supabaseAdmin
        .from("custom_fields")
        .select("field_name, is_system, is_visible")
        .eq("tenant_id", tenantContext.tenantId);

      if (!cfError && Array.isArray(tenantCustomFields)) {
        const allowedCustomKeys = tenantCustomFields
          .filter((f: any) => !f.is_system && f.is_visible)
          .map((f: any) => f.field_name);

        sanitizedCustomData = Object.keys(sanitizedCustomData || {}).reduce((acc: any, k) => {
          if (allowedCustomKeys.includes(k)) acc[k] = (sanitizedCustomData as any)[k];
          return acc;
        }, {} as Record<string, unknown>);
      }
    } catch (e) {
      // If anything goes wrong reading custom fields, fall back to submitted custom_data (non-destructive)
      sanitizedCustomData = custom_data || {};
    }

    // Phase 4: Type Safety Check (before DB insert)
    if (typeof name !== "string" || !name.trim()) {
      console.error("[POST /api/products] Type check failed: name is not a valid string");
      return jsonError("Product name must be a non-empty string", 400);
    }
    if (typeof category !== "string" || !category.trim()) {
      console.error("[POST /api/products] Type check failed: category is not a valid string");
      return jsonError("Category must be a non-empty string", 400);
    }
    if (typeof cost_price !== "number" || cost_price < 0) {
      console.error("[POST /api/products] Type check failed: cost_price is invalid", { cost_price, type: typeof cost_price });
      return jsonError("Cost price must be a non-negative number", 400);
    }
    if (typeof price !== "number" || price < 0) {
      console.error("[POST /api/products] Type check failed: price is invalid", { price, type: typeof price });
      return jsonError("Price must be a non-negative number", 400);
    }
    if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
      console.error("[POST /api/products] Type check failed: stock is invalid", { stock, type: typeof stock });
      return jsonError("Stock must be a non-negative integer", 400);
    }

    // Phase 5: Database Insert
    const productPayload = {
      name,
      category,
      cost_price,
      price,
      stock,
      image_url,
      custom_data: sanitizedCustomData || {},
      tenant_id: tenantContext.tenantId,
      user_id: tenantContext.userId,
      created_by: tenantContext.userId,
    };

    console.log("[POST /api/products] Inserting product:", productPayload);

    let { data: insertedProduct, error: insertError } = await supabaseAdmin
      .from("products")
      .insert(productPayload)
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/products] Database insert error:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });

      const missingColumns = parseMissingColumns(insertError);
      if (missingColumns.length > 0) {
        console.warn("[POST /api/products] Dropping missing columns and retrying insert:", missingColumns);
        const fallbackPayload = stripMissingColumns(productPayload, missingColumns);

        const fallbackResult = await supabaseAdmin
          .from("products")
          .insert(fallbackPayload)
          .select()
          .single();

        if (!fallbackResult.error && fallbackResult.data) {
          console.log("[POST /api/products] Product inserted successfully after schema fallback:", { id: fallbackResult.data.id });
          return jsonSuccess(fallbackResult.data, 201);
        }

        console.error("[POST /api/products] Fallback insert failed:", {
          message: fallbackResult.error?.message,
          code: fallbackResult.error?.code,
          details: fallbackResult.error?.details,
          hint: fallbackResult.error?.hint,
        });
        return jsonError(
          `Database fallback error: ${fallbackResult.error?.message || "Unknown database error"}`,
          500
        );
      }

      return jsonError(
        `Database error: ${insertError.message || "Unknown database error"}`,
        500
      );
    }

    if (!insertedProduct) {
      console.error("[POST /api/products] Database insert returned no data");
      return jsonError("Failed to retrieve inserted product", 500);
    }

    console.log("[POST /api/products] Product inserted successfully:", { id: insertedProduct.id });
    
    // Log audit trail
    await logAudit(
      tenantContext.tenantId,
      tenantContext.userId,
      "CREATE",
      "product",
      req,
      insertedProduct.id,
      { name, category, cost_price, price, stock }
    );
    
    return jsonSuccess(insertedProduct, 201);
  } catch (err) {
    // Phase 6: Catch-All for Unexpected Errors
    console.error("[POST /api/products] Unexpected error:", err instanceof Error ? err.message : String(err), err);
    return jsonError(
      `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`,
      500
    );
  }
}

export async function PATCH(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  // Only owners and accountants can edit products
  if (!["owner", "accountant"].includes(tenantContext.role)) {
    return jsonError("Only owners or accountants can update products", 403);
  }

  // Check subscription status
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

  const parseResult = ProductPatchSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id, updates } = parseResult.data;

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("tenant_id, stock")
    .eq("id", id)
    .single();

  if (productError || !product) {
    return jsonError(productError?.message || "Product not found", 404);
  }

  if (product.tenant_id !== tenantContext.tenantId) {
    return jsonError("You do not have permission to edit this product", 403);
  }

  const { error } = await supabaseAdmin
    .from("products")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  const actionType = typeof updates.stock === "number"
    ? updates.stock > product.stock
      ? "RESTOCK"
      : "UPDATE"
    : "UPDATE";

  if (error) {
    const missingColumns = parseMissingColumns(error);
    if (missingColumns.length > 0) {
      const fallbackUpdates = stripMissingColumns(updates, missingColumns);
      if (Object.keys(fallbackUpdates).length === 0) {
        console.warn("[PATCH /api/products] Update contains only missing columns, no supported fields to update:", missingColumns);
        return jsonSuccess({ id, updates: {} });
      }

      const { error: fallbackError } = await supabaseAdmin
        .from("products")
        .update(fallbackUpdates)
        .eq("id", id)
        .eq("tenant_id", tenantContext.tenantId);

      if (fallbackError) {
        console.error("[PATCH /api/products] Fallback update failed:", {
          message: fallbackError.message,
          code: fallbackError.code,
          details: fallbackError.details,
          hint: fallbackError.hint,
        });
        return jsonError(`Database error: ${fallbackError.message || "Unknown database error"}`, 500);
      }

      console.log("[PATCH /api/products] Update succeeded after dropping missing columns:", { id, updates: fallbackUpdates });
      
      // Log audit trail
      await logAudit(
        tenantContext.tenantId,
        tenantContext.userId,
        actionType,
        "product",
        req,
        id,
        {
          updates: fallbackUpdates,
          previousStock: product.stock,
          newStock: typeof fallbackUpdates.stock === "number" ? fallbackUpdates.stock : product.stock,
        }
      );
      
      return jsonSuccess({ id, updates: fallbackUpdates });
    }

    return jsonError(error.message, 500);
  }

  // Log audit trail
  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    actionType,
    "product",
    req,
    id,
    {
      updates,
      previousStock: product.stock,
      newStock: typeof updates.stock === "number" ? updates.stock : product.stock,
    }
  );

  return jsonSuccess({ id, updates });
}

export async function DELETE(req: Request) {
  // require owner or accountant to delete products
  const tenantContextOrError = await requireRole(req, ["owner", "accountant"]);
  if ("error" in tenantContextOrError) {
    return jsonError(tenantContextOrError.error, tenantContextOrError.status);
  }
  const tenantContext = tenantContextOrError;

  // Check subscription status
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

  const parseResult = ProductDeleteSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { id } = parseResult.data;

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (productError || !product) {
    return jsonError(productError?.message || "Product not found", 404);
  }

  if (product.tenant_id !== tenantContext.tenantId) {
    return jsonError("You do not have permission to delete this product", 403);
  }

  const { error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    return jsonError(error.message, 500);
  }

  // Log audit trail
  await logAudit(
    tenantContext.tenantId,
    tenantContext.userId,
    "DELETE",
    "product",
    req,
    id
  );

  return jsonSuccess({ id });
}
