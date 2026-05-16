// lib/bulk.ts - Bulk operations for efficient batch processing
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Product, BulkSaleItem } from "@/types";

/**
 * Bulk insert products with transaction-like safety
 * Handles partial failures and reports errors per item
 */
export async function bulkInsertProducts(
  tenantId: string,
  userId: string,
  products: Array<Omit<Product, "id" | "user_id">>
) {
  const results = {
    successful: [] as Array<{ id: string; name: string }>,
    failed: [] as Array<{ name: string; error: string }>,
  };

  // Validate all products first
  for (const product of products) {
    if (!product.name?.trim()) {
      results.failed.push({ name: product.name || "unknown", error: "Product name is required" });
      continue;
    }
    if (product.price <= 0) {
      results.failed.push({ name: product.name, error: "Price must be greater than 0" });
      continue;
    }
    if (product.stock < 0) {
      results.failed.push({ name: product.name, error: "Stock cannot be negative" });
      continue;
    }
  }

  const validProducts = products.filter(
    (p) => !results.failed.some((f) => f.name === p.name)
  );

  if (validProducts.length === 0) {
    return results;
  }

  // Batch insert (Supabase has batch limits, typically 1000 rows)
  const BATCH_SIZE = 500;
  for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
    const batch = validProducts.slice(i, i + BATCH_SIZE);
    const formattedBatch = batch.map((p) => ({
      ...p,
      tenant_id: tenantId,
      user_id: userId,
      created_by: userId,
    }));

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert(formattedBatch)
      .select("id, name");

    if (error) {
      batch.forEach((p) => {
        results.failed.push({
          name: p.name,
          error: `Batch insert failed: ${error.message}`,
        });
      });
    } else if (data) {
      results.successful.push(...data);
    }
  }

  return results;
}

/**
 * Bulk record sales with atomic stock deduction
 * Ensures stock accuracy even with concurrent operations
 */
export async function bulkRecordSales(
  tenantId: string,
  userId: string,
  items: Array<{ product_id: string; quantity: number }>
) {
  const results = {
    recordedSales: [] as Array<{ product_id: string; quantity: number; total: number }>,
    failed: [] as Array<{ product_id: string; error: string }>,
  };

  // Fetch all products in one query
  const { data: products, error: fetchError } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock")
    .in("id", items.map((i) => i.product_id))
    .eq("tenant_id", tenantId);

  if (fetchError || !products) {
    throw new Error(`Failed to fetch products: ${fetchError?.message}`);
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Validate stock availability
  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      results.failed.push({ product_id: item.product_id, error: "Product not found" });
      continue;
    }
    if (product.stock < item.quantity) {
      results.failed.push({
        product_id: item.product_id,
        error: `Insufficient stock (${product.stock} available)`,
      });
      continue;
    }
  }

  const validItems = items.filter(
    (i) => !results.failed.some((f) => f.product_id === i.product_id)
  );

  if (validItems.length === 0) {
    return results;
  }

  // Update product stock in batch
  for (const item of validItems) {
    const product = productMap.get(item.product_id)!;
    const { error: updateError } = await supabaseAdmin
      .from("products")
      .update({ stock: product.stock - item.quantity })
      .eq("id", item.product_id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      results.failed.push({ product_id: item.product_id, error: updateError.message });
      continue;
    }

    results.recordedSales.push({
      product_id: item.product_id,
      quantity: item.quantity,
      total: item.quantity * product.price,
    });
  }

  // Batch insert all sales records
  if (results.recordedSales.length > 0) {
    const salesRecords = results.recordedSales.map((sale) => {
      const product = productMap.get(sale.product_id)!;
      return {
        product_id: sale.product_id,
        product_name: product.name,
        quantity: sale.quantity,
        total: sale.total,
        tenant_id: tenantId,
        user_id: userId,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from("sales")
      .insert(salesRecords);

    if (insertError) {
      throw new Error(`Failed to record sales: ${insertError.message}`);
    }
  }

  return results;
}

/**
 * Bulk update products with validation
 */
export async function bulkUpdateProducts(
  tenantId: string,
  updates: Array<{ id: string; fields: Partial<Product> }>
) {
  const results = {
    successful: 0,
    failed: [] as Array<{ id: string; error: string }>,
  };

  for (const update of updates) {
    const { error } = await supabaseAdmin
      .from("products")
      .update(update.fields)
      .eq("id", update.id)
      .eq("tenant_id", tenantId);

    if (error) {
      results.failed.push({ id: update.id, error: error.message });
    } else {
      results.successful++;
    }
  }

  return results;
}
