import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, getSessionUser, requireRole } from "@/lib/auth";
import { productUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import {
  findProductByIdOrSlug,
  productInclude,
  serializeProduct,
  uniqueSlugForProduct,
} from "@/app/api/_lib/serialize";

/**
 * GET/PATCH/DELETE /api/products/:idOrSlug — product detail by id OR slug.
 *
 * Access: public → status=active only; staff (editor/admin) → any status,
 * plus PATCH/DELETE rights.
 */

interface Ctx {
  params: Promise<{ idOrSlug: string }>;
}

export const GET = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const product = await findProductByIdOrSlug(idOrSlug);
  if (!product) {
    throw new ApiError(404, "NOT_FOUND", "Product not found.");
  }

  const user = await getSessionUser(req);
  const isStaff = user != null && STAFF_ROLES.includes(user.role);
  if (product.status !== "active" && !isStaff) {
    // Never leak draft/archived catalog entries to the public store.
    throw new ApiError(404, "NOT_FOUND", "Product not found.");
  }

  return ok(serializeProduct(product));
});

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const product = await findProductByIdOrSlug(idOrSlug);
  if (!product) {
    throw new ApiError(404, "NOT_FOUND", "Product not found.");
  }

  await requireRole(req, STAFF_ROLES);
  const body = productUpdateSchema.parse(await readJson(req));

  if (body.categoryId) {
    const category = await db.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      throw new ApiError(400, "VALIDATION", "The selected category does not exist.");
    }
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) {
    data.slug = await uniqueSlugForProduct(body.slug, body.name ?? product.name, product.id);
  }
  if (body.tagline !== undefined) data.tagline = body.tagline ?? null;
  if (body.description !== undefined) data.description = body.description ?? null;
  if (body.brand !== undefined) data.brand = body.brand ?? null;
  if (body.merchant !== undefined) data.merchant = body.merchant ?? null;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null;
  if (body.gallery !== undefined) data.gallery = toJson(body.gallery);
  if (body.price !== undefined) data.price = body.price ?? null;
  if (body.compareAtPrice !== undefined) data.compareAtPrice = body.compareAtPrice ?? null;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.affiliateUrl !== undefined) data.affiliateUrl = body.affiliateUrl;
  if (body.pros !== undefined) data.pros = toJson(body.pros);
  if (body.cons !== undefined) data.cons = toJson(body.cons);
  if (body.keySpecs !== undefined) data.keySpecs = toJson(body.keySpecs);
  if (body.rating !== undefined) data.rating = body.rating;
  if (body.reviewCount !== undefined) data.reviewCount = body.reviewCount;
  if (body.status !== undefined) data.status = body.status;
  if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId ?? null;

  if (Object.keys(data).length === 0) {
    return ok(serializeProduct(product));
  }

  const updated = await db.product.update({
    where: { id: product.id },
    data,
    include: productInclude,
  });

  return ok(serializeProduct(updated));
});

export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const product = await findProductByIdOrSlug(idOrSlug);
  if (!product) {
    throw new ApiError(404, "NOT_FOUND", "Product not found.");
  }

  await requireRole(req, STAFF_ROLES);
  await db.product.delete({ where: { id: product.id } });
  return ok({ id: product.id, deleted: true });
});
