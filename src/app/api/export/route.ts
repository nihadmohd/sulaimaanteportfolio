import { db } from "@/lib/db";
import { ApiError, ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { toCsv, type CsvCell } from "@/lib/csv";

/**
 * GET /api/export — STAFF (Task 11-b). Full-content CSV export of every
 * content table on the site, so the owner can back up, migrate or
 * round-trip ("export → re-import") their data.
 *
 * Query:
 *   type   = posts | products | categories | ventures | ads | inquiries |
 *            subscribers | users | settings        (required)
 *   format = csv (default) | json
 *
 * CSV: text/csv attachment "mnkp-{type}-{YYYYMMDD}.csv", rows ordered
 * createdAt asc (settings: key asc; subscribers: subscribedAt asc),
 * full column set so /api/import CSV mode can rebuild the rows.
 * JSON: the same records as an array inside the standard ok() envelope.
 *
 * PRIVACY: users export is a safe subset only — passwordHash, verification
 * and reset tokens, socials and bio are NEVER included. Subscriber
 * confirmTokens and inquiry internal notes are excluded as well.
 *
 * Concurrency guard: the Venture model is being added by a parallel task;
 * if its table is not present in this Prisma client / database yet, the
 * ventures export degrades to a graceful header-only CSV (plus an
 * x-mnkp-note response header) instead of failing.
 */

const EXPORT_TYPES = [
  "posts",
  "products",
  "categories",
  "ventures",
  "ads",
  "inquiries",
  "subscribers",
  "users",
  "settings",
] as const;

type ExportType = (typeof EXPORT_TYPES)[number];

interface ExportDataset {
  headers: string[];
  /** One record per row; keys = headers, values already string-friendly. */
  records: Record<string, CsvCell>[];
  /** Set when the dataset was intentionally empty (e.g. ventures not ready). */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Date → ISO string, or "" for null/undefined (empty CSV cell). */
function iso(value: Date | null | undefined): string {
  return value ? value.toISOString() : "";
}

/** Raw JSON-string column (tags/gallery/...) exported verbatim. */
function jsonColumn(value: string | null | undefined): string {
  return value ?? "";
}

/* ------------------------------------------------------------------ */
/* ventures concurrency guard (typed, no `any`)                        */
/* ------------------------------------------------------------------ */

/** Shape of a Venture row as exported (matches the 11-a model contract). */
interface VentureExportRow {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  status: string;
  location: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  highlights: string;
  collabRoles: string;
  sortOrder: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Minimal structural delegate for the ventures table. Resolved via a typed
 * cast so this file compiles whether or not the Venture model has landed
 * in the generated Prisma client yet; null when the table is absent.
 */
function venturesTable(): {
  findMany(args?: { orderBy?: { createdAt: "asc" }[] }): Promise<VentureExportRow[]>;
} | null {
  const delegate = (
    db as unknown as {
      venture?: { findMany(args?: { orderBy?: { createdAt: "asc" }[] }): Promise<VentureExportRow[]> };
    }
  ).venture;
  return delegate && typeof delegate === "object" && typeof delegate.findMany === "function"
    ? delegate
    : null;
}

const VENTURES_NOT_READY =
  "Ventures table not ready yet — nothing exported. Retry after the ventures migration has been applied.";

/* ------------------------------------------------------------------ */
/* per-entity collectors                                               */
/* ------------------------------------------------------------------ */

async function exportPosts(): Promise<ExportDataset> {
  const rows = await db.post.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { slug: true } } },
  });
  return {
    headers: [
      "slug", "title", "excerpt", "content", "coverImageUrl", "status", "isFeatured",
      "tags", "readingTimeMinutes", "viewsCount", "seoTitle", "seoDescription",
      "ogImageUrl", "canonicalUrl", "categorySlug", "publishedAt", "createdAt", "updatedAt",
    ],
    records: rows.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      content: p.content,
      coverImageUrl: p.coverImageUrl ?? "",
      status: p.status,
      isFeatured: p.isFeatured,
      tags: jsonColumn(p.tags),
      readingTimeMinutes: p.readingTimeMinutes,
      viewsCount: p.viewsCount,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      ogImageUrl: p.ogImageUrl ?? "",
      canonicalUrl: p.canonicalUrl ?? "",
      categorySlug: p.category?.slug ?? "",
      publishedAt: iso(p.publishedAt),
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
    })),
  };
}

