import { ZodError } from "zod";
import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole, type SessionUser } from "@/lib/auth";
import {
  AD_PLACEMENTS,
  AD_TYPES,
  adCreateSchema,
  categoryCreateSchema,
  importPostsSchema,
  importProductsSchema,
  ventureCreateSchema,
} from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { csvToObjects, jsonArrayCell } from "@/lib/csv";

/**
 * POST /api/import — STAFF. Bulk import of site content (Task 11-b).
 *
 * JSON mode (legacy, unchanged): { posts?: [...], products?: [...] } —
 * at least one array required. Existing slugs are SKIPPED/renamed, so
 * re-running is safe. Every import writes one audit entry with a summary.
 *
 * CSV mode (new): { format: "csv", entity, csv } where entity is one of
 * posts | products | categories | ventures | ads | subscribers. The CSV is
 * parsed with the shared RFC-4180 toolkit (@/lib/csv), mapped onto the SAME
 * zod validation the JSON path uses, then created row-by-row with per-row
 * error collection:
 *   · posts/products — slug taken → auto-renamed (matches JSON import)
 *   · categories/ventures/subscribers — natural key taken → row skipped
 *   · ads — no unique key; every row creates a new ad
 * Any file produced by GET /api/export round-trips directly.
 *
 * Response (both modes share the shape): { entity, received, created,
 * skipped, errors[], ... } — CSV mode adds format/skippedNotes/createdItems,
 * JSON mode keeps its original posts/products/createdPosts/... fields.
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

/* ------------------------------------------------------------------ */
/* CSV mode — shared plumbing                                          */
/* ------------------------------------------------------------------ */

const CSV_ENTITIES = ["posts", "products", "categories", "ventures", "ads", "subscribers"] as const;
type CsvEntity = (typeof CSV_ENTITIES)[number];

const CSV_MAX_ROWS = 200;

interface CsvImportResult {
  entity: CsvEntity;
  received: number;
  created: number;
  skipped: number;
  skippedNotes: string[];
  createdItems: string[];
  errors: string[];
}

type CsvRow = Record<string, string>;

/** Trimmed cell read (missing column → ""). */
function cell(row: CsvRow, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v.trim() : "";
}

function csvBool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(v)) return true;
  if (["false", "0", "no", "n", "off"].includes(v)) return false;
  return fallback;
}

function csvInt(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) ? n : undefined;
}

