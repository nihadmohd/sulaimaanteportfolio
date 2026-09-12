import { z } from "zod";

/** Zod schemas for every API input — shared by routes (server) and forms (client). */

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
  .max(600)
  .optional()
  .or(z.literal(""));

// ---------- auth lifecycle ----------
export const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(80),
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
      fullName: z.string().min(2).max(80).optional(),
      headline: z.string().max(120).optional(),
      location: z.string().max(80).optional(),
      interests: z.array(z.string().max(40)).max(12).optional(),
      goals: z.array(z.string().max(40)).max(12).optional(),
      marketingOptIn: z.boolean().optional(),
    })
    .default({}),
});

// ---------- posts ----------
export const postCreateSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").max(140),
  slug: slug.optional(),
  excerpt: z.string().max(300).optional(),
  content: z.string().min(1, "Content is required").max(80_000),
  coverImageUrl: optionalUrl,
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  readingTimeMinutes: z.number().int().min(1).max(90).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(180).optional(),
  ogImageUrl: optionalUrl,
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
  title: z.string().min(4, "Title must be at least 4 characters").max(140).optional(),
  slug: slug.optional(),
  excerpt: z.string().max(300).optional(),
  content: z.string().min(1, "Content is required").max(80_000).optional(),
  coverImageUrl: optionalUrl,
  status: z.enum(["draft", "published", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  readingTimeMinutes: z.number().int().min(1).max(90).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(180).optional(),
  ogImageUrl: optionalUrl,
  canonicalUrl: optionalUrl,
  publishedAt: z.string().optional(),
});

