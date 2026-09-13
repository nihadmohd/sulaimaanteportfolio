import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { categoryCreateSchema } from "@/lib/validation";
import { serializeCategory, uniqueSlugForCategory } from "@/app/api/_lib/serialize";

/**
 * GET /api/categories — public category list (BUILD CONTRACT §4).
 *
 * Query: scope=blog|store (omit → both scopes). Each item carries
 * postCount / productCount mapped from Prisma _count.
 * POST /api/categories — create (STAFF_ROLES); auto-slug from name.
 */

export const GET = withApi(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope");

  const where: Prisma.CategoryWhereInput = {};
  if (scope === "blog" || scope === "store") {
    where.scope = scope;
  }

  const categories = await db.category.findMany({
    where,
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true, products: true } } },
  });

  return ok(categories.map(serializeCategory));
});

export const POST = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);
  const body = categoryCreateSchema.parse(await readJson(req));

  const slug = await uniqueSlugForCategory(body.slug, body.name);

  const category = await db.category.create({
    data: {
      name: body.name,
      slug,
      description: body.description ?? null,
      scope: body.scope,
      sortOrder: body.sortOrder,
    },
    include: { _count: { select: { posts: true, products: true } } },
  });

  return ok(serializeCategory(category), { status: 201 });
});