function csvFloat(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** "" → null; invalid text → null (dates degrade rather than fail rows). */
function csvDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Non-empty date cell → ISO string for zod; invalid → thrown row error. */
function csvIso(value: string, field: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${field} "${value}" is not a valid date.`);
  }
  return d.toISOString();
}

/** Parse a CSV cell that should hold a JSON object (keySpecs). "" → {}. */
function jsonRecordCell(value: string): Record<string, string> {
  const v = value.trim();
  if (!v) return {};
  try {
    const parsed: unknown = JSON.parse(v);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof val === "string") out[key] = val;
        else if (typeof val === "number" || typeof val === "boolean") out[key] = String(val);
      }
      return out;
    }
  } catch {
    // fall through to {}
  }
  return {};
}

/**
 * Lenient URL/path cell for CSV round-trips. The platform's own data uses
 * site-relative image paths ("/images/store/x.png"), which the strict zod
 * optionalUrl rejects — so CSV import accepts absolute http(s) URLs,
 * site-relative /paths, #/routes and mailto:, and errors on anything else.
 * (Deliberate 11-b deviation from the JSON path, documented in worklog.)
 */
function csvLinkCell(value: string, field: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (
    /^https?:\/\//i.test(v) ||
    v.startsWith("/") ||
    v.startsWith("#/") ||
    /^mailto:/i.test(v)
  ) {
    return v;
  }
  throw new Error(`${field} "${v}" must be an https:// URL or a site-relative path.`);
}

/** Human message for a per-row failure (zod issues preferred). */
function rowError(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Invalid row.";
  return (e as Error).message;
}

/** email validity without pulling zod into the loop twice. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* ventures concurrency guard (typed, no `any`)                        */
/* ------------------------------------------------------------------ */

interface VentureRow {
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string;
  location?: string | null;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  highlights?: string;
  collabRoles?: string;
  sortOrder?: number;
  isFeatured?: boolean;
}

/**
 * Minimal structural delegate for the ventures table (findFirst/create).
 * Typed cast keeps this compiling before/after the Venture model lands in
 * the generated Prisma client; null when the table is absent.
 */
function venturesTable(): {
  findFirst(args: { where: { slug: string } }): Promise<{ id: string } | null>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: string; name: string }>;
} | null {
  const delegate = (
    db as unknown as {
      venture?: {
        findFirst(args: { where: { slug: string } }): Promise<{ id: string } | null>;
        create(args: { data: Record<string, unknown> }): Promise<{ id: string; name: string }>;
      };
    }
  ).venture;
  return delegate && typeof delegate === "object" && typeof delegate.create === "function"
    ? delegate
    : null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ------------------------------------------------------------------ */
/* CSV mode — per-entity importers                                     */
/* ------------------------------------------------------------------ */

async function importPostsCsv(rows: CsvRow[], user: SessionUser, result: CsvImportResult) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      // Same validation the JSON path uses (per-row so one bad row
      // cannot fail the whole import).
      const input = {
        title: cell(row, "title"),
        slug: cell(row, "slug") || undefined,
        excerpt: cell(row, "excerpt") || undefined,
        content: cell(row, "content"),
        coverImageUrl: undefined,
        tags: jsonArrayCell(row.tags ?? ""),
        status: cell(row, "status") || undefined,
        publishedAt: cell(row, "publishedAt") || undefined,
        seoTitle: cell(row, "seoTitle") || undefined,
        seoDescription: cell(row, "seoDescription") || undefined,
        canonicalUrl: undefined,
      };
      const p = importPostsSchema.parse({ posts: [input] }).posts[0];
      // URL cells validated leniently (site-relative paths round-trip).
      const coverImageUrl = csvLinkCell(cell(row, "coverImageUrl"), "coverImageUrl");
      const canonicalUrl = csvLinkCell(cell(row, "canonicalUrl"), "canonicalUrl");
      const ogImageUrl = csvLinkCell(cell(row, "ogImageUrl"), "ogImageUrl");

      // Extra export columns not present on the legacy JSON schema.
      const reading = csvInt(cell(row, "readingTimeMinutes"));
      const views = csvInt(cell(row, "viewsCount"));
      let categoryId: string | null = null;
      const categorySlug = cell(row, "categorySlug");
      if (categorySlug) {
        const category = await db.category.findFirst({
          where: { slug: categorySlug },
          select: { id: true },
        });
        categoryId = category?.id ?? null; // resolve-or-null (legacy path ignores categories)
      }

      const base = p.slug || slugify(p.title);
      const slug = await uniqueSlug(base, async (s) => {
        const found = await db.post.findUnique({ where: { slug: s }, select: { id: true } });
        return !!found;
      });
      if (slug !== base && p.slug) {
        result.skippedNotes.push(`${p.slug} (slug taken — imported as ${slug})`);
      }
      const post = await db.post.create({
        data: {
          slug,
          title: p.title,
          excerpt: p.excerpt ?? null,
          content: p.content,
          coverImageUrl,
          tags: toJson(p.tags ?? []),
          status: p.status,
          isFeatured: csvBool(cell(row, "isFeatured"), false),
          readingTimeMinutes: reading != null ? Math.min(90, Math.max(1, reading)) : readingTime(p.content),
          viewsCount: views != null ? Math.max(0, views) : 0,
          seoTitle: p.seoTitle ?? null,
          seoDescription: p.seoDescription ?? null,
          ogImageUrl,
          canonicalUrl,
          publishedAt:
            p.status === "published" ? new Date(p.publishedAt ?? Date.now()) : null,
          categoryId,
          authorId: user.id,
        },
        select: { id: true, title: true },
      });
      result.createdItems.push(post.title);
    } catch (e) {
      result.errors.push(`Row ${i + 2} (post "${cell(row, "title") || "?"}"): ${rowError(e)}`);
    }
  }
}

