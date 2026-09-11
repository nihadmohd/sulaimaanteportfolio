import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { serializePlan } from "@/app/api/_lib/serialize";

/**
 * GET /api/plans — public billing catalog.
 *
 * Active plans ordered by sortOrder; features/limits JSON columns parsed.
 */

export const GET = withApi(async () => {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
  });
  return ok(plans.map(serializePlan));
});
