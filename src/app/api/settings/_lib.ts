import { FOOTER_DEFAULT, SITE, SOCIALS } from "@/lib/constants";
import type {
  AdsSettings,
  AnalyticsSettings,
  BrandSettings,
  ContactSettings,
  FeaturesSettings,
  FooterSettings,
  JsonRecord,
  LocalizationSettings,
  MaintenanceSettings,
  MarqueeMessage,
  MarqueeSpeed,
  MediaSettings,
  SeoSettings,
  StickerItem,
} from "@/types";

/**
 * Site settings helpers (private to api/settings/** — Task 6-a).
 *
 * site_settings.value is a JSON STRING column. Unlike the flat string-map
 * columns (parseJsonRecord), settings blobs are NESTED objects
 * (media.heroMarquee.images, ads.placements[]) so they need a real
 * JSON.parse + shape-guarded merge over the constants defaults.
 */

export const SETTING_KEYS = [
  "brand",
  "footer",
  "media",
  "ads",
  "features",
  "seo",
  "contact",
  "localization",
  "analytics",
  "maintenance",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Safe JSON.parse of a settings row → plain object ({} on any failure). */
export function parseSettingObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* defaults (constants.ts is the single source of truth)               */
/* ------------------------------------------------------------------ */

export function defaultBrand(): BrandSettings {
  const socials: Record<string, string> = {};
  for (const s of SOCIALS) socials[s.name] = s.url;
  return {
    siteName: SITE.name,
    ownerName: SITE.owner,
    roleLine: SITE.roleLine,
    tagline: SITE.tagline,
    email: SITE.email,
    phone: SITE.phone,
    whatsappUrl: SITE.whatsappUrl,
    address: SITE.address,
    socials,
    cvUrl: SITE.cvUrl,
  };
}

export function defaultFooter(): FooterSettings {
  return {
    tagline: FOOTER_DEFAULT.tagline,
    columns: FOOTER_DEFAULT.columns.map((c) => ({
      title: c.title,
      links: c.links.map((l) => ({ label: l.label, href: l.href })),
    })),
    copyright: FOOTER_DEFAULT.copyright,
    socialsEnabled: FOOTER_DEFAULT.socialsEnabled,
  };
}

export function defaultMedia(): MediaSettings {
  return {
    heroMarquee: {
      enabled: true,
      images: [
        "/images/brand/og-cover.png",
        "/images/blog/blog-ai-workflow.png",
        "/images/store/prod-creator-camera.png",
        "/images/blog/blog-ai-tools.png",
        "/images/store/prod-headphones.png",
        "/images/blog/blog-kp-foundation.png",
        "/images/store/prod-keyboard.png",
        "/images/brand/portrait.png",
      ],
      messages: [
        { text: "AI-powered sites from \u20B94,999", href: "#/services" },
        { text: "Honest gear reviews \u2014 curated in Calicut", href: "#/store" },
        { text: "Join a venture \u2014 build the next startup with me", href: "#/ventures" },
        { text: "Free quote within 24 hours", href: "#/contact" },
        { text: "The 195-country mission", href: "#/about" },
        { text: "New on the blog \u2014 AI workflows that ship", href: "#/blog" },
      ],
      speed: "normal",
    },
    stickers: { enabled: false, items: [] },
    blogGifs: { enabled: false, gifs: [] },
  };
}

export function defaultAds(): AdsSettings {
  return { enabled: true, placements: ["blog-inline", "blog-sidebar", "home-strip", "store-side"] };
}

export function defaultMaintenance(): MaintenanceSettings & { estimatedEnd: string | null } {
  return {
    enabled: false,
    message: "We are performing scheduled maintenance. Back shortly.",
    estimatedEnd: null,
  };
}

export function defaultFeatures(): FeaturesSettings {
  return {
    newsletter: true,
    shareButtons: true,
    presenceBadge: true,
    cookieConsent: true,
    registration: true,
    trendingBadge: true,
    viewCounts: true,
    readingTime: true,
    affiliateSlots: true,
  };
}

export function defaultSeo(): SeoSettings {
  return {
    titleSuffix: "| MN.KP",
    defaultDescription:
      "AI-powered web, app, photo and video solutions from Calicut, Kerala — by MOHAMMED NIHAD KP.",
    keywords: [
      "AI development Calicut",
      "freelance developer Kerala",
      "web development Kozhikode",
      "MOHAMMED NIHAD KP",
    ],
    googleVerification: "",
    bingVerification: "",
  };
}

/**
 * site_settings key "contact" (Task 11-c) — DEFAULT MODE: mirrors the live
 * MN.KP contact details (constants.ts SITE). socials starts EMPTY by design:
 * the brand tab owns the canonical social profile map; the contact group's
 * map is a dedicated extension point (e.g. per-context links) so it ships {}.
 */
export function defaultContact(): ContactSettings {
  return {
    email: "intobusyness@gmail.com",
    phone: "+91 98467 50898",
    whatsappNumber: "+91 98467 50898",
    whatsappUrl: "https://wa.me/919846750898",
    address: "Calicut (Kozhikode), Kerala, India",
    city: "Calicut",
    responseTimeHours: 24,
    socials: {},
  };
}

/**
 * site_settings key "localization" (Task 11-c) — DEFAULT MODE: India-first
 * (₹ INR, Asia/Calicut timezone, "d MMM yyyy" dates, metric units).
 */
export function defaultLocalization(): LocalizationSettings {
  return {
    currency: "INR",
    currencySymbol: "₹",
    timezone: "Asia/Calcutta",
    dateFormat: "d MMM yyyy",
    measurement: "metric",
  };
}

/**
 * site_settings key "analytics" (Task 11-c) — DEFAULT MODE: privacy-first —
 * tracking stays OFF until the owner opts in; both integration IDs start
 * empty (= nothing loaded); outbound-click tracking is ON so it activates
 * the moment analytics is switched on.
 */
export function defaultAnalytics(): AnalyticsSettings {
  return {
    enabled: false,
    googleAnalyticsId: "",
    plausibleDomain: "",
    trackOutboundClicks: true,
  };
}

/* ------------------------------------------------------------------ */
/* shape guards                                                        */
/* ------------------------------------------------------------------ */

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Numeric coercion with Number.isFinite fallback to the default. */
function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Enum-style guard: only whitelisted strings pass, else the default. */
function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = typeof v === "string" ? v : "";
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter((x): x is string => typeof x === "string");
}

