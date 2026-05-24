import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerTenantContext, jsonError, jsonSuccess, logAudit } from "@/lib/api";

// Schema for a single product in bulk upload
const BulkProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  category: z.string().trim().min(1, "Category is required"),
  cost_price: z.coerce.number().nonnegative("Cost price cannot be negative").optional().default(0),
  price: z.coerce.number().nonnegative("Price must be 0 or greater").optional().default(0),
  stock: z.coerce.number().int("Stock must be an integer").nonnegative("Stock cannot be negative").optional().default(0),
  custom_data: z.record(z.string(), z.unknown()).optional(),
});

const BulkUploadSchema = z.object({
  products: z.array(BulkProductSchema).min(1, "At least 1 product is required").max(1000, "Maximum 1000 products allowed"),
});

export async function POST(req: Request) {
  try {
    // Phase 1: Context & Authorization
    const tenantContext = await getServerTenantContext(req);
    if ("error" in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    // Only owner and accountant can bulk upload
    if (!["owner", "accountant"].includes(tenantContext.role)) {
      return jsonError("Only owners or accountants can bulk upload products", 403);
    }

    // Phase 2: Parse Request Body
    let payload: unknown;
    try {
      payload = await req.json();
    } catch (err) {
      console.error("[POST /api/bulk/upload] JSON parse error:", err);
      return jsonError("Invalid JSON payload", 400);
    }

    // Phase 3: Validate Schema
    const parseResult = BulkUploadSchema.safeParse(payload);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return `${path}: ${issue.message}`;
      }).join(", ");
      console.warn("[POST /api/bulk/upload] Validation failed:", errorMessages);
      return jsonError(`Validation error: ${errorMessages}`, 422);
    }

    const { products } = parseResult.data;

    console.log("[POST /api/bulk/upload] Processing", products.length, "products");

    // Phase 4: Prepare product payloads
    const productPayloads = products.map((product) => ({
      name: product.name,
      category: product.category,
      cost_price: product.cost_price || 0,
      price: product.price || 0,
      stock: product.stock || 0,
      custom_data: product.custom_data || {},
      tenant_id: tenantContext.tenantId,
      user_id: tenantContext.userId,
      created_by: tenantContext.userId,
    }));

    // Phase 5: Batch Insert
    const { data: insertedProducts, error: insertError } = await supabaseAdmin
      .from("products")
      .insert(productPayloads)
      .select("id, name, category, price, stock, created_at");

    if (insertError) {
      console.error("[POST /api/bulk/upload] Batch insert error:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
      });
      
      // If batch fails, try one-by-one with fallback
      console.warn("[POST /api/bulk/upload] Attempting fallback: insert one by one");
      const results: Array<Record<string, any>> = [];
      const errors: Array<{ index: number; name: string; error: string }> = [];

      for (let i = 0; i < productPayloads.length; i++) {
        const payload = productPayloads[i];
        const { data: product, error } = await supabaseAdmin
          .from("products")
          .insert(payload)
          .select("id, name, category, price, stock, created_at")
          .single();

        if (error) {
          console.warn(`[POST /api/bulk/upload] Product ${i + 1} failed:`, error.message);
          errors.push({
            index: i + 1,
            name: payload.name,
            error: error.message,
          });
        } else if (product) {
          results.push(product);
        }
      }

      if (results.length === 0) {
        return jsonError(
          `Bulk insert failed: ${insertError.message}. No products were inserted.`,
          500
        );
      }

      // Partial success
      console.log("[POST /api/bulk/upload] Partial success:", results.length, "of", products.length, "products inserted");

      // Log audit trail for partial success
      await logAudit(
        tenantContext.tenantId,
        tenantContext.userId,
        "BULK_CREATE",
        "product",
        req,
        undefined,
        {
          totalRequested: products.length,
          successCount: results.length,
          failureCount: errors.length,
          errors: errors,
        }
      );

      return jsonSuccess({
        success: false,
        partialSuccess: true,
        inserted: results.length,
        total: products.length,
        products: results,
        errors: errors,
        message: `${results.length} of ${products.length} products inserted. ${errors.length} failed.`,
      }, 207); // 207 Multi-Status
    }

    if (!insertedProducts || insertedProducts.length === 0) {
      console.error("[POST /api/bulk/upload] Batch insert returned no data");
      return jsonError("Failed to retrieve inserted products", 500);
    }

    console.log("[POST /api/bulk/upload] Bulk insert successful:", insertedProducts.length, "products");

    // Log audit trail
    await logAudit(
      tenantContext.tenantId,
      tenantContext.userId,
      "BULK_CREATE",
      "product",
      req,
      undefined,
      {
        count: insertedProducts.length,
        productIds: insertedProducts.map((p) => p.id),
      }
    );

    return jsonSuccess({
      success: true,
      partialSuccess: false,
      inserted: insertedProducts.length,
      total: products.length,
      products: insertedProducts,
      message: `Successfully inserted ${insertedProducts.length} products`,
    }, 201);
  } catch (err) {
    console.error("[POST /api/bulk/upload] Unexpected error:", err);
    return jsonError(
      `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`,
      500
    );
  }
}
