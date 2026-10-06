// app/api/analytics/route.ts - Product and sales analytics
import { getServerTenantContext, jsonError, jsonSuccess } from "@/lib/api";
import { getProductAnalytics, getSalesAnalytics, resolveSalesAnalyticsDateRange } from "@/lib/search";
import { z } from "zod";

const AnalyticsQuerySchema = z.object({
  type: z.enum(["products", "sales"]),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const tenantContext = await getServerTenantContext(req);
  if ("error" in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  const url = new URL(req.url);
  const parseResult = AnalyticsQuerySchema.safeParse({
    type: url.searchParams.get("type"),
    startDate: url.searchParams.get("startDate"),
    endDate: url.searchParams.get("endDate"),
  });

  if (!parseResult.success) {
    return jsonError(parseResult.error.issues.map((i) => i.message).join(", "), 422);
  }

  try {
    const { type, startDate, endDate } = parseResult.data;

    if (type === "products") {
      const analytics = await getProductAnalytics(tenantContext.tenantId);
      return jsonSuccess(analytics);
    }

    if (type === "sales") {
      let dateRange: { start: Date; end: Date };
      try {
        dateRange = resolveSalesAnalyticsDateRange(startDate, endDate);
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : "Invalid analytics date range", 422);
      }

      const analytics = await getSalesAnalytics(tenantContext.tenantId, dateRange.start, dateRange.end);
      return jsonSuccess(analytics);
    }

    return jsonError("Invalid analytics type", 400);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Analytics failed", 500);
  }
}
