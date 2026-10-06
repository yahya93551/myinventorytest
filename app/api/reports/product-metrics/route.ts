import { z } from "zod";
import { getServerTenantContext, requireActiveSubscription, jsonError, jsonSuccess } from "@/lib/api";
import { getProductMetrics } from "@/lib/productMetrics";

const ProductMetricsQuerySchema = z.object({
  filter: z.enum(["7d", "30d", "all"]).optional().default("30d"),
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

  const url = new URL(req.url);
  const parseResult = ProductMetricsQuerySchema.safeParse({
    filter: url.searchParams.get("filter"),
  });

  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((issue) => issue.message).join(", "), 422);
  }

  const { filter } = parseResult.data;
  try {
    return jsonSuccess(await getProductMetrics(tenantContext.tenantId, filter));
  } catch (loadError) {
    return jsonError(loadError instanceof Error ? loadError.message : "Unable to load product metrics.", 500);
  }
}