async function importProductsCsv(rows: CsvRow[], result: CsvImportResult) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const input = {
        name: cell(row, "name"),
        slug: cell(row, "slug") || undefined,
        tagline: cell(row, "tagline") || undefined,
        description: cell(row, "description") || undefined,
        brand: cell(row, "brand") || undefined,
        merchant: cell(row, "merchant") || undefined,
        imageUrl: undefined,
        price: csvFloat(cell(row, "price")),
        compareAtPrice: csvFloat(cell(row, "compareAtPrice")),
        affiliateUrl: cell(row, "affiliateUrl"),
        rating: csvFloat(cell(row, "rating")),
        status: cell(row, "status") || undefined,
        isFeatured: csvBool(cell(row, "isFeatured"), false),
        pros: jsonArrayCell(row.pros ?? ""),
        cons: jsonArrayCell(row.cons ?? ""),
      };
      const p = importProductsSchema.parse({ products: [input] }).products[0];
      // Image URL validated leniently (site-relative paths round-trip).
      const imageUrl = csvLinkCell(cell(row, "imageUrl"), "imageUrl");

      // Extra export columns (gallery/currency/keySpecs/reviewCount/
      // clicksCount/categorySlug) for a full round-trip.
      const reviewCount = csvInt(cell(row, "reviewCount"));
      const clicks = csvInt(cell(row, "clicksCount"));
      let categoryId: string | null = null;
      const categorySlug = cell(row, "categorySlug");
      if (categorySlug) {
        const category = await db.category.findFirst({
          where: { slug: categorySlug },
          select: { id: true },
        });
        categoryId = category?.id ?? null;
      }

      const base = p.slug || slugify(p.name);
      const slug = await uniqueSlug(base, async (s) => {
        const found = await db.product.findUnique({ where: { slug: s }, select: { id: true } });
        return !!found;
      });
      if (slug !== base && p.slug) {
        result.skippedNotes.push(`${p.slug} (slug taken — imported as ${slug})`);
      }
      const product = await db.product.create({
        data: {
          slug,
          name: p.name,
          tagline: p.tagline ?? null,
          description: p.description ?? null,
          brand: p.brand ?? null,
          merchant: p.merchant ?? null,
          imageUrl,
          gallery: toJson(jsonArrayCell(row.gallery ?? "")),
          price: p.price ?? null,
          compareAtPrice: p.compareAtPrice ?? null,
          currency: cell(row, "currency") || "INR",
          affiliateUrl: p.affiliateUrl,
          pros: toJson(p.pros ?? []),
          cons: toJson(p.cons ?? []),
          keySpecs: toJson(jsonRecordCell(row.keySpecs ?? "")),
          rating: p.rating,
          reviewCount: reviewCount != null ? Math.max(0, reviewCount) : 0,
          status: p.status,
          isFeatured: p.isFeatured,
          clicksCount: clicks != null ? Math.max(0, clicks) : 0,
          categoryId,
        },
        select: { id: true, name: true },
      });
      result.createdItems.push(product.name);
    } catch (e) {
      result.errors.push(`Row ${i + 2} (product "${cell(row, "name") || "?"}"): ${rowError(e)}`);
    }
  }
}

async function importCategoriesCsv(rows: CsvRow[], result: CsvImportResult) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const name = cell(row, "name");
      const slugCell = cell(row, "slug");
      if (!name || !slugCell) {
        throw new Error("categories need both a name and a slug.");
      }
      const c = categoryCreateSchema.parse({
        name,
        slug: slugCell,
        description: cell(row, "description") || undefined,
        scope: cell(row, "scope") || undefined,
        sortOrder: csvInt(cell(row, "sortOrder")) ?? 0,
      });
      const existing = await db.category.findFirst({
        where: { slug: slugCell },
        select: { id: true },
      });
      if (existing) {
        result.skippedNotes.push(`${slugCell} (duplicate slug — skipped)`);
        continue;
      }
      const category = await db.category.create({
        data: {
          name: c.name,
          slug: slugCell,
          description: c.description ?? null,
          scope: c.scope,
          sortOrder: c.sortOrder,
        },
        select: { id: true, name: true },
      });
      result.createdItems.push(category.name);
    } catch (e) {
      result.errors.push(`Row ${i + 2} (category "${cell(row, "name") || "?"}"): ${rowError(e)}`);
    }
  }
}

