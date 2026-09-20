import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/legal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dynamic sitemap for Google Search Console indexing.
 * Origin: change SITE.url in src/lib/constants.ts to the production domain.
 * Hash routes map 1:1 to file routes on deploy (views are liftable).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://mohdnihadkp.vercel.app";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ventures`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/services`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/store`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/advertise`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/support`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/legal`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const legalPages: MetadataRoute.Sitemap = LEGAL_DOCS.map((doc) => ({
    url: `${base}/legal/${doc.slug}`,
    lastModified: new Date(doc.updated),
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  let postPages: MetadataRoute.Sitemap = [];
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const [posts, products] = await Promise.all([
      db.post.findMany({
        where: { status: "published", publishedAt: { not: null } },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
      }),
      db.product.findMany({
        where: { status: "active" },
        select: { slug: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    postPages = posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
    productPages = products.map((pr) => ({
      url: `${base}/store/${pr.slug}`,
      lastModified: pr.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable at build time — static + legal pages still ship.
  }

  return [...staticPages, ...postPages, ...productPages, ...legalPages];
}
