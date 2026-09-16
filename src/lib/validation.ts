import { z } from "zod";

/** Zod schemas for every API input — shared by routes (server) and forms (client). */

/* ------------------------------------------------------------------ */
/* generous field caps (Task 14 — "Too Big" fix)                        */
/*                                                                    */
/* Every limit below is a generous safety ceiling, NOT an editing      */
/* constraint: real content should never hit these. Client forms       */
/* import the *_MAX constants so hints and server rules always match.  */
/* ------------------------------------------------------------------ */

export const PRODUCT_GALLERY_MAX = 200;
export const PRO_CON_MAX = 50;
export const PRO_CON_ITEM_MAX = 600;
export const SPEC_ROW_MAX = 100;
export const SPEC_LABEL_MAX = 120;
export const SPEC_VALUE_MAX = 600;
export const AD_IMAGES_MAX = 200;

/** Spec values arrive as strings from forms but numbers from imports — accept both. */
const specValue = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((v) => String(v))
  .refine((s) => s.length <= SPEC_VALUE_MAX, {
    message: `Spec values must stay under ${SPEC_VALUE_MAX} characters`,
  });

const keySpecsSchema = z
  .record(z.string().max(SPEC_LABEL_MAX, `Spec labels must stay under ${SPEC_LABEL_MAX} characters`), specValue)
  .refine((rec) => Object.keys(rec).length <= SPEC_ROW_MAX, {
    message: `Up to ${SPEC_ROW_MAX} spec rows`,
  });

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

const slug = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

const optionalUrl = z
  .string()
  .url("Must be a valid URL")
  .max(1200, "URLs must stay under 1200 characters")
  .optional()
  .or(z.literal(""));

/**
 * Image URL cell (Task 13): absolute http(s) URLs OR site-relative paths
 * ("/api/media/..." uploads, "/images/..." library picks). The platform's
 * own media is same-origin, so relative paths are first-class here — mirrors
 * the lenient csvLinkCell pattern in api/import/route.ts. Canonical/website
 * links stay strict (optionalUrl) because they must be absolute.
 */
const siteImageUrl = z
  .string()
  .max(1200, "Image URLs must stay under 1200 characters")
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "Use an https:// URL or a site-relative path like /api/media/...",
  });

const optionalImageUrl = siteImageUrl.optional().or(z.literal(""));

/** datetime cell: ISO string, empty string → null, or absent. */
const isoDateCell = z
  .string()
  .datetime({ message: "Use a valid date/time" })
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

// ---------- auth lifecycle ----------
export const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(120),
  email: z.string().email("Enter a valid email").max(160),
  password,
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset token"),
  password,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10, "Invalid verification token"),
});

export const onboardingSchema = z.object({
  step: z.number().int().min(1).max(4),
  data: z
    .object({
      fullName: z.string().min(2).max(120).optional(),
      headline: z.string().max(200).optional(),
      location: z.string().max(120).optional(),
      interests: z.array(z.string().max(60)).max(16).optional(),
      goals: z.array(z.string().max(60)).max(16).optional(),
      marketingOptIn: z.boolean().optional(),
    })
    .default({}),
});

// ---------- posts ----------
export const postCreateSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").max(200),
  slug: slug.optional(),
  excerpt: z.string().max(600).optional(),
  content: z.string().min(1, "Content is required").max(200_000),
  coverImageUrl: optionalImageUrl,
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(60)).max(20).default([]),
  readingTimeMinutes: z.number().int().min(1).max(90).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(180).optional(),
  ogImageUrl: optionalImageUrl,
  canonicalUrl: optionalUrl,
  publishedAt: z.string().optional(),
});

/**
 * Update schema — explicit optional-only shape (NOT .partial()).
 * Zod 4 keeps firing .default() inside .partial(), which made minimal
 * PATCH bodies (e.g. {status} or {active}) silently reset every defaulted
 * field. Explicit optionals guarantee only provided keys are touched.
 */
