import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { AUTHOR_ROLES, STAFF_ROLES, getSessionUser, requireUser } from "@/lib/auth";
import { postUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import {
  findPostByIdOrSlug,
  postInclude,
  readingTimeFrom,
  serializePost,
  uniqueSlugForPost,
} from "@/app/api/_lib/serialize";

/**
 * GET/PATCH/DELETE /api/posts/:idOrSlug — post detail by id OR slug.
 *
 * Access: published → public; draft/archived → author-own or staff
 * (everyone else gets a 404 so unpublished work never leaks).
 * Mutations: author-own or staff (403 otherwise).
 */

interface Ctx {
  params: Promise<{ idOrSlug: string }>;
}

async function resolveAccessible(idOrSlug: string) {
  const post = await findPostByIdOrSlug(idOrSlug);
  if (!post) throw new ApiError(404, "NOT_FOUND", "Post not found.");
  return post;
}

export const GET = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const post = await resolveAccessible(idOrSlug);

  const user = await getSessionUser(req);
  const isStaff = user != null && STAFF_ROLES.includes(user.role);
  const isOwn = user != null && post.authorId === user.id;

  if (post.status !== "published" && !(isStaff || isOwn)) {
    // Hide the existence of drafts/archived posts from everyone else.
    throw new ApiError(404, "NOT_FOUND", "Post not found.");
  }
  if (post.status === "published" && post.publishedAt == null && !(isStaff || isOwn)) {
    throw new ApiError(404, "NOT_FOUND", "Post not found.");
  }

  return ok(serializePost(post));
});

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const post = await resolveAccessible(idOrSlug);

  const user = await requireUser(req);
  const isStaff = STAFF_ROLES.includes(user.role);
  const isOwn = post.authorId === user.id;
  if (!isStaff && !isOwn) {
    throw new ApiError(403, "FORBIDDEN", "You can only edit your own posts.");
  }

  const body = postUpdateSchema.parse(await readJson(req));

  if (body.categoryId) {
    const category = await db.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      throw new ApiError(400, "VALIDATION", "The selected category does not exist.");
    }
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) data.title = body.title;
  // slug is only regenerated when EXPLICITLY provided
  if (body.slug !== undefined) {
    data.slug = await uniqueSlugForPost(body.slug, body.title ?? post.title, post.id);
  }
  if (body.excerpt !== undefined) data.excerpt = body.excerpt ?? null;
  if (body.content !== undefined) {
    data.content = body.content;
    if (body.readingTimeMinutes === undefined) {
      data.readingTimeMinutes = readingTimeFrom(body.content);
    }
  }
  if (body.coverImageUrl !== undefined) data.coverImageUrl = body.coverImageUrl || null;
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "published" && post.publishedAt == null && body.publishedAt === undefined) {
      data.publishedAt = new Date();
    }
  }
  if (body.publishedAt !== undefined && body.publishedAt != null && body.publishedAt !== "") {
    const date = new Date(body.publishedAt);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, "VALIDATION", "publishedAt must be a valid ISO date string.");
    }
    data.publishedAt = date;
  }
  if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
  if (body.tags !== undefined) data.tags = toJson(body.tags);
  if (body.readingTimeMinutes !== undefined) data.readingTimeMinutes = body.readingTimeMinutes;
  if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle ?? null;
  if (body.seoDescription !== undefined) data.seoDescription = body.seoDescription ?? null;
  if (body.ogImageUrl !== undefined) data.ogImageUrl = body.ogImageUrl || null;
  if (body.canonicalUrl !== undefined) data.canonicalUrl = body.canonicalUrl || null;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId ?? null;

  if (Object.keys(data).length === 0) {
    return ok(serializePost(post));
  }

  const updated = await db.post.update({
    where: { id: post.id },
    data,
    include: postInclude,
  });

  await writeAudit({
    user,
    action: "update",
    entity: "post",
    entityId: post.id,
    label: `Post — ${updated.title}`,
    before: postSnapshot(post),
    after: postSnapshot(updated),
  });

  return ok(serializePost(updated));
});

/** Raw-row snapshot for the audit undo/redo engine (JSON columns as stored). */
function postSnapshot(post: Record<string, unknown> & { id: string }): Record<string, unknown> {
  return JSON.parse(JSON.stringify(post)) as Record<string, unknown>;
}

export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const post = await resolveAccessible(idOrSlug);

  const user = await requireUser(req);
  const isStaff = STAFF_ROLES.includes(user.role);
  const isOwn = post.authorId === user.id;
  if (!isStaff && !isOwn) {
    throw new ApiError(403, "FORBIDDEN", "You can only delete your own posts.");
  }

  const before = await db.post.findUnique({ where: { id: post.id } });
  await db.post.delete({ where: { id: post.id } });
  await writeAudit({
    user,
    action: "delete",
    entity: "post",
    entityId: post.id,
    label: `Post — ${post.title}`,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: null,
  });
  return ok({ id: post.id, deleted: true });
});
