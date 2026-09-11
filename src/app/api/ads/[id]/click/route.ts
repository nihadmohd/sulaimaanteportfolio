import { db } from "@/lib/db";
import { ApiError, ok, withApi } from "@/lib/api-helpers";

/**
 * POST /api/ads/:id/click — PUBLIC. Increments the click counter and
 * returns the click-through URL; the client opens it in a new tab
 * (keeps rel="sponsored noopener" on the rendered side).
 */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const ad = await db.ad.findUnique({ where: { id } });
  if (!ad || !ad.active) throw new ApiError(404, "NOT_FOUND", "Ad not found.");

  await db.ad.update({ where: { id }, data: { clicks: { increment: 1 } } });
  return ok({ id, url: ad.linkUrl ?? null });
});
