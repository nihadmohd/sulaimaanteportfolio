import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, ok, pagination, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, getSessionUser, requireRole } from "@/lib/auth";
import { productCreateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import {
  productInclude,
  productOfferLive,
  serializeProduct,
  uniqueSlugForProduct,
} from "@/app/api/_lib/serialize";

/**
 * GET /api/products — public store feed (BUILD CONTRACT §4).
 *
 * Query: category (slug), q, min, max, rating (gte), featured=1, page, limit
 * (default 12), sort (recent → createdAt desc | popular → clicks desc |
 * price-asc | price-desc). Public sees status=active only; staff may pass
 * status=all to see everything.
 * POST /api/products — create (STAFF_ROLES); auto-slug, arrays → toJson.
 */

export const GET = withApi(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { page, limit, skip } = pagination(sp);

  const user = await getSessionUser(req);
  const isStaff = user != null && STAFF_ROLES.includes(user.role);
  const statusParam = sp.get("status");

  if (statusParam === "all" && !isStaff) {
    throw new ApiError(403, "FORBIDDEN", "Staff access is required to list all products.");
  }

  const where: Prisma.ProductWhereInput = {};
  if (!(statusParam === "all" && isStaff)) {
    where.status = "active";
  }

  const categorySlug = sp.get("category");
  if (categorySlug) {
    const category = await db.category.findFirst({
      where: { slug: categorySlug, scope: "store" },
      select: { id: true },
    });
    where.categoryId = category?.id ?? "00000000-0000-0000-0000-000000000000";
  }

  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { brand: { contains: q } },
      { tagline: { contains: q } },
    ];
  }

  const min = sp.get("min");
  if (min && !Number.isNaN(Number(min))) {
    where.price = { ...(where.price as Prisma.FloatNullableFilter ?? {}), gte: Number(min) };
  }
  const max = sp.get("max");
  if (max && !Number.isNaN(Number(max))) {
    where.price = { ...(where.price as Prisma.FloatNullableFilter ?? {}), lte: Number(max) };
  }

  const rating = sp.get("rating");
  if (rating && !Number.isNaN(Number(rating))) {
    where.rating = { gte: Number(rating) };
  }

  if (sp.get("featured") === "1") {
    where.isFeatured = true;
  }

  // Task 14 — special offers feed: only products whose offer is switched on
  // AND inside its optional schedule window. The window check needs row
  // values, so it is applied after the query (bounded by the page limit).
  const wantsOffers = sp.get("offer") === "1";
  if (wantsOffers) {
    where.offerActive = true;
  }

  const sort = sp.get("sort");
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "popular"
      ? [{ clicksCount: "desc" }, { createdAt: "desc" }]
      : sort === "price-asc"
        ? [{ price: "asc" }, { createdAt: "desc" }]
        : sort === "price-desc"
          ? [{ price: "desc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, orderBy, skip, take: limit, include: productInclude }),
  ]);

  const items = wantsOffers ? products.filter(productOfferLive) : products;

  return ok({ items: items.map(serializeProduct), total, page, limit });
});

export const POST = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);
  const body = productCreateSchema.parse(await readJson(req));

  if (body.categoryId) {
    const category = await db.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      throw new ApiError(400, "VALIDATION", "The selected category does not exist.");
    }
  }

  const slug = await uniqueSlugForProduct(body.slug, body.name);

  const product = await db.product.create({
    data: {
      name: body.name,
      slug,
      tagline: body.tagline ?? null,
      description: body.description ?? null,
      brand: body.brand ?? null,
      merchant: body.merchant ?? null,
      imageUrl: body.imageUrl || null,
      gallery: toJson(body.gallery),
      price: body.price ?? null,
      compareAtPrice: body.compareAtPrice ?? null,
      currency: body.currency,
      affiliateUrl: body.affiliateUrl,
      pros: toJson(body.pros),
      cons: toJson(body.cons),
      keySpecs: toJson(body.keySpecs),
      rating: body.rating,
      reviewCount: body.reviewCount,
      status: body.status,
      isFeatured: body.isFeatured,
      categoryId: body.categoryId ?? null,
      // ---- special offer (Task 14) ----
      offerActive: body.offerActive,
      offerTitle: body.offerTitle || null,
      offerDescription: body.offerDescription || null,
      offerKind: body.offerKind,
      offerCode: body.offerCode || null,
      offerStartsAt: body.offerStartsAt ? new Date(body.offerStartsAt) : null,
      offerEndsAt: body.offerEndsAt ? new Date(body.offerEndsAt) : null,
    },
    include: productInclude,
  });

  return ok(serializeProduct(product), { status: 201 });
});