// ---------- products ----------
export const productCreateSchema = z.object({
  name: z.string().min(3, "Product name is required").max(140),
  slug: slug.optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(30_000).optional(),
  brand: z.string().max(60).optional(),
  merchant: z.string().max(60).optional(),
  imageUrl: optionalUrl,
  gallery: z.array(z.string().url().max(600)).max(8).default([]),
  price: z.number().min(0).max(10_000_000).optional().nullable(),
  compareAtPrice: z.number().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().min(1).max(8).default("INR"),
  affiliateUrl: z.string().min(3, "Affiliate URL is required").max(600),
  pros: z.array(z.string().min(1).max(120)).max(10).default([]),
  cons: z.array(z.string().min(1).max(120)).max(10).default([]),
  keySpecs: z.record(z.string().max(40), z.string().max(120)).default({}),
  rating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().min(0).max(10_000_000).default(0),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().min(1).optional().nullable(),
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const productUpdateSchema = z.object({
  name: z.string().min(3, "Product name is required").max(140).optional(),
  slug: slug.optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(30_000).optional(),
  brand: z.string().max(60).optional(),
  merchant: z.string().max(60).optional(),
  imageUrl: optionalUrl,
  gallery: z.array(z.string().url().max(600)).max(8).optional(),
  price: z.number().min(0).max(10_000_000).optional().nullable(),
  compareAtPrice: z.number().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().min(1).max(8).optional(),
  affiliateUrl: z.string().min(3, "Affiliate URL is required").max(600).optional(),
  pros: z.array(z.string().min(1).max(120)).max(10).optional(),
  cons: z.array(z.string().min(1).max(120)).max(10).optional(),
  keySpecs: z.record(z.string().max(40), z.string().max(120)).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).max(10_000_000).optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  categoryId: z.string().min(1).optional().nullable(),
});

// ---------- categories ----------
export const categoryCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(60),
  slug: slug.optional(),
  description: z.string().max(300).optional(),
  scope: z.enum(["blog", "store"]).default("blog"),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const categoryUpdateSchema = z.object({
  name: z.string().min(2, "Name is required").max(60).optional(),
  slug: slug.optional(),
  description: z.string().max(300).optional(),
  scope: z.enum(["blog", "store"]).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

// ---------- inquiries ----------
export const inquiryCreateSchema = z.object({
  name: z.string().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email").max(160),
  phone: z.string().max(20).optional().or(z.literal("")),
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
  subject: z.string().max(160).optional(),
  message: z.string().min(10, "Tell us a bit more (min 10 characters)").max(4000),
});

export const inquiryUpdateSchema = z
  .object({
    status: z.enum(["new", "in_progress", "replied", "closed", "spam"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    internalNote: z.string().max(4000).optional(),
    replied: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ---------- users (admin) ----------
export const userUpdateSchema = z
  .object({
    role: z.enum(["reader", "author", "editor", "admin"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ---------- newsletter ----------
export const newsletterSubscribeSchema = z.object({
  email: z.string().email("Enter a valid email").max(160),
  source: z.enum(["blog", "store", "footer", "lead_magnet", "services", "support"]).default("footer"),
});

export const newsletterUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "unsubscribed"]),
});

// ---------- settings ----------
export const settingsUpdateSchema = z.object({
  value: z.record(z.string(), z.unknown()),
});

// ---------- ads (admin, Task 9) ----------
export const AD_TYPES = ["image", "gif", "sticker", "text", "marquee"] as const;
export const AD_PLACEMENTS = [
  "header-banner",
  "blog-inline",
  "blog-sidebar",
  "between-cards",
  "home-strip",
  "store-side",
  "footer-banner",
  "product-inline",
  "marquee",
  "sticker",
] as const;

/** Ad link targets: absolute http(s) URLs or in-app hash routes (#/...). */
const adLink = z
  .string()
  .max(600)
  .refine((v) => v === "" || v.startsWith("#/") || /^https?:\/\//.test(v), {
    message: "Use a full https:// URL or an in-app route like #/store",
  })
  .optional()
  .or(z.literal(""));

export const adCreateSchema = z.object({
  name: z.string().min(2, "Give the ad a name").max(80),
  type: z.enum(AD_TYPES),
  placement: z.enum(AD_PLACEMENTS),
  title: z.string().max(120).optional().or(z.literal("")),
  body: z.string().max(600).optional().or(z.literal("")),
  imageUrl: optionalUrl,
  imageAlt: z.string().max(160).optional().or(z.literal("")),
  images: z.array(z.string().url().max(600)).max(16).default([]),
  linkUrl: adLink,
  linkLabel: z.string().max(40).default("Learn more"),
  active: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  startAt: z.string().datetime().optional().nullable().or(z.literal("").transform(() => null)),
  endAt: z.string().datetime().optional().nullable().or(z.literal("").transform(() => null)),
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const adUpdateSchema = z.object({
  name: z.string().min(2, "Give the ad a name").max(80).optional(),
  type: z.enum(AD_TYPES).optional(),
  placement: z.enum(AD_PLACEMENTS).optional(),
  title: z.string().max(120).optional().or(z.literal("")),
  body: z.string().max(600).optional().or(z.literal("")),
  imageUrl: optionalUrl,
  imageAlt: z.string().max(160).optional().or(z.literal("")),
  images: z.array(z.string().url().max(600)).max(16).optional(),
  linkUrl: adLink,
  linkLabel: z.string().max(40).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  startAt: z.string().datetime().optional().nullable().or(z.literal("").transform(() => null)),
  endAt: z.string().datetime().optional().nullable().or(z.literal("").transform(() => null)),
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
  name: z.string().min(2, "Venture name is required").max(120),
  slug: slug.optional(), // auto-derived from name when absent (route slugifies)
  tagline: z.string().max(160).optional().or(z.literal("")),
  description: z.string().max(20_000).optional(),
  category: z.enum(VENTURE_CATEGORIES).default("venture"),
  status: z.enum(VENTURE_STATUSES).default("live"),
  location: z.string().max(120).optional().or(z.literal("")),
  websiteUrl: optionalUrl,
  imageUrl: optionalUrl,
  highlights: z.array(z.string().min(1).max(80)).max(8).default([]),
  collabRoles: z.array(z.string().min(1).max(80)).max(8).default([]),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isFeatured: z.boolean().default(false),
});

/** Update schema — explicit optional-only shape (see postUpdateSchema note). */
export const ventureUpdateSchema = z.object({
  name: z.string().min(2, "Venture name is required").max(120).optional(),
  slug: slug.optional(),
  tagline: z.string().max(160).optional().or(z.literal("")),
  description: z.string().max(20_000).optional(),
  category: z.enum(VENTURE_CATEGORIES).optional(),
  status: z.enum(VENTURE_STATUSES).optional(),
  location: z.string().max(120).optional().or(z.literal("")),
  websiteUrl: optionalUrl,
  imageUrl: optionalUrl,
  highlights: z.array(z.string().min(1).max(80)).max(8).optional(),
  collabRoles: z.array(z.string().min(1).max(80)).max(8).optional(),
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
        title: z.string().min(4).max(140),
        slug: slug.optional(),
        excerpt: z.string().max(300).optional(),
        content: z.string().min(1).max(80_000),
        coverImageUrl: optionalUrl,
        tags: z.array(z.string().min(1).max(30)).max(10).default([]),
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
        name: z.string().min(3).max(140),
        slug: slug.optional(),
        tagline: z.string().max(160).optional(),
        description: z.string().max(30_000).optional(),
        brand: z.string().max(60).optional(),
        merchant: z.string().max(60).optional(),
        imageUrl: optionalUrl,
        price: z.number().min(0).max(10_000_000).optional().nullable(),
        compareAtPrice: z.number().min(0).max(10_000_000).optional().nullable(),
        affiliateUrl: z.string().min(3).max(600),
        rating: z.number().min(0).max(5).default(0),
        status: z.enum(["active", "draft", "archived"]).default("active"),
        isFeatured: z.boolean().default(false),
        pros: z.array(z.string().min(1).max(120)).max(10).default([]),
        cons: z.array(z.string().min(1).max(120)).max(10).default([]),
      })
    )
    .max(200),
});
