import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { importPostsSchema, importProductsSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";

/**
 * POST /api/import — STAFF. Bulk-import posts and/or products from JSON
 * (the migration path for bringing an old site's content into this one).
 *
 * Body: { posts?: [...], products?: [...] } — at least one array required.
 * Existing slugs are SKIPPED (never overwritten), so re-running is safe.
 * Every import writes one audit entry with a full summary.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150) || `item-${Date.now()}`;
}

async function uniqueSlug(base: string, exists: (s: string) => Promise<boolean>): Promise<string> {
  let slug = base;
  let n = 2;
  while (await exists(slug)) {
    slug = `${base}-${n}`;
    n += 1;
    if (n > 50) {
      slug = `${base}-${Date.now()}`;
      break;
    }
  }
  return slug;
}

function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const POST = withApi(async (req) => {
  const user = await requireRole(req, STAFF_ROLES);
  const raw = (await readJson(req)) as Record<string, unknown>;

  const hasPosts = Array.isArray(raw.posts);
  const hasProducts = Array.isArray(raw.products);
  if (!hasPosts && !hasProducts) {
    throw new ApiError(400, "VALIDATION", 'Body must include a "posts" and/or "products" array.');
  }

  const postsInput = hasPosts ? importPostsSchema.parse({ posts: raw.posts }).posts : [];
  const productsInput = hasProducts ? importProductsSchema.parse({ products: raw.products }).products : [];

  const createdPosts: string[] = [];
  const skippedPosts: string[] = [];
  const createdProducts: string[] = [];
  const skippedProducts: string[] = [];
  const errors: string[] = [];

  for (const p of postsInput) {
    try {
      const base = p.slug || slugify(p.title);
      const slug = await uniqueSlug(base, async (s) => {
        const found = await db.post.findUnique({ where: { slug: s }, select: { id: true } });
        return !!found;
      });
      if (slug !== base && p.slug) {
        skippedPosts.push(`${p.slug} (slug taken — imported as ${slug})`);
      }
      const post = await db.post.create({
        data: {
          slug,
          title: p.title,
          excerpt: p.excerpt ?? null,
          content: p.content,
          coverImageUrl: p.coverImageUrl || null,
          tags: toJson(p.tags ?? []),
          status: p.status,
          readingTimeMinutes: readingTime(p.content),
          seoTitle: p.seoTitle ?? null,
          seoDescription: p.seoDescription ?? null,
          canonicalUrl: p.canonicalUrl || null,
          authorId: user.id,
          publishedAt:
            p.status === "published" ? new Date(p.publishedAt ?? Date.now()) : null,
        },
        select: { id: true, title: true },
      });
      createdPosts.push(post.title);
    } catch (e) {
      errors.push(`Post "${p.title}": ${(e as Error).message}`);
    }
  }

  for (const p of productsInput) {
    try {
      const base = p.slug || slugify(p.name);
      const slug = await uniqueSlug(base, async (s) => {
        const found = await db.product.findUnique({ where: { slug: s }, select: { id: true } });
        return !!found;
      });
      if (slug !== base && p.slug) {
        skippedProducts.push(`${p.slug} (slug taken — imported as ${slug})`);
      }
      const product = await db.product.create({
        data: {
          slug,
          name: p.name,
          tagline: p.tagline ?? null,
          description: p.description ?? null,
          brand: p.brand ?? null,
          merchant: p.merchant ?? null,
          imageUrl: p.imageUrl || null,
          price: p.price ?? null,
          compareAtPrice: p.compareAtPrice ?? null,
          affiliateUrl: p.affiliateUrl,
          rating: p.rating,
          status: p.status,
          isFeatured: p.isFeatured,
          pros: toJson(p.pros ?? []),
          cons: toJson(p.cons ?? []),
        },
        select: { id: true, name: true },
      });
      createdProducts.push(product.name);
    } catch (e) {
      errors.push(`Product "${p.name}": ${(e as Error).message}`);
    }
  }

  const summary = {
    posts: { received: postsInput.length, created: createdPosts.length, skipped: skippedPosts },
    products: { received: productsInput.length, created: createdProducts.length, skipped: skippedProducts },
    createdPosts,
    createdProducts,
    errors,
  };

  await writeAudit({
    user,
    action: "import",
    entity: "import",
    entityId: null,
    label: `Import — ${createdPosts.length} posts · ${createdProducts.length} products`,
    before: null,
    after: summary,
  });

  return ok(summary, { status: 201 });
});
