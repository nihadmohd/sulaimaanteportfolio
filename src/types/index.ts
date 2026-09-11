/**
 * MN.KP shared DTO types — the exact JSON contract every API route returns
 * and every client hook consumes (BUILD CONTRACT v1 §4).
 *
 * Conventions:
 *  · Dates are ISO strings (JSON-serialized by NextResponse.json).
 *  · Prisma's JSON-stringified columns (tags/gallery/pros/cons/features/
 *    keySpecs/limits/socials/payload/value) are PARSED before leaving the
 *    API layer — use the helpers at the bottom of this file.
 *  · SafeUser and every DTO below strip secrets (passwordHash, tokens).
 */

/* ------------------------------------------------------------------ */
/* envelope                                                            */
/* ------------------------------------------------------------------ */

export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "SERVER";

/** Uniform API envelope — {ok:true,data} | {ok:false,error:{code,message}}. */
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

/** List responses: GET /api/posts, /api/products, /api/inquiries, ... */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/* ------------------------------------------------------------------ */
/* users                                                               */
/* ------------------------------------------------------------------ */

export type UserRole = "reader" | "author" | "editor" | "admin";

/** User row stripped of passwordHash / verificationToken / resetToken. */
export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  /** Parsed JSON column — {platform:url} (parseJsonRecord before returning). */
  socials: Record<string, string>;
  role: UserRole;
  onboardingCompleted: boolean;
  onboardingStep: number;
  marketingOptIn: boolean;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* categories / posts                                                  */
/* ------------------------------------------------------------------ */

export type CategoryScope = "blog" | "store";

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  scope: CategoryScope;
  sortOrder: number;
  createdAt: string;
}

export type PostStatus = "draft" | "published" | "archived";

export interface PostAuthorSummary {
  id: string;
  fullName: string;
  headline: string | null;
  avatarUrl: string | null;
}

export interface PostDTO {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: PostStatus;
  isFeatured: boolean;
  /** Parsed JSON column (parseJsonArray). */
  tags: string[];
  readingTimeMinutes: number;
  viewsCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthorSummary | null;
  category: CategorySummary | null;
}

/** Joined category on PostDTO / ProductDTO. */
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

export type ProductStatus = "active" | "draft" | "archived";

