import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";

/**
 * POST /api/ads/:id/impression — PUBLIC. Fire-and-forget impression
 * counter; the AdSlot component batches these (one per ad per page view).
 */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  try {
    await db.ad.update({ where: { id }, data: { impressions: { increment: 1 } } });
  } catch {
    // Unknown id — impressions must never break the page.
  }
  return ok({ id, counted: true });
});
