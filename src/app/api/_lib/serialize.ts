import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseJsonArray,
  parseJsonRecord,
  type CategoryDTO,
  type InquiryDTO,
  type PlanDTO,
  type PostDTO,
  type ProductDTO,
} from "@/types";

/**
 * Internal serialization helpers for the 4-a API routes.
 *
 * The Prisma/SQLite mirror stores arrays/objects as JSON strings; every
 * response leaves this layer with those columns PARSED (BUILD CONTRACT
 * §4 / 2-a handoff): tags/gallery/pros/cons/features → string[],
 * keySpecs/limits → Record<string,string>.
 *
 * Lives under app/api/_lib (underscore prefix → private folder, never a
 * route) so it stays inside the 4-a ownership boundary.
 */

/* ------------------------------------------------------------------ */
/* include shapes (single source for list/detail queries)             */
/* ------------------------------------------------------------------ */

const postInclude = {
  author: { select: { id: true, fullName: true, headline: true, avatarUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.PostInclude;

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type PostFull = Prisma.PostGetPayload<{ include: typeof postInclude }>;
export type ProductFull = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
export type CategoryWithCount = Prisma.CategoryGetPayload<{
  include: { _count: { select: { posts: true; products: true } } };
}>;
export type PlanRow = Prisma.PlanGetPayload<Record<string, never>>;
export type InquiryRow = Prisma.InquiryGetPayload<Record<string, never>>;

export { postInclude, productInclude };

/* ------------------------------------------------------------------ */
/* serializers                                                         */
/* ------------------------------------------------------------------ */

export function serializePost(post: PostFull): PostDTO {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImageUrl: post.coverImageUrl,
    status: post.status as PostDTO["status"],
    isFeatured: post.isFeatured,
    tags: parseJsonArray(post.tags),
    readingTimeMinutes: post.readingTimeMinutes,
    viewsCount: post.viewsCount,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    ogImageUrl: post.ogImageUrl,
    canonicalUrl: post.canonicalUrl,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author
      ? {
          id: post.author.id,
          fullName: post.author.fullName,
          headline: post.author.headline,
          avatarUrl: post.author.avatarUrl,
        }
      : null,
    category: post.category
      ? { id: post.category.id, name: post.category.name, slug: post.category.slug }
      : null,
  };
}

export function serializeProduct(product: ProductFull): ProductDTO {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    brand: product.brand,
    merchant: product.merchant,
    imageUrl: product.imageUrl,
    gallery: parseJsonArray(product.gallery),
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    affiliateUrl: product.affiliateUrl,
    pros: parseJsonArray(product.pros),
    cons: parseJsonArray(product.cons),
    keySpecs: parseJsonRecord(product.keySpecs),
    rating: product.rating,
    reviewCount: product.reviewCount,
    status: product.status as ProductDTO["status"],
    isFeatured: product.isFeatured,
    clicksCount: product.clicksCount,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function serializeCategory(cat: CategoryWithCount): CategoryDTO & {
  postCount: number;
  productCount: number;
} {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    scope: cat.scope as CategoryDTO["scope"],
    sortOrder: cat.sortOrder,
    createdAt: cat.createdAt.toISOString(),
    postCount: cat._count.posts,
    productCount: cat._count.products,
  };
}

export function serializePlan(plan: PlanRow): PlanDTO {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    features: parseJsonArray(plan.features),
    limits: parseJsonRecord(plan.limits),
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    sortOrder: plan.sortOrder,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function serializeInquiry(inquiry: InquiryRow): InquiryDTO {
  return {
    id: inquiry.id,
    userId: inquiry.userId,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    type: inquiry.type as InquiryDTO["type"],
    subject: inquiry.subject,
    message: inquiry.message,
    status: inquiry.status as InquiryDTO["status"],
    priority: inquiry.priority as InquiryDTO["priority"],
    internalNote: inquiry.internalNote,
    repliedAt: inquiry.repliedAt ? inquiry.repliedAt.toISOString() : null,
    createdAt: inquiry.createdAt.toISOString(),
    updatedAt: inquiry.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* slug + reading-time helpers                                         */
/* ------------------------------------------------------------------ */

/** lowercase-dash slug from arbitrary text ("My Post! 2025" → "my-post-2025"). */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug.length >= 3 ? slug : "item";
}

/** Find a free slug: base, base-2, base-3 ... (checked against the table). */
async function findFreeSlug(
  table: "post" | "product" | "category",
  base: string,
  excludeId?: string
): Promise<string> {
  const notId = excludeId ? { NOT: { id: excludeId } } : {};
  const exists = async (candidate: string): Promise<boolean> => {
    if (table === "post") {
      return (await db.post.findFirst({ where: { slug: candidate, ...notId } })) != null;
    }
    if (table === "product") {
      return (await db.product.findFirst({ where: { slug: candidate, ...notId } })) != null;
    }
    return (await db.category.findFirst({ where: { slug: candidate, ...notId } })) != null;
  };

  let candidate = base;
  if (!(await exists(candidate))) return candidate;
  for (let suffix = 2; suffix < 60; suffix += 1) {
    candidate = `${base}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Practically unreachable; fall back to a random tail.
  return `${base}-${Date.now().toString(36)}`;
}

/** Unique slug for a post, derived from a title or the explicit slug. */
export async function uniqueSlugForPost(
  providedSlug: string | undefined,
  title: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(providedSlug && providedSlug.trim() ? providedSlug : title);
  return findFreeSlug("post", base, excludeId);
}

/** Unique slug for a product, derived from a name or the explicit slug. */
export async function uniqueSlugForProduct(
  providedSlug: string | undefined,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(providedSlug && providedSlug.trim() ? providedSlug : name);
  return findFreeSlug("product", base, excludeId);
}

/** Unique slug for a category, derived from a name or the explicit slug. */
export async function uniqueSlugForCategory(
  providedSlug: string | undefined,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(providedSlug && providedSlug.trim() ? providedSlug : name);
  return findFreeSlug("category", base, excludeId);
}

/** Reading time: words / 200, minimum 1 minute. */
export function readingTimeFrom(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Resolve a post by id OR slug (idOrSlug route params). */
export async function findPostByIdOrSlug(idOrSlug: string): Promise<PostFull | null> {
  return db.post.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: postInclude,
  });
}

/** Resolve a product by id OR slug (idOrSlug route params). */
export async function findProductByIdOrSlug(idOrSlug: string): Promise<ProductFull | null> {
  return db.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: productInclude,
  });
}

/** Parse an optional ISO date string; invalid dates throw a 400-style Error. */
export function parseOptionalDate(value: string | undefined | null): Date | null | undefined {
  if (value == null || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }
  return date;
}