async function exportProducts(): Promise<ExportDataset> {
  const rows = await db.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { slug: true } } },
  });
  return {
    headers: [
      "slug", "name", "tagline", "description", "brand", "merchant", "imageUrl",
      "gallery", "price", "compareAtPrice", "currency", "affiliateUrl", "pros", "cons",
      "keySpecs", "rating", "reviewCount", "status", "isFeatured", "clicksCount",
      "categorySlug", "createdAt", "updatedAt",
    ],
    records: rows.map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline ?? "",
      description: p.description ?? "",
      brand: p.brand ?? "",
      merchant: p.merchant ?? "",
      imageUrl: p.imageUrl ?? "",
      gallery: jsonColumn(p.gallery),
      price: p.price ?? "",
      compareAtPrice: p.compareAtPrice ?? "",
      currency: p.currency,
      affiliateUrl: p.affiliateUrl,
      pros: jsonColumn(p.pros),
      cons: jsonColumn(p.cons),
      keySpecs: jsonColumn(p.keySpecs),
      rating: p.rating,
      reviewCount: p.reviewCount,
      status: p.status,
      isFeatured: p.isFeatured,
      clicksCount: p.clicksCount,
      categorySlug: p.category?.slug ?? "",
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
    })),
  };
}

async function exportCategories(): Promise<ExportDataset> {
  const rows = await db.category.findMany({ orderBy: { createdAt: "asc" } });
  return {
    headers: ["name", "slug", "description", "scope", "sortOrder", "createdAt"],
    records: rows.map((c) => ({
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      scope: c.scope,
      sortOrder: c.sortOrder,
      createdAt: iso(c.createdAt),
    })),
  };
}

async function exportVentures(): Promise<ExportDataset> {
  const headers = [
    "slug", "name", "tagline", "description", "category", "status", "location",
    "websiteUrl", "imageUrl", "highlights", "collabRoles", "sortOrder", "isFeatured",
    "createdAt", "updatedAt",
  ];
  const table = venturesTable();
  if (!table) return { headers, records: [], note: VENTURES_NOT_READY };
  try {
    const rows = await table.findMany({ orderBy: [{ createdAt: "asc" }] });
    return {
      headers,
      records: rows.map((v) => ({
        slug: v.slug,
        name: v.name,
        tagline: v.tagline ?? "",
        description: v.description ?? "",
        category: v.category ?? "",
        status: v.status,
        location: v.location ?? "",
        websiteUrl: v.websiteUrl ?? "",
        imageUrl: v.imageUrl ?? "",
        highlights: jsonColumn(v.highlights),
        collabRoles: jsonColumn(v.collabRoles),
        sortOrder: v.sortOrder,
        isFeatured: v.isFeatured,
        createdAt: iso(v.createdAt),
        updatedAt: iso(v.updatedAt),
      })),
    };
  } catch (e) {
    // P2021 = table does not exist in the current database (schema edited,
    // `db:push` still pending from the parallel ventures task) — degrade.
    if ((e as { code?: string }).code === "P2021") {
      return { headers, records: [], note: VENTURES_NOT_READY };
    }
    throw e;
  }
}

async function exportAds(): Promise<ExportDataset> {
  const rows = await db.ad.findMany({ orderBy: { createdAt: "asc" } });
  return {
    headers: [
      "name", "type", "placement", "title", "body", "imageUrl", "imageAlt", "images",
      "linkUrl", "linkLabel", "active", "priority", "startAt", "endAt",
      "impressions", "clicks", "createdAt", "updatedAt",
    ],
    records: rows.map((a) => ({
      name: a.name,
      type: a.type,
      placement: a.placement,
      title: a.title ?? "",
      body: a.body ?? "",
      imageUrl: a.imageUrl ?? "",
      imageAlt: a.imageAlt ?? "",
      images: jsonColumn(a.images),
      linkUrl: a.linkUrl ?? "",
      linkLabel: a.linkLabel,
      active: a.active,
      priority: a.priority,
      startAt: iso(a.startAt),
      endAt: iso(a.endAt),
      impressions: a.impressions,
      clicks: a.clicks,
      createdAt: iso(a.createdAt),
      updatedAt: iso(a.updatedAt),
    })),
  };
}

