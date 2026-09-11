import { db } from "@/lib/db";
import { ApiError, ok, withApi } from "@/lib/api-helpers";
import { findPostByIdOrSlug } from "@/app/api/_lib/serialize";

/**
 * POST /api/posts/:idOrSlug/view — public view counter.
 *
 * Increments viewsCount and returns {views}. No server-side dedupe:
 * the client deduplicates via sessionStorage (mnkp_pv_<id>).
 */

interface Ctx {
  params: Promise<{ idOrSlug: string }>;
}

export const POST = withApi<Ctx>(async (_req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const post = await findPostByIdOrSlug(idOrSlug);
  if (!post) {
    throw new ApiError(404, "NOT_FOUND", "Post not found.");
  }

  const updated = await db.post.update({
    where: { id: post.id },
    data: { viewsCount: { increment: 1 } },
    select: { viewsCount: true },
  });

  return ok({ views: updated.viewsCount });
});
