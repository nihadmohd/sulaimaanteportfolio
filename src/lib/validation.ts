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

export const postUpdateSchema = postCreateSchema.partial();

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

export const productUpdateSchema = productCreateSchema.partial();

// ---------- categories ----------
export const categoryCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(60),
  slug: slug.optional(),
  description: z.string().max(300).optional(),
  scope: z.enum(["blog", "store"]).default("blog"),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// ---------- inquiries ----------
export const inquiryCreateSchema = z.object({
  name: z.string().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email").max(160),
  phone: z.string().max(20).optional().or(z.literal("")),
  type: z
    .enum(["general", "sponsorship", "partnership", "advertising", "support", "feedback"])
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

// ---------- billing (mock) ----------
export const subscriptionManageSchema = z.object({
  action: z.enum(["change", "cancel", "resume", "renew", "simulate"]),
  planCode: z.string().max(30).optional(),
  interval: z.enum(["monthly", "yearly"]).optional(),
  paymentOutcome: z.enum(["success", "failed", "pending"]).optional(),
});

// ---------- settings ----------
export const settingsUpdateSchema = z.object({
  value: z.record(z.string(), z.unknown()),
});

// ---------- plans (admin) ----------
export const planCreateSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional(),
  priceMonthly: z.number().min(0).max(1_000_000).default(0),
  priceYearly: z.number().min(0).max(1_000_000).default(0),
  currency: z.string().min(1).max(8).default("INR"),
  features: z.array(z.string().min(1).max(80)).max(12).default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export const planUpdateSchema = planCreateSchema.partial();
