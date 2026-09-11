import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, ok, pagination, readJson, withApi } from "@/lib/api-helpers";
import { AUTHOR_ROLES, STAFF_ROLES, getSessionUser, requireRole } from "@/lib/auth";
import { postCreateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import {
  postInclude,
  readingTimeFrom,
  serializePost,
  uniqueSlugForPost,
} from "@/app/api/_lib/serialize";

/**
 * GET /api/posts — public blog feed (BUILD CONTRACT §4).
 *
 * Query: status (published | own | all), category (slug), tag, q, featured=1,
 * page, limit (default 12), sort (recent → publishedAt desc | popular → views desc).
 * Public sees ONLY status=published AND publishedAt set.
 *   · status=own  → author's drafts+published (AUTHOR_ROLES)
 *   · status=all  → every status (STAFF_ROLES only)
 * POST /api/posts — create (AUTHOR_ROLES); auto-slug, auto reading time,
 * publishedAt when status=published.
 */

export const GET = withApi(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { page, limit, skip } = pagination(sp);
  const statusParam = sp.get("status") ?? "published";

  const user = await getSessionUser(req);
  const isStaff = user != null && STAFF_ROLES.includes(user.role);
  const isAuthor = user != null && AUTHOR_ROLES.includes(user.role);

  if (statusParam === "all" && !isStaff) {
    throw new ApiError(403, "FORBIDDEN", "Staff access is required to list all posts.");
  }
  if (statusParam === "own" && !isAuthor) {
    throw new ApiError(403, "FORBIDDEN", "Author access is required to list your own posts.");
  }

  const where: Prisma.PostWhereInput = {};

  if (statusParam === "all") {
    // staff: no status restriction
  } else if (statusParam === "own") {
    where.authorId = user!.id;
    where.status = { in: ["draft", "published"] };
  } else {
    // public default — published AND actually published
    where.status = "published";
    where.publishedAt = { not: null };
  }

  // category by slug (unknown slug → empty result, never an error)
  const categorySlug = sp.get("category");
  if (categorySlug) {
    const category = await db.category.findFirst({
      where: { slug: categorySlug, scope: "blog" },
      select: { id: true },
    });
    where.categoryId = category?.id ?? "00000000-0000-0000-0000-000000000000";
  }

  const tag = sp.get("tag");
  if (tag) {
    // tags column is a JSON array string — exact element match via quoted contains
    where.tags = { contains: JSON.stringify(tag) };
  }

  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { content: { contains: q } },
    ];
  }

  if (sp.get("featured") === "1") {
    where.isFeatured = true;
  }

  const sort = sp.get("sort") === "popular" ? "popular" : "recent";
  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    sort === "popular"
      ? [{ viewsCount: "desc" }, { publishedAt: "desc" }]
      : [{ publishedAt: "desc" }, { createdAt: "desc" }];

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({ where, orderBy, skip, take: limit, include: postInclude }),
  ]);

  return ok({ items: posts.map(serializePost), total, page, limit });
});

export const POST = withApi(async (req: Request) => {
  const user = await requireRole(req, AUTHOR_ROLES);
  const body = postCreateSchema.parse(await readJson(req));

  // categoryId (when provided) must exist
  if (body.categoryId) {
    const category = await db.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      throw new ApiError(400, "VALIDATION", "The selected category does not exist.");
    }
  }

  const slug = await uniqueSlugForPost(body.slug, body.title);
  const readingTimeMinutes = body.readingTimeMinutes ?? readingTimeFrom(body.content);
  const publishedAt =
    body.status === "published"
      ? body.publishedAt
        ? new Date(body.publishedAt)
        : new Date()
      : body.publishedAt
        ? new Date(body.publishedAt)
        : null;

  if (publishedAt && Number.isNaN(publishedAt.getTime())) {
    throw new ApiError(400, "VALIDATION", "publishedAt must be a valid ISO date string.");
  }

  const post = await db.post.create({
    data: {
      title: body.title,
      slug,
      excerpt: body.excerpt ?? null,
      content: body.content,
      coverImageUrl: body.coverImageUrl || null,
      status: body.status,
      isFeatured: body.isFeatured,
      tags: toJson(body.tags),
      readingTimeMinutes,
      seoTitle: body.seoTitle ?? null,
      seoDescription: body.seoDescription ?? null,
      ogImageUrl: body.ogImageUrl || null,
      canonicalUrl: body.canonicalUrl || null,
      publishedAt,
      categoryId: body.categoryId ?? null,
      authorId: user.id,
    },
    include: postInclude,
  });

  return ok(serializePost(post), { status: 201 });
});