async function importVenturesCsv(rows: CsvRow[], result: CsvImportResult) {
  const table = venturesTable();
  if (!table) {
    result.errors.push("Ventures table not ready yet — retry after the ventures migration has been applied.");
    return;
  }
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const name = cell(row, "name");
      const slugCell = cell(row, "slug");
      if (!name || !slugCell) {
        throw new Error("ventures need both a name and a slug.");
      }
      if (!SLUG_RE.test(slugCell) || slugCell.length < 3 || slugCell.length > 160) {
        throw new Error(`slug "${slugCell}" must be lowercase letters, numbers and dashes (3–160 chars).`);
      }
      // Same validation the ventures POST route uses (11-a schema).
      const v = ventureCreateSchema.parse({
        name,
        slug: slugCell,
        tagline: cell(row, "tagline"),
        description: cell(row, "description") || undefined,
        category: cell(row, "category") || undefined,
        status: cell(row, "status") || undefined,
        location: cell(row, "location"),
        websiteUrl: undefined,
        imageUrl: undefined,
        highlights: jsonArrayCell(row.highlights ?? ""),
        collabRoles: jsonArrayCell(row.collabRoles ?? ""),
        sortOrder: csvInt(cell(row, "sortOrder")) ?? 0,
        isFeatured: csvBool(cell(row, "isFeatured"), false),
      });
      // URL cells validated leniently (site-relative paths round-trip).
      const websiteUrl = csvLinkCell(cell(row, "websiteUrl"), "websiteUrl");
      const imageUrl = csvLinkCell(cell(row, "imageUrl"), "imageUrl");
      const existing = await table.findFirst({ where: { slug: slugCell } });
      if (existing) {
        result.skippedNotes.push(`${slugCell} (duplicate slug — skipped)`);
        continue;
      }
      const venture = await table.create({
        data: {
          slug: slugCell,
          name: v.name,
          tagline: v.tagline || null,
          description: v.description ?? null,
          category: v.category,
          status: v.status,
          location: v.location || null,
          websiteUrl,
          imageUrl,
          highlights: toJson(v.highlights),
          collabRoles: toJson(v.collabRoles),
          sortOrder: v.sortOrder,
          isFeatured: v.isFeatured,
        },
      });
      result.createdItems.push(venture.name);
    } catch (e) {
      result.errors.push(`Row ${i + 2} (venture "${cell(row, "name") || "?"}"): ${rowError(e)}`);
    }
  }
}

async function importAdsCsv(rows: CsvRow[], result: CsvImportResult) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const a = adCreateSchema.parse({
        name: cell(row, "name"),
        type: (cell(row, "type") || "image") as (typeof AD_TYPES)[number],
        placement: (cell(row, "placement") || "blog-inline") as (typeof AD_PLACEMENTS)[number],
        title: cell(row, "title"),
        body: cell(row, "body"),
        imageUrl: undefined,
        imageAlt: cell(row, "imageAlt"),
        images: jsonArrayCell(row.images ?? ""),
        linkUrl: cell(row, "linkUrl") || undefined,
        linkLabel: cell(row, "linkLabel") || "Learn more",
        active: csvBool(cell(row, "active"), true),
        priority: csvInt(cell(row, "priority")) ?? 0,
        startAt: csvIso(cell(row, "startAt"), "startAt"),
        endAt: csvIso(cell(row, "endAt"), "endAt"),
      });
      // Image URL validated leniently (site-relative paths round-trip).
      const imageUrl = csvLinkCell(cell(row, "imageUrl"), "imageUrl");
      // Ads have no natural unique key — every row creates a new ad.
      const ad = await db.ad.create({
        data: {
          name: a.name,
          type: a.type,
          placement: a.placement,
          title: a.title || null,
          body: a.body || null,
          imageUrl,
          imageAlt: a.imageAlt || null,
          images: toJson(a.images),
          linkUrl: a.linkUrl || null,
          linkLabel: a.linkLabel,
          active: a.active,
          priority: a.priority,
          startAt: a.startAt ? new Date(a.startAt) : null,
          endAt: a.endAt ? new Date(a.endAt) : null,
          impressions: Math.max(0, csvInt(cell(row, "impressions")) ?? 0),
          clicks: Math.max(0, csvInt(cell(row, "clicks")) ?? 0),
        },
        select: { id: true, name: true },
      });
      result.createdItems.push(ad.name);
    } catch (e) {
      result.errors.push(`Row ${i + 2} (ad "${cell(row, "name") || "?"}"): ${rowError(e)}`);
    }
  }
}

