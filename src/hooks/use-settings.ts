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
    heroMarquee?: { images?: string[]; enabled?: boolean };
    stickers?: { enabled?: boolean };
  };
  ads?: { enabled?: boolean };
  maintenance?: {
    enabled?: boolean;
    message?: string;
    estimatedEnd?: string | null;
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
