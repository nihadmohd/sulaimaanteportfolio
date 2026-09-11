import { FOOTER_DEFAULT, SITE, SOCIALS } from "@/lib/constants";
import type {
  AdsSettings,
  BrandSettings,
  FooterSettings,
  JsonRecord,
  MaintenanceSettings,
  MediaSettings,
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

export const SETTING_KEYS = ["brand", "footer", "media", "ads", "maintenance"] as const;
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
    heroMarquee: { enabled: false, images: [] },
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

/* ------------------------------------------------------------------ */
/* shape guards                                                        */
/* ------------------------------------------------------------------ */

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
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

const AD_PLACEMENTS = ["blog-inline", "blog-sidebar", "home-strip", "store-side"];

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