async function importSubscribersCsv(rows: CsvRow[], result: CsvImportResult) {
  const STATUSES = ["pending", "confirmed", "unsubscribed"] as const;
  const SOURCES = ["blog", "store", "footer", "lead_magnet"] as const;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const email = cell(row, "email");
      if (!email) {
        throw new Error("subscribers need an email.");
      }
      if (!EMAIL_RE.test(email)) {
        throw new Error(`email "${email}" does not look valid.`);
      }
      const statusCell = cell(row, "status");
      if (statusCell && !(STATUSES as readonly string[]).includes(statusCell)) {
        throw new Error(`status "${statusCell}" must be one of ${STATUSES.join(", ")}.`);
      }
      const sourceCell = cell(row, "source");
      if (sourceCell && !(SOURCES as readonly string[]).includes(sourceCell)) {
        throw new Error(`source "${sourceCell}" must be one of ${SOURCES.join(", ")}.`);
      }
      const existing = await db.newsletterSubscriber.findFirst({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        result.skippedNotes.push(`${email} (already subscribed — skipped)`);
        continue;
      }
      const subscriber = await db.newsletterSubscriber.create({
        data: {
          email,
          status: statusCell || "pending",
          source: sourceCell || "blog",
          subscribedAt: csvDate(cell(row, "subscribedAt")) ?? new Date(),
          confirmedAt: csvDate(cell(row, "confirmedAt")),
          unsubscribedAt: csvDate(cell(row, "unsubscribedAt")),
        },
        select: { id: true, email: true },
      });
      result.createdItems.push(subscriber.email);
    } catch (e) {
      result.errors.push(`Row ${i + 2} (subscriber "${cell(row, "email") || "?"}"): ${rowError(e)}`);
    }
  }
}

async function runCsvImport(user: SessionUser, raw: Record<string, unknown>): Promise<Response> {
  const entity = typeof raw.entity === "string" ? raw.entity : "";
  if (!(CSV_ENTITIES as readonly string[]).includes(entity)) {
    throw new ApiError(
      400,
      "VALIDATION",
      `CSV import supports: ${CSV_ENTITIES.join(", ")}.`
    );
  }
  const csv = typeof raw.csv === "string" ? raw.csv : "";
  if (!csv.trim()) {
    throw new ApiError(400, "VALIDATION", 'Body must include a non-empty "csv" string.');
  }
  const rows = csvToObjects(csv);
  if (rows.length === 0) {
    throw new ApiError(
      400,
      "VALIDATION",
      "No data rows found — the CSV needs a header row plus at least one data row."
    );
  }
  if (rows.length > CSV_MAX_ROWS) {
    throw new ApiError(
      400,
      "VALIDATION",
      `Max ${CSV_MAX_ROWS} rows per import — got ${rows.length}. Split larger sets.`
    );
  }

  const result: CsvImportResult = {
    entity: entity as CsvEntity,
    received: rows.length,
    created: 0,
    skipped: 0,
    skippedNotes: [],
    createdItems: [],
    errors: [],
  };

  switch (result.entity) {
    case "posts":
      await importPostsCsv(rows, user, result);
      break;
    case "products":
      await importProductsCsv(rows, result);
      break;
    case "categories":
      await importCategoriesCsv(rows, result);
      break;
    case "ventures":
      await importVenturesCsv(rows, result);
      break;
    case "ads":
      await importAdsCsv(rows, result);
      break;
    case "subscribers":
      await importSubscribersCsv(rows, result);
      break;
  }

  result.created = result.createdItems.length;
  result.skipped = result.skippedNotes.length;

  const summary = {
    format: "csv" as const,
    entity: result.entity,
    received: result.received,
    created: result.created,
    skipped: result.skipped,
    skippedNotes: result.skippedNotes,
    createdItems: result.createdItems,
    errors: result.errors,
  };

  await writeAudit({
    user,
    action: "import",
    entity: "import",
    entityId: null,
    label: `CSV import — ${result.created} ${result.entity} created · ${result.skipped} skipped · ${result.errors.length} error(s)`,
    before: null,
    after: summary,
  });

  return ok(summary, { status: 201 });
}

/* ------------------------------------------------------------------ */
/* route                                                               */
/* ------------------------------------------------------------------ */

export const POST = withApi(async (req) => {
  const user = await requireRole(req, STAFF_ROLES);
  const raw = (await readJson(req)) as Record<string, unknown>;

  // ---- CSV mode (11-b) ----
  if (raw.format === "csv") {
    return await runCsvImport(user, raw);
  }

  // ---- JSON mode (legacy, unchanged behavior) ----
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
    // 11-b: uniform top-level counters so the Import & Export UI (and any
    // future caller) can render both modes from one shape.
    entity: hasPosts && hasProducts ? "posts+products" : hasPosts ? "posts" : "products",
    received: postsInput.length + productsInput.length,
    created: createdPosts.length + createdProducts.length,
    skipped: skippedPosts.length + skippedProducts.length,
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
