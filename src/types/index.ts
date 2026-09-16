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

export type UserRole = "reader" | "author" | "editor" | "admin" | "advertiser";

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

/** Special-offer flavor — drives the badge + icon on public surfaces. */
export type OfferKind = "deal" | "cashback" | "coupon" | "bundle" | "giveaway";

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
  // ---- special offer (Task 14) ----
  offerActive: boolean;
  offerTitle: string | null;
  offerDescription: string | null;
  offerKind: OfferKind;
  offerCode: string | null;
  offerStartsAt: string | null;
  offerEndsAt: string | null;
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
  | "feedback"
  | "venture"
  | "collab";

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
/* notifications / stats (admin)                                       */
/* ------------------------------------------------------------------ */

export type NotificationType =
  | "inquiry"
  | "subscriber"
  | "system"
  | "mention"
  | "ad_review";

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
  };
  series: {
    viewsByPost: Array<{ title: string; views: number }>;
    clicksByProduct: Array<{ name: string; clicks: number }>;
    inquiriesByDay: Array<{ day: string; count: number }>;
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

/** One marketing chip in the hero marquee message lane (Task 12-d). */
export interface MarqueeMessage {
  text: string;
  /** In-app hash route ("#/…") or an external https URL; null = no link. */
  href?: string | null;
}

/** Hero marquee scroll speed presets (Task 12-d). */
export type MarqueeSpeed = "slow" | "normal" | "fast";

/**
 * One image in the hero marquee image lane. Plain strings are legacy rows
 * (no link); objects carry the click-through URL the owner set in Settings.
 */
export interface MarqueeImage {
  src: string;
  /** In-app hash route ("#/…") or external https URL; empty = not clickable. */
  href?: string | null;
}

/** site_settings key "media". */
export interface MediaSettings {
  heroMarquee: {
    enabled: boolean;
    images: Array<string | MarqueeImage>;
    messages: MarqueeMessage[];
    speed: MarqueeSpeed;
  };
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

/** site_settings key "features" — global on/off toggles (Task 9). */
export interface FeaturesSettings {
  newsletter: boolean;
  shareButtons: boolean;
  presenceBadge: boolean;
  cookieConsent: boolean;
  registration: boolean;
  trendingBadge: boolean;
  viewCounts: boolean;
  readingTime: boolean;
  affiliateSlots: boolean;
}

/** site_settings key "seo" — editable SEO defaults (Task 9). */
export interface SeoSettings {
  titleSuffix: string;
  defaultDescription: string;
  keywords: string[];
  googleVerification: string;
  bingVerification: string;
}

/** site_settings key "contact" — contact details + social links (Task 11). */
export interface ContactSettings {
  email: string;
  phone: string;
  whatsappNumber: string;
  whatsappUrl: string;
  address: string;
  city: string;
  responseTimeHours: number;
  socials: SocialsSettings;
}

/** site_settings key "localization" — currency / timezone / formats (Task 11). */
export interface LocalizationSettings {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: "d MMM yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy";
  measurement: "metric" | "imperial";
}

/** site_settings key "analytics" — tracking integrations (Task 11; loader Task 13-e). */
export interface AnalyticsSettings {
  enabled: boolean;
  googleAnalyticsId: string;
  plausibleDomain: string;
  /** Meta (Facebook) Pixel numeric ID — empty = disabled. */
  metaPixelId: string;
  trackOutboundClicks: boolean;
}

/* ------------------------------------------------------------------ */
/* ads — full ad management system (Task 9)                            */
/* ------------------------------------------------------------------ */

export type AdType = "image" | "gif" | "sticker" | "text" | "marquee";
export type AdPlacement =
  | "header-banner"
  | "blog-inline"
  | "blog-sidebar"
  | "between-cards"
  | "home-strip"
  | "hero-marquee"
  | "store-side"
  | "footer-banner"
  | "product-inline"
  | "marquee"
  | "sticker";

/** Who the ad is for: the site owner, or a paying monthly client. */
export type AdSource = "owner" | "client";
/** Client submissions wait for owner approval before going live. */
export type AdReviewStatus = "pending" | "approved" | "rejected";

export interface AdDTO {
  id: string;
  name: string;
  type: AdType;
  placement: AdPlacement;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  images: string[];
  linkUrl: string | null;
  linkLabel: string;
  active: boolean;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  impressions: number;
  clicks: number;
  // ---- client campaigns + review workflow (Task 14) ----
  source: AdSource;
  clientName: string | null;
  clientCompany: string | null;
  clientEmail: string | null;
  monthlyRate: number | null;
  planCode: string | null;
  reviewStatus: AdReviewStatus;
  reviewNote: string | null;
  /** Advertiser account id when the client submitted it themselves. */
  submittedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdStatsDTO {
  totalAds: number;
  activeAds: number;
  impressions: number;
  clicks: number;
  ctr: number;
  /** Pending client submissions awaiting owner review (Task 14). */
  pendingReview?: number;
}

/** Monthly placement package sold on #/advertise (Task 14). */
export interface AdPlanDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
  /** Parsed JSON column (parseJsonArray) — selling points. */
  features: string[];
  /** Parsed JSON column (parseJsonArray) — AdPlacement codes included. */
  placements: AdPlacement[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* ventures — "Ventures & Business Ideas" (Task 11)                    */
/* ------------------------------------------------------------------ */

export type VentureStatus = "live" | "incubating" | "planned" | "idea" | "retired";

/** "venture" is the generic fallback bucket (the column default). */
export type VentureCategory =
  | "venture"
  | "store"
  | "community"
  | "tech"
  | "product"
  | "service"
  | "media";

export interface VentureDTO {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: VentureCategory;
  status: VentureStatus;
  location: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  /** Parsed JSON column (parseJsonArray). */
  highlights: string[];
  /** Parsed JSON column (parseJsonArray) — collaboration roles wanted. */
  collabRoles: string[];
  sortOrder: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* audit log — undo/redo system (Task 9)                               */
/* ------------------------------------------------------------------ */

export type AuditAction = "create" | "update" | "delete" | "toggle" | "undo" | "redo" | "import";

export interface AuditLogDTO {
  id: string;
  userName: string | null;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  label: string;
  undoneAt: string | null;
  redoneAt: string | null;
  createdAt: string;
  restorable: boolean;
}

/** GET /api/settings (public, sanitized). */
export interface PublicSettings {
  brand: BrandSettings;
  footer: FooterSettings;
  media: MediaSettings;
  ads: AdsSettings;
  features: FeaturesSettings;
  seo: SeoSettings;
  contact: ContactSettings;
  localization: LocalizationSettings;
  analytics: AnalyticsSettings;
  maintenance: MaintenanceSettings;
}

/** GET /api/settings/all (admin) — every row parsed, keyed by setting key. */
export interface AdminSettings {
  brand: JsonRecord;
  footer: JsonRecord;
  media: JsonRecord;
  ads: JsonRecord;
  features: JsonRecord;
  seo: JsonRecord;
  contact: JsonRecord;
  localization: JsonRecord;
  analytics: JsonRecord;
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
