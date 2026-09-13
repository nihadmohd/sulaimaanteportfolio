"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { FOOTER_DEFAULT, type FooterColumn } from "@/lib/constants";

/**
 * Public site settings — GET /api/settings (sanitized subset).
 * The endpoint may 404 while later waves land; every consumer must treat
 * missing/error data as "use defaults", which this hook guarantees by
 * resolving null instead of throwing.
 */

export interface SettingsFooter {
  tagline: string;
  columns: FooterColumn[];
  copyright: string;
  socialsEnabled: boolean;
}

export interface SiteSettings {
  brand?: {
    siteName?: string;
    tagline?: string;
    email?: string;
    phone?: string;
    whatsappUrl?: string;
  };
  footer?: Partial<SettingsFooter>;
  media?: Record<string, unknown> & {
    heroMarquee?: {
      /** Legacy plain strings + {src, href} rows persisted by the admin editor. */
      images?: Array<string | { src: string; href?: string | null }>;
      enabled?: boolean;
      messages?: Array<{ text?: string; href?: string | null }>;
      speed?: "slow" | "normal" | "fast";
    };
    stickers?: { enabled?: boolean };
  };
  ads?: { enabled?: boolean };
  features?: {
    cookieConsent?: boolean;
  };
  maintenance?: {
    enabled?: boolean;
    message?: string;
    estimatedEnd?: string | null;
  };
  /** Task 11-c groups — resolved with defaults by GET /api/settings. */
  contact?: {
    email?: string;
    phone?: string;
    whatsappNumber?: string;
    whatsappUrl?: string;
    address?: string;
    city?: string;
    responseTimeHours?: number;
    socials?: Record<string, string>;
  };
  localization?: {
    currency?: string;
    currencySymbol?: string;
    timezone?: string;
    dateFormat?: string;
    measurement?: string;
  };
  analytics?: {
    enabled?: boolean;
    googleAnalyticsId?: string;
    plausibleDomain?: string;
    metaPixelId?: string;
    trackOutboundClicks?: boolean;
  };
}

async function fetchSettings(): Promise<SiteSettings | null> {
  try {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as
      | { ok: true; data: SiteSettings }
      | { ok: false; error: { code: string } };
    if (!json.ok) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}

export type SettingsQuery = UseQueryResult<SiteSettings | null>;

/** Shared settings query (queryKey ["settings"] — reused by footer/ads/maintenance). */
export function useSettings(): SettingsQuery {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Resolved footer settings with contract defaults applied. */
export function resolveFooter(settings: SiteSettings | null | undefined): SettingsFooter {
  const footer = settings?.footer;
  const columns = Array.isArray(footer?.columns)
    ? (footer?.columns as FooterColumn[])
    : FOOTER_DEFAULT.columns;
  return {
    tagline: footer?.tagline ?? FOOTER_DEFAULT.tagline,
    columns,
    copyright: footer?.copyright ?? FOOTER_DEFAULT.copyright,
    socialsEnabled: footer?.socialsEnabled ?? FOOTER_DEFAULT.socialsEnabled,
  };
}

/** Ads enabled unless explicitly disabled (defaults ON per contract §11). */
export function adsEnabled(settings: SiteSettings | null | undefined): boolean {
  return settings?.ads?.enabled !== false;
}

/** Maintenance block (enabled defaults OFF when settings are unavailable). */
export function maintenanceInfo(
  settings: SiteSettings | null | undefined
): { enabled: boolean; message?: string; estimatedEnd?: string | null } {
  const m = settings?.maintenance;
  return {
    enabled: m?.enabled === true,
    message: m?.message,
    estimatedEnd: m?.estimatedEnd ?? null,
  };
}

/**
 * Resolved contact block (Task 11-c) — the API already merges the documented
 * defaults; these fallbacks only apply when the endpoint is unreachable.
 * Default mode: live MN.KP contact details, empty contact socials map.
 */
export function contactInfo(settings: SiteSettings | null | undefined): {
  email: string;
  phone: string;
  whatsappNumber: string;
  whatsappUrl: string;
  address: string;
  city: string;
  responseTimeHours: number;
  socials: Record<string, string>;
} {
  const c = settings?.contact;
  return {
    email: c?.email ?? "intobusyness@gmail.com",
    phone: c?.phone ?? "+91 98467 50898",
    whatsappNumber: c?.whatsappNumber ?? "+91 98467 50898",
    whatsappUrl: c?.whatsappUrl ?? "https://wa.me/919846750898",
    address: c?.address ?? "Calicut (Kozhikode), Kerala, India",
    city: c?.city ?? "Calicut",
    responseTimeHours: typeof c?.responseTimeHours === "number" ? c.responseTimeHours : 24,
    socials: c?.socials ?? {},
  };
}