export interface ProductDTO {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  brand: string | null;
  merchant: string | null;
  imageUrl: string | null;
  /** Parsed JSON column (parseJsonArray). */
  gallery: string[];
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  affiliateUrl: string;
  /** Parsed JSON column (parseJsonArray). */
  pros: string[];
  /** Parsed JSON column (parseJsonArray). */
  cons: string[];
  /** Parsed JSON column (parseJsonRecord). */
  keySpecs: Record<string, string>;
  rating: number;
  reviewCount: number;
  status: ProductStatus;
  isFeatured: boolean;
  clicksCount: number;
  category: CategorySummary | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* inquiries / newsletter                                              */
/* ------------------------------------------------------------------ */

export type InquiryType =
  | "general"
  | "sponsorship"
  | "partnership"
  | "advertising"
  | "support"
  | "feedback";

export type InquiryStatus = "new" | "in_progress" | "replied" | "closed" | "spam";
export type InquiryPriority = "low" | "normal" | "high" | "urgent";

export interface InquiryDTO {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  type: InquiryType;
  subject: string | null;
  message: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  /** Admin-only field — never returned by public endpoints. */
  internalNote: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewsletterStatus = "pending" | "confirmed" | "unsubscribed";
export type NewsletterSource = "blog" | "store" | "footer" | "lead_magnet";

export interface NewsletterSubscriberDTO {
  id: string;
  email: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  subscribedAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* billing: plans / subscriptions / events                             */
/* ------------------------------------------------------------------ */

export interface PlanDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  /** Parsed JSON column (parseJsonArray). */
  features: string[];
  /** Parsed JSON column (parseJsonRecord). */
  limits: Record<string, string>;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type BillingInterval = "monthly" | "yearly";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export interface SubscriptionDTO {
  id: string;
  userId: string;
  planId: string;
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  paymentBrand: string | null;
  paymentLast4: string | null;
  createdAt: string;
  updatedAt: string;
  /** Joined plan (GET /api/subscriptions, /api/auth/me). */
  plan: PlanDTO;
}

export type SubscriptionEventType =
  | "created"
  | "plan_changed"
  | "interval_changed"
  | "renewed"
  | "canceled"
  | "resumed"
  | "payment_succeeded"
  | "payment_failed"
  | "trial_ended";

export interface SubscriptionEventDTO {
  id: string;
  subscriptionId: string;
  userId: string;
  type: SubscriptionEventType;
  amount: number | null;
  currency: string | null;
  /** Parsed JSON column — loosely typed metadata. */
  payload: Record<string, unknown>;
  createdAt: string;
}

/** GET /api/subscriptions → {plans, current, history}. */
export interface SubscriptionsResponse {
  plans: PlanDTO[];
  current: SubscriptionDTO | null;
  history: SubscriptionEventDTO[];
}

/* ------------------------------------------------------------------ */
/* notifications / stats (admin)                                       */
/* ------------------------------------------------------------------ */

export type NotificationType =
  | "inquiry"
  | "subscriber"
  | "billing"
  | "system"
  | "mention";

/** GET /api/notifications item. */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** ISO timestamp. */
  time: string;
  /** Hash route to open on click (e.g. "#/admin/inquiries"). */
  href: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

/** GET /api/stats (admin) → {kpis, series}. */
export interface StatsResponse {
  kpis: {
    totalUsers: number;
    totalPosts: number;
    publishedPosts: number;
    totalViews: number;
    totalProducts: number;
    activeProducts: number;
    totalClicks: number;
    totalInquiries: number;
    newInquiries: number;
    subscribers: number;
    confirmedSubscribers: number;
    activeSubscriptions: number;
    /** Monthly recurring revenue in plan currency units. */
    mrr: number;
  };
  series: {
    viewsByPost: Array<{ title: string; views: number }>;
    clicksByProduct: Array<{ name: string; clicks: number }>;
    inquiriesByDay: Array<{ day: string; count: number }>;
    planDist: Array<{ plan: string; count: number }>;
  };
}

/* ------------------------------------------------------------------ */
/* site settings (JSON columns parsed; helper sub-types below)         */
/* ------------------------------------------------------------------ */

/** Loose JSON value types for settings blobs. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export interface SocialsSettings {
  [platform: string]: string;
}

/** site_settings key "brand". */
export interface BrandSettings {
  siteName: string;
  ownerName: string;
  roleLine: string;
  tagline: string;
  email: string;
  phone: string;
  whatsappUrl: string;
  address: string;
  socials: SocialsSettings;
  cvUrl: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/** site_settings key "footer" (shape mirrors FOOTER_DEFAULT in constants.ts). */
export interface FooterSettings {
  tagline: string;
  columns: FooterColumn[];
  copyright: string;
  socialsEnabled: boolean;
}

export interface StickerItem {
  type: string;
  value: string;
  corner: string;
}

/** site_settings key "media". */
export interface MediaSettings {
  heroMarquee: { enabled: boolean; images: string[] };
  stickers: { enabled: boolean; items: StickerItem[] };
  blogGifs: { enabled: boolean; gifs: string[] };
}

/** site_settings key "ads". */
export interface AdsSettings {
  enabled: boolean;
  placements: string[];
}

/** site_settings key "maintenance". */
export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

/** GET /api/settings (public, sanitized). */
export interface PublicSettings {
  brand: BrandSettings;
  footer: FooterSettings;
  media: MediaSettings;
  ads: AdsSettings;
  maintenance: MaintenanceSettings;
}

/** GET /api/settings/all (admin) — every row parsed, keyed by setting key. */
export interface AdminSettings {
  brand: JsonRecord;
  footer: JsonRecord;
  media: JsonRecord;
  ads: JsonRecord;
  maintenance: JsonRecord;
  [key: string]: JsonRecord | undefined;
}

/* ------------------------------------------------------------------ */
/* JSON column helpers — used by every API route                       */
/* ------------------------------------------------------------------ */

/** Parse a Prisma JSON-string column into a string[] (safe: never throws). */
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Parse a Prisma JSON-string column into a Record<string,string> (safe). */
export function parseJsonRecord(
  raw: string | null | undefined
): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") {
        out[key] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        out[key] = String(value);
      }
      // objects / arrays / null are dropped — these columns are flat string maps
    }
    return out;
  } catch {
    return {};
  }
}

/** Stringify any value for a Prisma JSON-string column (safe: never throws). */
export function toJson(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return typeof s === "string" ? s : "null";
  } catch {
    return "null";
  }
}
