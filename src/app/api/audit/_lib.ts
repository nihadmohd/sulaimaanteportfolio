import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-helpers";
import type { SessionUser } from "@/lib/auth";

/**
 * Audit log engine (Task 9) — every staff mutation writes a before/after
 * snapshot here; the undo/redo endpoints replay those snapshots. This is
 * the power behind "Undo/redo options" in Admin & Developer.
 */

export type AuditAction = "create" | "update" | "delete" | "toggle" | "undo" | "redo" | "import";

/** Entities whose snapshots can be automatically restored (undo/redo). */
export const RESTORABLE_ENTITIES = new Set(["setting", "ad", "post", "product", "venture", "ad_plan"]);

export interface WriteAuditInput {
  user: Pick<SessionUser, "id" | "fullName" | "email"> | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  label: string;
  before?: unknown;
  after?: unknown;
}

/** Record a mutation snapshot. Never throws — audit must not break the request. */
export async function writeAudit(input: WriteAuditInput) {
  try {
    return await db.auditLog.create({
      data: {
        userId: input.user?.id ?? null,
        userName: input.user?.fullName || input.user?.email || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        label: input.label.slice(0, 160),
        before: input.before === undefined || input.before === null ? null : JSON.stringify(input.before),
        after: input.after === undefined || input.after === null ? null : JSON.stringify(input.after),
      },
    });
  } catch (e) {
    console.error("[audit] failed to write entry", e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* snapshot replay (undo = apply "before", redo = apply "after")       */
/* ------------------------------------------------------------------ */

interface AdRow {
  id?: string;
  name?: string;
  type?: string;
  placement?: string;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  images?: string;
  linkUrl?: string | null;
  linkLabel?: string;
  active?: boolean;
  priority?: number;
  startAt?: string | null;
  endAt?: string | null;
  impressions?: number;
  clicks?: number;
  // client campaign + review fields (Task 14)
  source?: string;
  clientName?: string | null;
  clientCompany?: string | null;
  clientEmail?: string | null;
  monthlyRate?: number | null;
  planCode?: string | null;
  reviewStatus?: string;
  reviewNote?: string | null;
  submittedById?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
}

interface AdPlanRow {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  priceMonthly?: number;
  currency?: string;
  features?: string;
  placements?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  createdAt?: string;
}

interface PostRow {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content?: string;
  coverImageUrl?: string | null;
  status?: string;
  isFeatured?: boolean;
  tags?: string;
  readingTimeMinutes?: number;
  viewsCount?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
  authorId?: string | null;
  categoryId?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
}

interface ProductRow {
  id?: string;
  slug?: string;
  name?: string;
  tagline?: string | null;
  description?: string | null;
  brand?: string | null;
  merchant?: string | null;
  imageUrl?: string | null;
  gallery?: string;
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string;
  affiliateUrl?: string;
  pros?: string;
  cons?: string;
  keySpecs?: string;
  rating?: number;
  reviewCount?: number;
  status?: string;
  isFeatured?: boolean;
  clicksCount?: number;
  categoryId?: string | null;
  // special offer fields (Task 14)
  offerActive?: boolean;
  offerTitle?: string | null;
  offerDescription?: string | null;
  offerKind?: string;
  offerCode?: string | null;
  offerStartsAt?: string | null;
  offerEndsAt?: string | null;
  createdAt?: string;
}

interface VentureRow {
  id?: string;
  slug?: string;
  name?: string;
  tagline?: string | null;
  description?: string | null;
  category?: string;
  status?: string;
  location?: string | null;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  highlights?: string;
  collabRoles?: string;
  sortOrder?: number;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function reviveDate(value: unknown): Date | null {
  return typeof value === "string" && value ? new Date(value) : null;
}

function adRowToData(row: AdRow) {
  return {
    name: row.name ?? "Restored ad",
    type: row.type ?? "image",
    placement: row.placement ?? "blog-inline",
    title: row.title ?? null,
    body: row.body ?? null,
    imageUrl: row.imageUrl ?? null,
    imageAlt: row.imageAlt ?? null,
    images: typeof row.images === "string" ? row.images : JSON.stringify(row.images ?? []),
    linkUrl: row.linkUrl ?? null,
    linkLabel: row.linkLabel ?? "Learn more",
    active: row.active ?? true,
    priority: row.priority ?? 0,
    startAt: reviveDate(row.startAt),
    endAt: reviveDate(row.endAt),
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    source: row.source ?? "owner",
    clientName: row.clientName ?? null,
    clientCompany: row.clientCompany ?? null,
    clientEmail: row.clientEmail ?? null,
    monthlyRate: row.monthlyRate ?? null,
    planCode: row.planCode ?? null,
    reviewStatus: row.reviewStatus ?? "approved",
    reviewNote: row.reviewNote ?? null,
    submittedById: row.submittedById ?? null,
    reviewedAt: reviveDate(row.reviewedAt),
  };
}

function adPlanRowToData(row: AdPlanRow) {
  return {
    code: row.code ?? `restored-plan-${Date.now().toString(36)}`,
    name: row.name ?? "Restored plan",
    description: row.description ?? null,
    priceMonthly: row.priceMonthly ?? 0,
    currency: row.currency ?? "INR",
    features: typeof row.features === "string" ? row.features : JSON.stringify(row.features ?? []),
    placements: typeof row.placements === "string" ? row.placements : JSON.stringify(row.placements ?? []),
    isActive: row.isActive ?? true,
    isFeatured: row.isFeatured ?? false,
    sortOrder: row.sortOrder ?? 0,
  };
}

function postRowToData(row: PostRow) {
  return {
    slug: row.slug ?? `restored-${Date.now()}`,
    title: row.title ?? "Restored post",
    excerpt: row.excerpt ?? null,
    content: row.content ?? "",
    coverImageUrl: row.coverImageUrl ?? null,
    status: row.status ?? "draft",
    isFeatured: row.isFeatured ?? false,
    tags: typeof row.tags === "string" ? row.tags : JSON.stringify(row.tags ?? []),
    readingTimeMinutes: row.readingTimeMinutes ?? 1,
    viewsCount: row.viewsCount ?? 0,
    seoTitle: row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    ogImageUrl: row.ogImageUrl ?? null,
    canonicalUrl: row.canonicalUrl ?? null,
    authorId: row.authorId ?? null,
    categoryId: row.categoryId ?? null,
    publishedAt: reviveDate(row.publishedAt),
  };
}

function ventureRowToData(row: VentureRow) {
  return {
    slug: row.slug ?? `restored-venture-${Date.now()}`,
    name: row.name ?? "Restored venture",
    tagline: row.tagline ?? null,
    description: row.description ?? null,
    category: row.category ?? "venture",
    status: row.status ?? "live",
    location: row.location ?? null,
    websiteUrl: row.websiteUrl ?? null,
    imageUrl: row.imageUrl ?? null,
    highlights: typeof row.highlights === "string" ? row.highlights : JSON.stringify(row.highlights ?? []),
    collabRoles: typeof row.collabRoles === "string" ? row.collabRoles : JSON.stringify(row.collabRoles ?? []),
    sortOrder: row.sortOrder ?? 0,
    isFeatured: row.isFeatured ?? false,
  };
}

function productRowToData(row: ProductRow) {
  return {
    slug: row.slug ?? `restored-${Date.now()}`,
    name: row.name ?? "Restored product",
    tagline: row.tagline ?? null,
    description: row.description ?? null,
    brand: row.brand ?? null,
    merchant: row.merchant ?? null,
    imageUrl: row.imageUrl ?? null,
    gallery: typeof row.gallery === "string" ? row.gallery : JSON.stringify(row.gallery ?? []),
    price: row.price ?? null,
    compareAtPrice: row.compareAtPrice ?? null,
    currency: row.currency ?? "INR",
    affiliateUrl: row.affiliateUrl ?? "#",
    pros: typeof row.pros === "string" ? row.pros : JSON.stringify(row.pros ?? []),
    cons: typeof row.cons === "string" ? row.cons : JSON.stringify(row.cons ?? []),
    keySpecs: typeof row.keySpecs === "string" ? row.keySpecs : JSON.stringify(row.keySpecs ?? {}),
    rating: row.rating ?? 0,
    reviewCount: row.reviewCount ?? 0,
    status: row.status ?? "draft",
    isFeatured: row.isFeatured ?? false,
    clicksCount: row.clicksCount ?? 0,
    categoryId: row.categoryId ?? null,
    offerActive: row.offerActive ?? false,
    offerTitle: row.offerTitle ?? null,
    offerDescription: row.offerDescription ?? null,
    offerKind: row.offerKind ?? "deal",
    offerCode: row.offerCode ?? null,
    offerStartsAt: reviveDate(row.offerStartsAt),
    offerEndsAt: reviveDate(row.offerEndsAt),
  };
}

/**
 * Apply a snapshot to the live database (undo → "before", redo → "after").
 * A null snapshot means the entity did not (or should not) exist → delete.
 */
export async function applySnapshot(entity: string, entityId: string | null, snapshot: string | null) {
  switch (entity) {
    case "setting": {
      const parsed = snapshot ? (JSON.parse(snapshot) as { key?: string; value?: unknown }) : null;
      if (!parsed?.key) throw new ApiError(400, "VALIDATION", "Setting snapshot is malformed.");
      const value = JSON.stringify(parsed.value ?? {});
      await db.siteSetting.upsert({
        where: { key: parsed.key },
        update: { value },
        create: { key: parsed.key, value },
      });
      return { key: parsed.key };
    }
    case "ad": {
      if (!entityId) throw new ApiError(400, "VALIDATION", "Ad snapshot has no entity id.");
      if (!snapshot) {
        await db.ad.deleteMany({ where: { id: entityId } });
        return { id: entityId, deleted: true };
      }
      const row = JSON.parse(snapshot) as AdRow;
      const data = adRowToData(row);
      await db.ad.upsert({ where: { id: entityId }, update: data, create: { id: entityId, ...data } });
      return { id: entityId };
    }
    case "post": {
      if (!entityId) throw new ApiError(400, "VALIDATION", "Post snapshot has no entity id.");
      if (!snapshot) {
        await db.post.deleteMany({ where: { id: entityId } });
        return { id: entityId, deleted: true };
      }
      const row = JSON.parse(snapshot) as PostRow;
      const data = postRowToData(row);
      await db.post.upsert({ where: { id: entityId }, update: data, create: { id: entityId, ...data } });
      return { id: entityId };
    }
    case "product": {
      if (!entityId) throw new ApiError(400, "VALIDATION", "Product snapshot has no entity id.");
      if (!snapshot) {
        await db.product.deleteMany({ where: { id: entityId } });
        return { id: entityId, deleted: true };
      }
      const row = JSON.parse(snapshot) as ProductRow;
      const data = productRowToData(row);
      await db.product.upsert({
        where: { id: entityId },
        update: data,
        create: { id: entityId, ...data },
      });
      return { id: entityId };
    }
    case "venture": {
      if (!entityId) throw new ApiError(400, "VALIDATION", "Venture snapshot has no entity id.");
      if (!snapshot) {
        await db.venture.deleteMany({ where: { id: entityId } });
        return { id: entityId, deleted: true };
      }
      const row = JSON.parse(snapshot) as VentureRow;
      // id / createdAt / updatedAt are stripped — only content fields are written.
      const data = ventureRowToData(row);
      await db.venture.upsert({ where: { id: entityId }, update: data, create: { id: entityId, ...data } });
      return { id: entityId };
    }
    case "ad_plan": {
      if (!entityId) throw new ApiError(400, "VALIDATION", "Ad plan snapshot has no entity id.");
      if (!snapshot) {
        await db.adPlan.deleteMany({ where: { id: entityId } });
        return { id: entityId, deleted: true };
      }
      const row = JSON.parse(snapshot) as AdPlanRow;
      const data = adPlanRowToData(row);
      await db.adPlan.upsert({ where: { id: entityId }, update: data, create: { id: entityId, ...data } });
      return { id: entityId };
    }
    default:
      throw new ApiError(400, "VALIDATION", `"${entity}" changes are logged but cannot be auto-restored.`);
  }
}

/** Serialize an audit row for the admin activity feed. */
export function serializeAudit(row: {
  id: string;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  label: string;
  before: string | null;
  after: string | null;
  undoneAt: Date | null;
  redoneAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    userName: row.userName,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    label: row.label,
    undoneAt: row.undoneAt?.toISOString() ?? null,
    redoneAt: row.redoneAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    restorable: RESTORABLE_ENTITIES.has(row.entity) && row.action !== "undo" && row.action !== "redo",
  };
}