function record(v: unknown, fallback: Record<string, string>): Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fallback;
  const out: Record<string, string> = { ...fallback };
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  }
  return out;
}

const AD_PLACEMENTS = ["blog-inline", "blog-sidebar", "home-strip", "hero-marquee", "store-side"];

const MARQUEE_SPEEDS: readonly MarqueeSpeed[] = ["slow", "normal", "fast"];

/**
 * Hero marquee marketing chips (Task 12-d): text trimmed to 60 chars, href
 * only in-app hash routes or https URLs (anything else degrades to null).
 * A MISSING array falls back to the default chips; a present (even empty)
 * array is honored as deliberate owner intent. Capped at 12 chips.
 */
function resolveMarqueeMessages(v: unknown, fallback: MarqueeMessage[]): MarqueeMessage[] {
  if (!Array.isArray(v)) return fallback;
  const out: MarqueeMessage[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const m = item as { text?: unknown; href?: unknown };
    if (typeof m.text !== "string") continue;
    const text = m.text.trim().slice(0, 60);
    if (!text) continue;
    let href: string | null = null;
    if (typeof m.href === "string") {
      const t = m.href.trim();
      if (t.startsWith("#/") || t.startsWith("https://")) href = t;
    }
    out.push({ text, href });
    if (out.length >= 12) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* resolvers: stored row merged over defaults                           */
/* ------------------------------------------------------------------ */

export function resolveBrand(raw: Record<string, unknown>): BrandSettings {
  const d = defaultBrand();
  return {
    siteName: str(raw.siteName, d.siteName),
    ownerName: str(raw.ownerName, d.ownerName),
    roleLine: str(raw.roleLine, d.roleLine),
    tagline: str(raw.tagline, d.tagline),
    email: str(raw.email, d.email),
    phone: str(raw.phone, d.phone),
    whatsappUrl: str(raw.whatsappUrl, d.whatsappUrl),
    address: str(raw.address, d.address),
    socials: record(raw.socials, d.socials),
    cvUrl: str(raw.cvUrl, d.cvUrl),
  };
}

export function resolveFooter(raw: Record<string, unknown>): FooterSettings {
  const d = defaultFooter();
  const columns = Array.isArray(raw.columns)
    ? (raw.columns as unknown[])
        .map((c): FooterSettings["columns"][number] | null => {
          if (typeof c !== "object" || c === null) return null;
          const col = c as { title?: unknown; links?: unknown };
          if (!Array.isArray(col.links)) return null;
          const links = (col.links as unknown[])
            .map((l): FooterSettings["columns"][number]["links"][number] | null => {
              if (typeof l !== "object" || l === null) return null;
              const link = l as { label?: unknown; href?: unknown };
              if (typeof link.label !== "string" || typeof link.href !== "string") return null;
              return { label: link.label, href: link.href };
            })
            .filter((l): l is { label: string; href: string } => l !== null);
          return { title: str(col.title, "Column"), links };
        })
        .filter((c): c is FooterSettings["columns"][number] => c !== null)
    : d.columns;
  return {
    tagline: str(raw.tagline, d.tagline),
    columns: columns.length > 0 ? columns : d.columns,
    copyright: str(raw.copyright, d.copyright),
    socialsEnabled: bool(raw.socialsEnabled, d.socialsEnabled),
  };
}

function resolveStickerItems(v: unknown): StickerItem[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .map((s): StickerItem | null => {
      if (typeof s !== "object" || s === null) return null;
      const item = s as { type?: unknown; value?: unknown; corner?: unknown };
      if (typeof item.value !== "string") return null;
      const corner = typeof item.corner === "string" ? item.corner : "br";
      return { type: typeof item.type === "string" ? item.type : "emoji", value: item.value, corner };
    })
    .filter((s): s is StickerItem => s !== null)
    .slice(0, 8);
}

export function resolveMedia(raw: Record<string, unknown>): MediaSettings {
  const d = defaultMedia();
  const hero =
    typeof raw.heroMarquee === "object" && raw.heroMarquee !== null
      ? (raw.heroMarquee as Record<string, unknown>)
      : {};
  const stickers =
    typeof raw.stickers === "object" && raw.stickers !== null
      ? (raw.stickers as Record<string, unknown>)
      : {};
  const gifs =
    typeof raw.blogGifs === "object" && raw.blogGifs !== null
      ? (raw.blogGifs as Record<string, unknown>)
      : {};
  return {
    heroMarquee: {
      enabled: bool(hero.enabled, d.heroMarquee.enabled),
      images: strArray(hero.images, d.heroMarquee.images).slice(0, 16),
      messages: resolveMarqueeMessages(hero.messages, d.heroMarquee.messages),
      speed: pick(hero.speed, MARQUEE_SPEEDS, d.heroMarquee.speed),
    },
    stickers: {
      enabled: bool(stickers.enabled, d.stickers.enabled),
      items: resolveStickerItems(stickers.items),
    },
    blogGifs: {
      enabled: bool(gifs.enabled, d.blogGifs.enabled),
      gifs: strArray(gifs.gifs, d.blogGifs.gifs).slice(0, 16),
    },
  };
}

export function resolveAds(raw: Record<string, unknown>): AdsSettings {
  const d = defaultAds();
  const placements = strArray(raw.placements, d.placements).filter((p) =>
    (AD_PLACEMENTS as string[]).includes(p)
  );
  return {
    enabled: bool(raw.enabled, d.enabled),
    placements: placements.length > 0 ? placements : d.placements,
  };
}

export function resolveMaintenance(
  raw: Record<string, unknown>
): MaintenanceSettings & { estimatedEnd: string | null } {
  const d = defaultMaintenance();
  return {
    enabled: bool(raw.enabled, d.enabled),
    message: str(raw.message, d.message),
    estimatedEnd: typeof raw.estimatedEnd === "string" && raw.estimatedEnd ? raw.estimatedEnd : null,
  };
}

export function resolveFeatures(raw: Record<string, unknown>): FeaturesSettings {
  const d = defaultFeatures();
  return {
    newsletter: bool(raw.newsletter, d.newsletter),
    shareButtons: bool(raw.shareButtons, d.shareButtons),
    presenceBadge: bool(raw.presenceBadge, d.presenceBadge),
    cookieConsent: bool(raw.cookieConsent, d.cookieConsent),
    registration: bool(raw.registration, d.registration),
    trendingBadge: bool(raw.trendingBadge, d.trendingBadge),
    viewCounts: bool(raw.viewCounts, d.viewCounts),
    readingTime: bool(raw.readingTime, d.readingTime),
    affiliateSlots: bool(raw.affiliateSlots, d.affiliateSlots),
  };
}

export function resolveSeo(raw: Record<string, unknown>): SeoSettings {
  const d = defaultSeo();
  return {
    titleSuffix: str(raw.titleSuffix, d.titleSuffix),
    defaultDescription: str(raw.defaultDescription, d.defaultDescription),
    keywords: strArray(raw.keywords, d.keywords).slice(0, 20),
    googleVerification: str(raw.googleVerification, d.googleVerification),
    bingVerification: str(raw.bingVerification, d.bingVerification),
  };
}

const DATE_FORMATS = ["d MMM yyyy", "dd/MM/yyyy", "MM/dd/yyyy"] as const;
const MEASUREMENTS = ["metric", "imperial"] as const;

export function resolveContact(raw: Record<string, unknown>): ContactSettings {
  const d = defaultContact();
  return {
    email: str(raw.email, d.email).trim(),
    phone: str(raw.phone, d.phone).trim(),
    whatsappNumber: str(raw.whatsappNumber, d.whatsappNumber).trim(),
    whatsappUrl: str(raw.whatsappUrl, d.whatsappUrl).trim(),
    address: str(raw.address, d.address),
    city: str(raw.city, d.city).trim(),
    // clamp to 0–168h (a week) so "replies within X hours" copy stays sane
    responseTimeHours: Math.max(0, Math.min(168, Math.round(num(raw.responseTimeHours, d.responseTimeHours)))),
    socials: record(raw.socials, d.socials),
  };
}

export function resolveLocalization(raw: Record<string, unknown>): LocalizationSettings {
  const d = defaultLocalization();
  return {
    currency: str(raw.currency, d.currency).trim().toUpperCase().slice(0, 6) || d.currency,
    currencySymbol: str(raw.currencySymbol, d.currencySymbol).trim().slice(0, 4) || d.currencySymbol,
    timezone: str(raw.timezone, d.timezone).trim() || d.timezone,
    dateFormat: pick(raw.dateFormat, DATE_FORMATS, d.dateFormat),
    measurement: pick(raw.measurement, MEASUREMENTS, d.measurement),
  };
}

export function resolveAnalytics(raw: Record<string, unknown>): AnalyticsSettings {
  const d = defaultAnalytics();
  return {
    enabled: bool(raw.enabled, d.enabled),
    googleAnalyticsId: str(raw.googleAnalyticsId, d.googleAnalyticsId).trim(),
    plausibleDomain: str(raw.plausibleDomain, d.plausibleDomain).trim(),
    trackOutboundClicks: bool(raw.trackOutboundClicks, d.trackOutboundClicks),
  };
}

/** Parse a settings row value into the loose admin JsonRecord shape. */
export function asJsonRecord(raw: string | null | undefined): JsonRecord {
  const parsed = parseSettingObject(raw);
  const out: JsonRecord = {};
  for (const [key, value] of Object.entries(parsed)) {
    // primitives + nested JSON values both satisfy JsonValue
    out[key] = value as never;
  }
  return out;
}
