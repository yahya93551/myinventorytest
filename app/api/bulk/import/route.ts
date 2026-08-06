// app/api/bulk/import/route.ts - Bulk import products from CSV/Excel
import { z } from "zod";
import { bulkInsertProducts } from "@/lib/bulk";
import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";
import { invalidateProductCaches } from "@/lib/cache";
import { BaseProductSchema } from "@/types";

const BulkImportSchema = z.object({
  products: z.array(
    BaseProductSchema.pick({
      name: true,
      category: true,
      cost_price: true,
      price: true,
      stock: true,
    })
  ),
});

export async function POST(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  if (!["owner", "accountant"].includes(tenantContext.role)) {
    return jsonError("Only owners or accountants can import products", 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parseResult = BulkImportSchema.safeParse(payload);
  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  if (parseResult.data.products.length === 0) {
    return jsonError("No products to import", 400);
  }

  if (parseResult.data.products.length > 5000) {
    return jsonError("Cannot import more than 5000 products at once", 413);
  }

  try {
    const results = await bulkInsertProducts(
      tenantContext.tenantId,
      tenantContext.userId,
      parseResult.data.products
    );

    // Invalidate caches after import
    if (results.successful.length > 0) {
      await invalidateProductCaches(tenantContext.tenantId);
    }

    return jsonSuccess(
      {
        imported: results.successful.length,
        failed: results.failed.length,
        items: results,
      },
      201
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Import failed", 500);
  }
}