async function exportInquiries(): Promise<ExportDataset> {
  const rows = await db.inquiry.findMany({ orderBy: { createdAt: "asc" } });
  return {
    headers: ["name", "email", "phone", "type", "subject", "message", "status", "priority", "repliedAt", "createdAt"],
    records: rows.map((q) => ({
      name: q.name,
      email: q.email,
      phone: q.phone ?? "",
      type: q.type,
      subject: q.subject ?? "",
      message: q.message,
      status: q.status,
      priority: q.priority,
      repliedAt: iso(q.repliedAt),
      createdAt: iso(q.createdAt),
    })),
  };
}

async function exportSubscribers(): Promise<ExportDataset> {
  const rows = await db.newsletterSubscriber.findMany({ orderBy: { subscribedAt: "asc" } });
  return {
    headers: ["email", "status", "source", "subscribedAt", "confirmedAt", "unsubscribedAt"],
    records: rows.map((s) => ({
      email: s.email,
      status: s.status,
      source: s.source,
      subscribedAt: iso(s.subscribedAt),
      confirmedAt: iso(s.confirmedAt),
      unsubscribedAt: iso(s.unsubscribedAt),
    })),
  };
}

async function exportUsers(): Promise<ExportDataset> {
  const rows = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return {
    headers: [
      "fullName", "displayName", "email", "headline", "location", "websiteUrl", "role",
      "onboardingCompleted", "marketingOptIn", "isActive", "lastLoginAt", "createdAt",
    ],
    records: rows.map((u) => ({
      fullName: u.fullName,
      displayName: u.displayName ?? "",
      email: u.email,
      headline: u.headline ?? "",
      location: u.location ?? "",
      websiteUrl: u.websiteUrl ?? "",
      role: u.role,
      onboardingCompleted: u.onboardingCompleted,
      marketingOptIn: u.marketingOptIn,
      isActive: u.isActive,
      lastLoginAt: iso(u.lastLoginAt),
      createdAt: iso(u.createdAt),
    })),
  };
}

async function exportSettings(): Promise<ExportDataset> {
  const rows = await db.siteSetting.findMany({ orderBy: { key: "asc" } });
  return {
    headers: ["key", "value", "updatedAt"],
    records: rows.map((s) => ({
      key: s.key,
      value: jsonColumn(s.value),
      updatedAt: iso(s.updatedAt),
    })),
  };
}

async function collect(type: ExportType): Promise<ExportDataset> {
  switch (type) {
    case "posts": return exportPosts();
    case "products": return exportProducts();
    case "categories": return exportCategories();
    case "ventures": return exportVentures();
    case "ads": return exportAds();
    case "inquiries": return exportInquiries();
    case "subscribers": return exportSubscribers();
    case "users": return exportUsers();
    case "settings": return exportSettings();
  }
}

/* ------------------------------------------------------------------ */
/* route                                                               */
/* ------------------------------------------------------------------ */

export const GET = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const sp = new URL(req.url).searchParams;
  const typeParam = sp.get("type") ?? "";
  if (!(EXPORT_TYPES as readonly string[]).includes(typeParam)) {
    throw new ApiError(
      400,
      "VALIDATION",
      `Unknown or missing export type. Allowed: ${EXPORT_TYPES.join(", ")}.`
    );
  }
  const type = typeParam as ExportType;

  const dataset = await collect(type);

  if ((sp.get("format") ?? "csv").toLowerCase() === "json") {
    const res = ok(dataset.records);
    if (dataset.note) res.headers.set("x-mnkp-note", dataset.note);
    return res;
  }

  const csv = toCsv(
    dataset.headers,
    dataset.records.map((r) => dataset.headers.map((h) => r[h] ?? ""))
  );
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
  const headers = new Headers({
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="mnkp-${type}-${stamp}.csv"`,
    "cache-control": "no-store",
  });
  if (dataset.note) headers.set("x-mnkp-note", dataset.note);
  return new Response(csv, { headers });
});