export const postUpdateSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").max(200).optional(),
  slug: slug.optional(),
  excerpt: z.string().max(600).optional(),
  content: z.string().min(1, "Content is required").max(200_000).optional(),
  coverImageUrl: optionalImageUrl,
  status: z.enum(["draft", "published", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
  readingTimeMinutes: z.number().int().min(1).max(90).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(180).optional(),
  ogImageUrl: optionalImageUrl,
  canonicalUrl: optionalUrl,
  publishedAt: z.string().optional(),
});

// ---------- products ----------
export const productCreateSchema = z.object({
  name: z.string().min(3, "Product name is required").max(200),
  slug: slug.optional(),
  tagline: z.string().max(300).optional(),
  description: z.string().max(80_000).optional(),
  brand: z.string().max(120).optional(),
  merchant: z.string().max(120).optional(),
  imageUrl: optionalImageUrl,
  gallery: z
    .array(siteImageUrl)
    .max(PRODUCT_GALLERY_MAX, `Galleries support up to ${PRODUCT_GALLERY_MAX} images`)
    .default([]),
  price: z.number().min(0).max(10_000_000).optional().nullable(),
  compareAtPrice: z.number().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().min(1).max(8).default("INR"),
  affiliateUrl: z.string().min(3, "Affiliate URL is required").max(1200),
  pros: z
    .array(z.string().min(1).max(PRO_CON_ITEM_MAX, `Keep each point under ${PRO_CON_ITEM_MAX} characters`))
    .max(PRO_CON_MAX, `Up to ${PRO_CON_MAX} points`)
    .default([]),
  cons: z
    .array(z.string().min(1).max(PRO_CON_ITEM_MAX, `Keep each point under ${PRO_CON_ITEM_MAX} characters`))
    .max(PRO_CON_MAX, `Up to ${PRO_CON_MAX} points`)
    .default([]),
  keySpecs: keySpecsSchema.default({}),
  rating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().min(0).max(10_000_000).default(0),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().min(1).optional().nullable(),
  // ---- special offer (Task 14) ----
  offerActive: z.boolean().default(false),
  offerTitle: z
    .string()
    .max(200, "Offer headlines must stay under 200 characters")
    .optional()
    .or(z.literal("")),
  offerDescription: z
    .string()
    .max(2000, "Offer descriptions must stay under 2000 characters")
    .optional()
    .or(z.literal("")),
  offerKind: z.enum(["deal", "cashback", "coupon", "bundle", "giveaway"]).default("deal"),
  offerCode: z.string().max(80).optional().or(z.literal("")),
  offerStartsAt: isoDateCell,
  offerEndsAt: isoDateCell,
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const productUpdateSchema = z.object({
  name: z.string().min(3, "Product name is required").max(200).optional(),
  slug: slug.optional(),
  tagline: z.string().max(300).optional(),
  description: z.string().max(80_000).optional(),
  brand: z.string().max(120).optional(),
  merchant: z.string().max(120).optional(),
  imageUrl: optionalImageUrl,
  gallery: z
    .array(siteImageUrl)
    .max(PRODUCT_GALLERY_MAX, `Galleries support up to ${PRODUCT_GALLERY_MAX} images`)
    .optional(),
  price: z.number().min(0).max(10_000_000).optional().nullable(),
  compareAtPrice: z.number().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().min(1).max(8).optional(),
  affiliateUrl: z.string().min(3, "Affiliate URL is required").max(1200).optional(),
  pros: z
    .array(z.string().min(1).max(PRO_CON_ITEM_MAX, `Keep each point under ${PRO_CON_ITEM_MAX} characters`))
    .max(PRO_CON_MAX, `Up to ${PRO_CON_MAX} points`)
    .optional(),
  cons: z
    .array(z.string().min(1).max(PRO_CON_ITEM_MAX, `Keep each point under ${PRO_CON_ITEM_MAX} characters`))
    .max(PRO_CON_MAX, `Up to ${PRO_CON_MAX} points`)
    .optional(),
  keySpecs: keySpecsSchema.optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).max(10_000_000).optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  categoryId: z.string().min(1).optional().nullable(),
  // ---- special offer (Task 14) ----
  offerActive: z.boolean().optional(),
  offerTitle: z
    .string()
    .max(200, "Offer headlines must stay under 200 characters")
    .optional()
    .or(z.literal("")),
  offerDescription: z
    .string()
    .max(2000, "Offer descriptions must stay under 2000 characters")
    .optional()
    .or(z.literal("")),
  offerKind: z.enum(["deal", "cashback", "coupon", "bundle", "giveaway"]).optional(),
  offerCode: z.string().max(80).optional().or(z.literal("")),
  offerStartsAt: isoDateCell,
  offerEndsAt: isoDateCell,
});

// ---------- categories ----------
export const categoryCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  slug: slug.optional(),
  description: z.string().max(1000).optional(),
  scope: z.enum(["blog", "store"]).default("blog"),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const categoryUpdateSchema = z.object({
  name: z.string().min(2, "Name is required").max(120).optional(),
  slug: slug.optional(),
  description: z.string().max(1000).optional(),
  scope: z.enum(["blog", "store"]).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

// ---------- inquiries ----------
export const inquiryCreateSchema = z.object({
  name: z.string().min(2, "Enter your name").max(120),
  email: z.string().email("Enter a valid email").max(160),
  phone: z.string().max(30).optional().or(z.literal("")),
  type: z
    .enum([
      "general",
      "sponsorship",
      "partnership",
      "advertising",
      "support",
      "feedback",
      "venture",
      "collab",
    ])
    .default("general"),
  subject: z.string().max(300).optional(),
  message: z.string().min(10, "Tell us a bit more (min 10 characters)").max(8000),
});

export const inquiryUpdateSchema = z
  .object({
    status: z.enum(["new", "in_progress", "replied", "closed", "spam"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    internalNote: z.string().max(8000).optional(),
    replied: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ---------- users (admin) ----------
export const userUpdateSchema = z
  .object({
    role: z.enum(["reader", "author", "editor", "admin", "advertiser"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ---------- newsletter ----------
export const newsletterSubscribeSchema = z.object({
  email: z.string().email("Enter a valid email").max(160),
  source: z.enum(["blog", "store", "footer", "lead_magnet", "services", "support", "advertise"]).default("footer"),
});

export const newsletterUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "unsubscribed"]),
});

// ---------- settings ----------
export const settingsUpdateSchema = z.object({
  value: z.record(z.string(), z.unknown()),
});

// ---------- ads (admin, Task 9; client campaigns Task 14) ----------
export const AD_TYPES = ["image", "gif", "sticker", "text", "marquee"] as const;
export const AD_PLACEMENTS = [
  "header-banner",
  "blog-inline",
  "blog-sidebar",
  "between-cards",
  "home-strip",
  "hero-marquee",
  "store-side",
  "footer-banner",
  "product-inline",
  "marquee",
  "sticker",
] as const;

/** Ad link targets: absolute http(s) URLs or in-app hash routes (#/...). */
const adLink = z
  .string()
  .max(1200)
  .refine((v) => v === "" || v.startsWith("#/") || /^https?:\/\//.test(v), {
    message: "Use a full https:// URL or an in-app route like #/store",
  })
  .optional()
  .or(z.literal(""));

export const AD_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export const AD_SOURCES = ["owner", "client"] as const;

/** Client-campaign fields the owner fills when running paid monthly ads. */
const clientCampaignFields = {
  source: z.enum(AD_SOURCES).default("owner"),
  clientName: z.string().max(120).optional().or(z.literal("")),
  clientCompany: z.string().max(160).optional().or(z.literal("")),
  clientEmail: z.string().email("Enter a valid client email").max(160).optional().or(z.literal("")),
  monthlyRate: z.number().min(0).max(10_000_000).optional().nullable(),
  planCode: z.string().max(40).optional().or(z.literal("")),
};

export const adCreateSchema = z.object({
  name: z.string().min(2, "Give the ad a name").max(160),
  type: z.enum(AD_TYPES),
  placement: z.enum(AD_PLACEMENTS),
  title: z.string().max(200).optional().or(z.literal("")),
  body: z.string().max(2000).optional().or(z.literal("")),
  imageUrl: optionalImageUrl,
  imageAlt: z.string().max(300).optional().or(z.literal("")),
  images: z
    .array(siteImageUrl)
    .max(AD_IMAGES_MAX, `Marquee ads support up to ${AD_IMAGES_MAX} images`)
    .default([]),
  linkUrl: adLink,
  linkLabel: z.string().max(60).default("Learn more"),
  active: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  startAt: isoDateCell,
  endAt: isoDateCell,
  ...clientCampaignFields,
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const adUpdateSchema = z.object({
  name: z.string().min(2, "Give the ad a name").max(160).optional(),
  type: z.enum(AD_TYPES).optional(),
  placement: z.enum(AD_PLACEMENTS).optional(),
  title: z.string().max(200).optional().or(z.literal("")),
  body: z.string().max(2000).optional().or(z.literal("")),
  imageUrl: optionalImageUrl,
  imageAlt: z.string().max(300).optional().or(z.literal("")),
  images: z
    .array(siteImageUrl)
    .max(AD_IMAGES_MAX, `Marquee ads support up to ${AD_IMAGES_MAX} images`)
    .optional(),
  linkUrl: adLink,
  linkLabel: z.string().max(60).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  startAt: isoDateCell,
  endAt: isoDateCell,
  ...clientCampaignFields,
  // staff-only review controls
  reviewStatus: z.enum(AD_REVIEW_STATUSES).optional(),
  reviewNote: z.string().max(2000).optional().or(z.literal("")),
});

/**
 * Advertiser submission (#/studio — Task 14). Deliberately narrow: no
 * scheduling, no priority, no client-billing fields — those stay with the
 * owner. The API layer forces source="client", reviewStatus="pending",
 * active=false and stamps submittedById on top of this payload.
 */
export const adSubmitSchema = z.object({
  name: z.string().min(2, "Give your ad a name").max(160),
  type: z.enum(["image", "gif", "text"]),
  placement: z.enum(AD_PLACEMENTS),
  title: z.string().max(200).optional().or(z.literal("")),
  body: z.string().max(2000).optional().or(z.literal("")),
  imageUrl: optionalImageUrl,
  imageAlt: z.string().max(300).optional().or(z.literal("")),
  linkUrl: z
    .string()
    .min(3, "Add the URL your ad should open")
    .max(1200)
    .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("#/"), {
      message: "Use a full https:// URL or an in-app route like #/store",
    }),
  linkLabel: z.string().max(60).default("Learn more"),
});

/** Advertiser edits of their OWN still-pending submission. */
export const adSubmitUpdateSchema = adSubmitSchema.partial();

// ---------- ad plans (Task 14 — monthly placement packages) ----------
export const adPlanCreateSchema = z.object({
  code: slug.optional(),
  name: z.string().min(2, "Plan name is required").max(120),
  description: z.string().max(2000).optional().or(z.literal("")),
  priceMonthly: z.number().min(0, "Monthly price cannot be negative").max(10_000_000),
  currency: z.string().min(1).max(8).default("INR"),
  features: z.array(z.string().min(1).max(160)).max(12).default([]),
  placements: z.array(z.enum(AD_PLACEMENTS)).max(16).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const adPlanUpdateSchema = z.object({
  code: slug.optional(),
  name: z.string().min(2, "Plan name is required").max(120).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  priceMonthly: z.number().min(0).max(10_000_000).optional(),
  currency: z.string().min(1).max(8).optional(),
  features: z.array(z.string().min(1).max(160)).max(12).optional(),
  placements: z.array(z.enum(AD_PLACEMENTS)).max(16).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

// ---------- ventures (Task 11) ----------
export const VENTURE_CATEGORIES = [
  "venture",
  "store",
  "community",
  "tech",
  "product",
  "service",
  "media",
] as const;
export const VENTURE_STATUSES = ["live", "incubating", "planned", "idea", "retired"] as const;

export const ventureCreateSchema = z.object({
  name: z.string().min(2, "Venture name is required").max(200),
  slug: slug.optional(), // auto-derived from name when absent (route slugifies)
  tagline: z.string().max(300).optional().or(z.literal("")),
  description: z.string().max(50_000).optional(),
  category: z.enum(VENTURE_CATEGORIES).default("venture"),
  status: z.enum(VENTURE_STATUSES).default("live"),
  location: z.string().max(200).optional().or(z.literal("")),
  websiteUrl: optionalUrl,
  imageUrl: optionalImageUrl,
  highlights: z.array(z.string().min(1).max(200)).max(16).default([]),
  collabRoles: z.array(z.string().min(1).max(200)).max(16).default([]),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isFeatured: z.boolean().default(false),
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const ventureUpdateSchema = z.object({
  name: z.string().min(2, "Venture name is required").max(200).optional(),
  slug: slug.optional(),
  tagline: z.string().max(300).optional().or(z.literal("")),
  description: z.string().max(50_000).optional(),
  category: z.enum(VENTURE_CATEGORIES).optional(),
  status: z.enum(VENTURE_STATUSES).optional(),
  location: z.string().max(200).optional().or(z.literal("")),
  websiteUrl: optionalUrl,
  imageUrl: optionalImageUrl,
  highlights: z.array(z.string().min(1).max(200)).max(16).optional(),
  collabRoles: z.array(z.string().min(1).max(200)).max(16).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isFeatured: z.boolean().optional(),
});

// ---------- audit undo/redo (admin, Task 9) ----------
export const auditIdSchema = z.object({
  id: z.string().min(10, "Invalid audit entry id"),
});

// ---------- bulk import (admin, Task 9) ----------
export const importPostsSchema = z.object({
  posts: z
    .array(
      z.object({
        title: z.string().min(4).max(200),
        slug: slug.optional(),
        excerpt: z.string().max(600).optional(),
        content: z.string().min(1).max(200_000),
        coverImageUrl: optionalUrl,
        tags: z.array(z.string().min(1).max(60)).max(20).default([]),
        status: z.enum(["draft", "published", "archived"]).default("published"),
        publishedAt: z.string().optional(),
        seoTitle: z.string().max(70).optional(),
        seoDescription: z.string().max(180).optional(),
        canonicalUrl: optionalUrl,
      })
    )
    .max(200),
});

export const importProductsSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().min(3).max(200),
        slug: slug.optional(),
        tagline: z.string().max(300).optional(),
        description: z.string().max(80_000).optional(),
        brand: z.string().max(120).optional(),
        merchant: z.string().max(120).optional(),
        imageUrl: optionalUrl,
        price: z.number().min(0).max(10_000_000).optional().nullable(),
        compareAtPrice: z.number().min(0).max(10_000_000).optional().nullable(),
        affiliateUrl: z.string().min(3).max(1200),
        rating: z.number().min(0).max(5).default(0),
        status: z.enum(["active", "draft", "archived"]).default("active"),
        isFeatured: z.boolean().default(false),
        pros: z.array(z.string().min(1).max(PRO_CON_ITEM_MAX)).max(PRO_CON_MAX).default([]),
        cons: z.array(z.string().min(1).max(PRO_CON_ITEM_MAX)).max(PRO_CON_MAX).default([]),
      })
    )
    .max(200),
});
