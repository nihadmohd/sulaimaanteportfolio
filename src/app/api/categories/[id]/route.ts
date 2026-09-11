import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { categoryUpdateSchema } from "@/lib/validation";
import { serializeCategory, uniqueSlugForCategory } from "@/app/api/_lib/serialize";

/**
 * PATCH/DELETE /api/categories/:id — staff-only category management.
 *
 * Deleting a category nulls out categoryId on its posts/products
 * (schema onDelete: SetNull) — no content is lost.
 */

interface Ctx {
  params: Promise<{ id: string }>;
}

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { posts: true, products: true } } },
  });
  if (!category) {
    throw new ApiError(404, "NOT_FOUND", "Category not found.");
  }

  await requireRole(req, STAFF_ROLES);
  const body = categoryUpdateSchema.parse(await readJson(req));

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) {
    data.slug = await uniqueSlugForCategory(body.slug, body.name ?? category.name, category.id);
  }
  if (body.description !== undefined) data.description = body.description ?? null;
  if (body.scope !== undefined) data.scope = body.scope;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  if (Object.keys(data).length === 0) {
    return ok(serializeCategory(category));
  }

  const updated = await db.category.update({
    where: { id },
    data,
    include: { _count: { select: { posts: true, products: true } } },
  });

  return ok(serializeCategory(updated));
});

export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const category = await db.category.findUnique({ where: { id } });
  if (!category) {
    throw new ApiError(404, "NOT_FOUND", "Category not found.");
  }

  await requireRole(req, STAFF_ROLES);
  await db.category.delete({ where: { id } });
  return ok({ id: category.id, deleted: true });
});
