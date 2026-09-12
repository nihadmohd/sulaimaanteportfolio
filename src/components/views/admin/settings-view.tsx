"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Globe,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { JsonRecord, StatsResponse } from "@/types";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, formatUptime, useAdminGuard } from "./_shared";

/**
 * Settings (#/admin/settings — route key "admin-settings").
 * Tabs: Brand / Footer / Media & Decor / Ads / Features / SEO / Contact &
 * Social / Localization / Analytics / Maintenance / System.
 * Loads /api/settings/all; per-tab Save → PATCH /api/settings/:key, then
 * invalidates the PUBLIC settings query (queryKey ["settings"] — shared
 * with the whole shell via use-settings) so header/footer/ads/maintenance
 * react instantly.
 */

/* ------------------------------------------------------------------ */
/* draft shapes                                                        */
/* ------------------------------------------------------------------ */

interface SocialRow {
  key: string;
  url: string;
}
interface LinkRow {
  label: string;
  href: string;
}
interface ColumnDraft {
  title: string;
  links: LinkRow[];
}
interface StickerDraft {
  type: string;
  value: string;
  corner: string;
}

interface BrandDraft {
  siteName: string;
  ownerName: string;
  roleLine: string;
  tagline: string;
  email: string;
  phone: string;
  whatsappUrl: string;
  address: string;
  cvUrl: string;
  socials: SocialRow[];
}

interface FooterDraft {
  tagline: string;
  copyright: string;
  socialsEnabled: boolean;
  columns: ColumnDraft[];
}

interface MediaDraft {
  heroEnabled: boolean;
  heroImages: string[];
  stickersEnabled: boolean;
  stickerItems: StickerDraft[];
  gifsEnabled: boolean;
  gifs: string[];
}

interface AdsDraft {
  enabled: boolean;
  placements: string[];
}

interface MaintenanceDraft {
  enabled: boolean;
  message: string;
  estimatedEnd: string;
}

interface FeaturesDraft {
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

interface SeoDraft {
  titleSuffix: string;
  defaultDescription: string;
  keywords: string[];
  googleVerification: string;
  bingVerification: string;
}

interface ContactDraft {
  email: string;
  phone: string;
  whatsappNumber: string;
  whatsappUrl: string;
  address: string;
  city: string;
  /** string for the number input — coerced (0–168) on save */
  responseTimeHours: string;
  socials: SocialRow[];
}

interface LocalizationDraft {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  measurement: string;
}

interface AnalyticsDraft {
  enabled: boolean;
  googleAnalyticsId: string;
  plausibleDomain: string;
  trackOutboundClicks: boolean;
}

/* ------------------------------------------------------------------ */
/* JSON readers                                                        */
/* ------------------------------------------------------------------ */

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asRecord(v: unknown): Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}
function asNumString(v: unknown, fallback: number): string {
  const n =
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? String(n) : String(fallback);
}

/* Sticker emoji palette — these ARE sticker admin-data values (the single
 * sanctioned exception to the no-emoji-in-source rule per BUILD CONTRACT
 * §0 + task spec). */
const STICKER_PALETTE = ["🚀", "✨", "⭐", "🔥", "💡", "🎯", "🏆", "💎", "🌟", "⚡"];

const AD_PLACEMENTS = [
  { value: "blog-inline", label: "Blog — inline (mid-article)" },
  { value: "blog-sidebar", label: "Blog — sidebar rail" },
  { value: "home-strip", label: "Home — strip" },
  { value: "store-side", label: "Store — side panel" },
];

const SOCIAL_KEYS = [
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "X",
  "Facebook",
  "Threads",
  "Pinterest",
  "Google Business",
];

/** Contact-tab social suggestions (contact.socials defaults to EMPTY — the
 * Brand tab owns the canonical social profile map). */
const CONTACT_SOCIAL_KEYS = [
  "Instagram",
  "YouTube",
  "LinkedIn",
  "GitHub",
  "X",
  "Facebook",
  "WhatsApp",
  "Threads",
];

/* Localization presets (Task 11-c) — defaults: INR / ₹ / Asia/Calcutta /
 * d MMM yyyy / metric (India-first default mode). */
const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — British Pound (£)" },
  { value: "AED", label: "AED — UAE Dirham" },
];

const TIMEZONES = [
  { value: "Asia/Calcutta", label: "Asia/Calcutta — India (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai — UAE (GST)" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh — Saudi Arabia" },
  { value: "Europe/London", label: "Europe/London — UK" },
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "America/New_York", label: "America/New_York — US Eastern" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "d MMM yyyy", label: "d MMM yyyy — 5 Mar 2026" },
  { value: "dd/MM/yyyy", label: "dd/MM/yyyy — 05/03/2026" },
  { value: "MM/dd/yyyy", label: "MM/dd/yyyy — 03/05/2026" },
];

const MEASUREMENT_OPTIONS = [
  { value: "metric", label: "Metric — km / kg / °C" },
  { value: "imperial", label: "Imperial — miles / lb / °F" },
];

/** One row per features toggle — label + one-line hint. */
const FEATURE_ROWS: Array<{ key: keyof FeaturesDraft; label: string; hint: string }> = [
  { key: "newsletter", label: "Newsletter", hint: "Newsletter capture forms" },
  { key: "shareButtons", label: "Share buttons", hint: "Social share buttons on posts/products" },
  { key: "presenceBadge", label: "Presence badge", hint: "Live visitor counter" },
  { key: "cookieConsent", label: "Cookie consent", hint: "Cookie consent banner" },
  { key: "registration", label: "Registration", hint: "New account sign-ups" },
  { key: "trendingBadge", label: "Trending badges", hint: "Trending badges on posts" },
  { key: "viewCounts", label: "View counts", hint: "Public view counters" },
  { key: "readingTime", label: "Reading time", hint: "Reading time labels" },
  { key: "affiliateSlots", label: "Affiliate slots", hint: "Affiliate product ad slots" },
];

type SettingKey =
  | "brand"
  | "footer"
  | "media"
  | "ads"
  | "features"
  | "seo"
  | "contact"
  | "localization"
  | "analytics"
  | "maintenance";

export default function SettingsView() {
  const { isLoading, allowed } = useAdminGuard();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch<Record<string, JsonRecord>>("/api/settings/all"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const healthQuery = useQuery({
    queryKey: ["admin-health"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/health");
        const json = (await res.json()) as { ok: boolean; data?: { uptime?: number; time?: string } };
        return json.data ?? null;
      } catch {
        return null;
      }
    },
    enabled: allowed,
    refetchInterval: 30_000,
    retry: 0,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<StatsResponse>("/api/stats"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  /* drafts */
  const [brand, setBrand] = React.useState<BrandDraft | null>(null);
  const [footer, setFooter] = React.useState<FooterDraft | null>(null);
  const [media, setMedia] = React.useState<MediaDraft | null>(null);
  const [ads, setAds] = React.useState<AdsDraft | null>(null);
  const [features, setFeatures] = React.useState<FeaturesDraft | null>(null);
  const [seo, setSeo] = React.useState<SeoDraft | null>(null);
  const [contact, setContact] = React.useState<ContactDraft | null>(null);
  const [localization, setLocalization] = React.useState<LocalizationDraft | null>(null);
  const [analytics, setAnalytics] = React.useState<AnalyticsDraft | null>(null);
  const [maintenance, setMaintenance] = React.useState<MaintenanceDraft | null>(null);
  const [dirty, setDirty] = React.useState<Record<string, boolean>>({});
  const [maintenanceConfirm, setMaintenanceConfirm] = React.useState(false);
  const [newImage, setNewImage] = React.useState("");
  const [newGif, setNewGif] = React.useState("");
  const [newKeyword, setNewKeyword] = React.useState("");

  React.useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    const b = data.brand ?? {};
    const f = data.footer ?? {};
    const m = data.media ?? {};
    const a = data.ads ?? {};
    const ft = data.features ?? {};
    const se = data.seo ?? {};
    const ct = data.contact ?? {};
    const lz = data.localization ?? {};
    const an = data.analytics ?? {};
    const mt = data.maintenance ?? {};

    const hero = (m.heroMarquee ?? {}) as Record<string, unknown>;
    const stickers = (m.stickers ?? {}) as Record<string, unknown>;
    const gifBlock = (m.blogGifs ?? {}) as Record<string, unknown>;

    setBrand({
      siteName: asString(b.siteName),
      ownerName: asString(b.ownerName),
      roleLine: asString(b.roleLine),
      tagline: asString(b.tagline),
      email: asString(b.email),
      phone: asString(b.phone),
      whatsappUrl: asString(b.whatsappUrl),
      address: asString(b.address),
      cvUrl: asString(b.cvUrl),
      socials: Object.entries(asRecord(b.socials)).map(([key, url]) => ({ key, url })),
    });
    setFooter({
      tagline: asString(f.tagline),
      copyright: asString(f.copyright),
      socialsEnabled: asBool(f.socialsEnabled, true),
      columns: Array.isArray(f.columns)
        ? (f.columns as unknown[]).map((c) => {
            const col = (c ?? {}) as { title?: unknown; links?: unknown };
            return {
              title: asString(col.title, "Column"),
              links: Array.isArray(col.links)
                ? (col.links as unknown[]).map((l) => {
                    const link = (l ?? {}) as { label?: unknown; href?: unknown };
                    return { label: asString(link.label), href: asString(link.href) };
                  })
                : [],
            };
          })
        : [],
    });
    setMedia({
      heroEnabled: asBool(hero.enabled),
      heroImages: asStrArr(hero.images),
      stickersEnabled: asBool(stickers.enabled),
      stickerItems: Array.isArray(stickers.items)
        ? (stickers.items as unknown[]).map((s) => {
            const item = (s ?? {}) as { type?: unknown; value?: unknown; corner?: unknown };
            return {
              type: asString(item.type, "emoji"),
              value: asString(item.value),
              corner: asString(item.corner, "br"),
            };
          })
        : [],
      gifsEnabled: asBool(gifBlock.enabled),
      gifs: asStrArr(gifBlock.gifs),
    });
    setAds({ enabled: asBool(a.enabled, true), placements: asStrArr(a.placements) });
    setFeatures({
      newsletter: asBool(ft.newsletter, true),
      shareButtons: asBool(ft.shareButtons, true),
      presenceBadge: asBool(ft.presenceBadge, true),
      cookieConsent: asBool(ft.cookieConsent, true),
      registration: asBool(ft.registration, true),
      trendingBadge: asBool(ft.trendingBadge, true),
      viewCounts: asBool(ft.viewCounts, true),
      readingTime: asBool(ft.readingTime, true),
      affiliateSlots: asBool(ft.affiliateSlots, true),
    });
    setSeo({
      titleSuffix: asString(se.titleSuffix),
      defaultDescription: asString(se.defaultDescription),
      keywords: asStrArr(se.keywords),
      googleVerification: asString(se.googleVerification),
      bingVerification: asString(se.bingVerification),
    });
    setContact({
      email: asString(ct.email, "intobusyness@gmail.com"),
      phone: asString(ct.phone, "+91 98467 50898"),
      whatsappNumber: asString(ct.whatsappNumber, "+91 98467 50898"),
      whatsappUrl: asString(ct.whatsappUrl, "https://wa.me/919846750898"),
      address: asString(ct.address, "Calicut (Kozhikode), Kerala, India"),
      city: asString(ct.city, "Calicut"),
      responseTimeHours: asNumString(ct.responseTimeHours, 24),
      socials: Object.entries(asRecord(ct.socials)).map(([key, url]) => ({ key, url })),
    });
    setLocalization({
      currency: asString(lz.currency, "INR"),
      currencySymbol: asString(lz.currencySymbol, "₹"),
      timezone: asString(lz.timezone, "Asia/Calcutta"),
      dateFormat: asString(lz.dateFormat, "d MMM yyyy"),
      measurement: asString(lz.measurement, "metric"),
    });
    setAnalytics({
      enabled: asBool(an.enabled, false),
      googleAnalyticsId: asString(an.googleAnalyticsId),
      plausibleDomain: asString(an.plausibleDomain),
      trackOutboundClicks: asBool(an.trackOutboundClicks, true),
    });
    setMaintenance({
      enabled: asBool(mt.enabled),
      message: asString(mt.message),
      estimatedEnd: asString(mt.estimatedEnd),
    });
    setDirty({});
  }, [settingsQuery.data]);

  const touch = (key: string) => setDirty((d) => ({ ...d, [key]: true }));

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: SettingKey; value: Record<string, unknown> }) =>
      apiFetch(`/api/settings/${key}`, { method: "PATCH", body: JSON.stringify({ value }) }),
    onSuccess: (_data, variables) => {
      toast({
        title: "Settings saved",
        description: `${variables.key.charAt(0).toUpperCase() + variables.key.slice(1)} updated — the live site picked it up.`,
      });
      setDirty((d) => ({ ...d, [variables.key]: false }));
      // CRITICAL: the PUBLIC settings query the whole shell reads
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading settings" />;
  if (!allowed) return <ForbiddenState />;

  const buildBrandValue = (): Record<string, unknown> => ({
    siteName: brand?.siteName ?? "",
    ownerName: brand?.ownerName ?? "",
    roleLine: brand?.roleLine ?? "",
    tagline: brand?.tagline ?? "",
    email: brand?.email ?? "",
    phone: brand?.phone ?? "",
    whatsappUrl: brand?.whatsappUrl ?? "",
    address: brand?.address ?? "",
    cvUrl: brand?.cvUrl ?? "",
    socials: Object.fromEntries(
      (brand?.socials ?? [])
        .filter((s) => s.key.trim())
        .map((s) => [s.key.trim(), s.url.trim()])
    ),
  });

  const buildFooterValue = (): Record<string, unknown> => ({
    tagline: footer?.tagline ?? "",
    copyright: footer?.copyright ?? "",
    socialsEnabled: footer?.socialsEnabled ?? true,
    columns: (footer?.columns ?? []).map((c) => ({
      title: c.title,
      links: c.links.filter((l) => l.label.trim()),
    })),
  });

  const buildMediaValue = (): Record<string, unknown> => ({
    heroMarquee: { enabled: media?.heroEnabled ?? false, images: media?.heroImages ?? [] },
    stickers: { enabled: media?.stickersEnabled ?? false, items: media?.stickerItems ?? [] },
    blogGifs: { enabled: media?.gifsEnabled ?? false, gifs: media?.gifs ?? [] },
  });

  const buildAdsValue = (): Record<string, unknown> => ({
    enabled: ads?.enabled ?? true,
    placements: ads?.placements ?? [],
  });

  const buildFeaturesValue = (): Record<string, unknown> => ({
    newsletter: features?.newsletter ?? true,
    shareButtons: features?.shareButtons ?? true,
    presenceBadge: features?.presenceBadge ?? true,
    cookieConsent: features?.cookieConsent ?? true,
    registration: features?.registration ?? true,
    trendingBadge: features?.trendingBadge ?? true,
    viewCounts: features?.viewCounts ?? true,
    readingTime: features?.readingTime ?? true,
    affiliateSlots: features?.affiliateSlots ?? true,
  });

  const buildSeoValue = (): Record<string, unknown> => ({
    titleSuffix: seo?.titleSuffix ?? "",
    defaultDescription: seo?.defaultDescription ?? "",
    keywords: seo?.keywords ?? [],
    googleVerification: seo?.googleVerification ?? "",
    bingVerification: seo?.bingVerification ?? "",
  });

  const buildContactValue = (): Record<string, unknown> => {
    const rt = Number(contact?.responseTimeHours);
    return {
      email: contact?.email?.trim() ?? "",
      phone: contact?.phone?.trim() ?? "",
      whatsappNumber: contact?.whatsappNumber?.trim() ?? "",
      whatsappUrl: contact?.whatsappUrl?.trim() ?? "",
      address: contact?.address ?? "",
      city: contact?.city?.trim() ?? "",
      responseTimeHours: Number.isFinite(rt) ? Math.max(0, Math.min(168, Math.round(rt))) : 24,
      socials: Object.fromEntries(
        (contact?.socials ?? [])
          .filter((s) => s.key.trim())
          .map((s) => [s.key.trim(), s.url.trim()])
      ),
    };
  };

  const buildLocalizationValue = (): Record<string, unknown> => ({
    currency: localization?.currency ?? "INR",
    currencySymbol: localization?.currencySymbol?.trim() || "₹",
    timezone: localization?.timezone ?? "Asia/Calcutta",
    dateFormat: localization?.dateFormat ?? "d MMM yyyy",
    measurement: localization?.measurement ?? "metric",
  });

  const buildAnalyticsValue = (): Record<string, unknown> => ({
    enabled: analytics?.enabled ?? false,
    googleAnalyticsId: analytics?.googleAnalyticsId?.trim() ?? "",
    plausibleDomain: analytics?.plausibleDomain?.trim() ?? "",
    trackOutboundClicks: analytics?.trackOutboundClicks ?? true,
  });

  /** Auto-derived wa.me link shown as a hint under the WhatsApp number field. */
  const derivedWhatsappUrl = (() => {
    const digits = (contact?.whatsappNumber ?? "").replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  })();

  const buildMaintenanceValue = (): Record<string, unknown> => ({
    enabled: maintenance?.enabled ?? false,
    message: maintenance?.message ?? "",
    estimatedEnd: maintenance?.estimatedEnd?.trim() || null,
  });

  const saveTab = (key: SettingKey, value: Record<string, unknown>) =>
    saveMutation.mutate({ key, value });

  const SaveButton = ({ tab, build }: { tab: SettingKey; build: () => Record<string, unknown> }) => (
    <Button
      size="sm"
      className="h-9 gap-2"
      disabled={!dirty[tab] || saveMutation.isPending}
      onClick={() => saveTab(tab, build())}
    >
      <Save className="size-4" aria-hidden="true" />
      {saveMutation.isPending ? "Saving..." : dirty[tab] ? "Save changes" : "Saved"}
    </Button>
  );

  const dirtyChip = (tab: string) =>
    dirty[tab] ? (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Unsaved
      </Badge>
    ) : null;

  const addKeyword = () => {
    const kw = newKeyword.trim().slice(0, 40);
    if (!kw || !seo || seo.keywords.includes(kw) || seo.keywords.length >= 16) return;
    setSeo({ ...seo, keywords: [...seo.keywords, kw] });
    setNewKeyword("");
    touch("seo");
  };

  return (
    <AdminShell
      title="Settings"
      description="Total control — brand, footer, decor, ads, features, SEO, contact, locale, analytics and maintenance."
    >
      <SEOHead title="Settings — Admin & Developer | MN.KP" noindex />

      <DataState query={settingsQuery} skeletonRows={6} empty={false}>
        {() => (
          <Tabs defaultValue="brand" className="space-y-6">
            <TabsList className="scrollbar-slim h-11 w-full justify-start overflow-x-auto sm:w-auto sm:max-w-full">
              <TabsTrigger value="brand" className="h-9">Brand</TabsTrigger>
              <TabsTrigger value="footer" className="h-9">Footer</TabsTrigger>
              <TabsTrigger value="media" className="h-9">Media &amp; Decor</TabsTrigger>
              <TabsTrigger value="ads" className="h-9">Ads</TabsTrigger>
              <TabsTrigger value="features" className="h-9">Features</TabsTrigger>
              <TabsTrigger value="seo" className="h-9">SEO</TabsTrigger>
              <TabsTrigger value="contact" className="h-9">Contact &amp; Social</TabsTrigger>
              <TabsTrigger value="localization" className="h-9">Localization</TabsTrigger>
              <TabsTrigger value="analytics" className="h-9">Analytics</TabsTrigger>
              <TabsTrigger value="maintenance" className="h-9">Maintenance</TabsTrigger>
              <TabsTrigger value="system" className="h-9">System</TabsTrigger>
            </TabsList>

            {/* ------------------------- BRAND ------------------------- */}
            <TabsContent value="brand" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Brand identity</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("brand")}
                  <SaveButton tab="brand" build={buildBrandValue} />
                </div>
              </div>
              {brand ? (
                <Card>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="b-site">Site name</Label>
                      <Input id="b-site" value={brand.siteName} onChange={(e) => { setBrand({ ...brand, siteName: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-owner">Owner name</Label>
                      <Input id="b-owner" value={brand.ownerName} onChange={(e) => { setBrand({ ...brand, ownerName: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-role">Role line</Label>
                      <Input id="b-role" value={brand.roleLine} onChange={(e) => { setBrand({ ...brand, roleLine: e.target.value }); touch("brand"); }} placeholder="Freelancer · Businessman · AI-First Developer" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-email">Email</Label>
                      <Input id="b-email" type="email" value={brand.email} onChange={(e) => { setBrand({ ...brand, email: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-phone">Phone</Label>
                      <Input id="b-phone" value={brand.phone} onChange={(e) => { setBrand({ ...brand, phone: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-wa">WhatsApp URL</Label>
                      <Input id="b-wa" value={brand.whatsappUrl} onChange={(e) => { setBrand({ ...brand, whatsappUrl: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-address">Address</Label>
                      <Input id="b-address" value={brand.address} onChange={(e) => { setBrand({ ...brand, address: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="b-cv">CV URL</Label>
                      <Input id="b-cv" value={brand.cvUrl} onChange={(e) => { setBrand({ ...brand, cvUrl: e.target.value }); touch("brand"); }} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="b-tagline">Tagline</Label>
                      <Textarea id="b-tagline" value={brand.tagline} rows={2} onChange={(e) => { setBrand({ ...brand, tagline: e.target.value }); touch("brand"); }} />
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <Label>Social profiles</Label>
                      {brand.socials.map((row, i) => (
                        <div key={`social-${i}`} className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={row.key}
                            list="social-keys"
                            onChange={(e) => {
                              const next = [...brand.socials];
                              next[i] = { ...next[i], key: e.target.value };
                              setBrand({ ...brand, socials: next });
                              touch("brand");
                            }}
                            placeholder="Platform"
                            aria-label={`Social platform ${i + 1}`}
                            className="sm:max-w-[180px]"
                          />
                          <Input
                            value={row.url}
                            onChange={(e) => {
                              const next = [...brand.socials];
                              next[i] = { ...next[i], url: e.target.value };
                              setBrand({ ...brand, socials: next });
                              touch("brand");
                            }}
                            placeholder="https://..."
                            aria-label={`Social URL ${i + 1}`}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setBrand({ ...brand, socials: brand.socials.filter((_, idx) => idx !== i) });
                              touch("brand");
                            }}
                            aria-label={`Remove social ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <datalist id="social-keys">
                        {SOCIAL_KEYS.map((k) => (
                          <option key={k} value={k} />
                        ))}
                      </datalist>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => {
                          setBrand({ ...brand, socials: [...brand.socials, { key: "", url: "" }] });
                          touch("brand");
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add social profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- FOOTER ------------------------- */}
            <TabsContent value="footer" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Footer</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("footer")}
                  <SaveButton tab="footer" build={buildFooterValue} />
                </div>
              </div>
              {footer ? (
                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <Card>
                    <CardContent className="space-y-5 pt-6">
                      <div className="space-y-2">
                        <Label htmlFor="f-tagline">Tagline</Label>
                        <Textarea id="f-tagline" value={footer.tagline} rows={2} onChange={(e) => { setFooter({ ...footer, tagline: e.target.value }); touch("footer"); }} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="f-copyright">Copyright line</Label>
                        <Input id="f-copyright" value={footer.copyright} onChange={(e) => { setFooter({ ...footer, copyright: e.target.value }); touch("footer"); }} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Social icons row</p>
                          <p className="text-xs text-muted-foreground">Show the socials row under the columns</p>
                        </div>
                        <Switch
                          checked={footer.socialsEnabled}
                          onCheckedChange={(v) => { setFooter({ ...footer, socialsEnabled: v }); touch("footer"); }}
                          aria-label="Toggle socials row"
                        />
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <Label>Columns</Label>
                        {footer.columns.map((col, ci) => (
                          <div key={`col-${ci}`} className="space-y-2 rounded-lg border p-3">
                            <div className="flex gap-2">
                              <Input
                                value={col.title}
                                onChange={(e) => {
                                  const next = [...footer.columns];
                                  next[ci] = { ...col, title: e.target.value };
                                  setFooter({ ...footer, columns: next });
                                  touch("footer");
                                }}
                                placeholder="Column title"
                                aria-label={`Column ${ci + 1} title`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setFooter({ ...footer, columns: footer.columns.filter((_, idx) => idx !== ci) });
                                  touch("footer");
                                }}
                                aria-label={`Remove column ${ci + 1}`}
                              >
                                <X className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                            {col.links.map((link, li) => (
                              <div key={`link-${ci}-${li}`} className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                  value={link.label}
                                  onChange={(e) => {
                                    const next = [...footer.columns];
                                    next[ci] = {
                                      ...col,
                                      links: col.links.map((l, idx) =>
                                        idx === li ? { ...l, label: e.target.value } : l
                                      ),
                                    };
                                    setFooter({ ...footer, columns: next });
                                    touch("footer");
                                  }}
                                  placeholder="Label"
                                  aria-label={`Column ${ci + 1} link ${li + 1} label`}
                                  className="sm:max-w-[200px]"
                                />
                                <Input
                                  value={link.href}
                                  onChange={(e) => {
                                    const next = [...footer.columns];
                                    next[ci] = {
                                      ...col,
                                      links: col.links.map((l, idx) =>
                                        idx === li ? { ...l, href: e.target.value } : l
                                      ),
                                    };
                                    setFooter({ ...footer, columns: next });
                                    touch("footer");
                                  }}
                                  placeholder="#/blog or https://..."
                                  aria-label={`Column ${ci + 1} link ${li + 1} URL`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    const next = [...footer.columns];
                                    next[ci] = { ...col, links: col.links.filter((_, idx) => idx !== li) };
                                    setFooter({ ...footer, columns: next });
                                    touch("footer");
                                  }}
                                  aria-label={`Remove link ${li + 1}`}
                                >
                                  <X className="size-4" aria-hidden="true" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                const next = [...footer.columns];
                                next[ci] = { ...col, links: [...col.links, { label: "", href: "" }] };
                                setFooter({ ...footer, columns: next });
                                touch("footer");
                              }}
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              Add link
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2"
                          onClick={() => {
                            setFooter({ ...footer, columns: [...footer.columns, { title: "", links: [] }] });
                            touch("footer");
                          }}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                          Add column
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* live footer preview */}
                  <Card className="h-fit bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Live preview</CardTitle>
                      <CardDescription>Rough render of the saved footer</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div>
                        <p className="font-semibold">MN.KP</p>
                        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                          {footer.tagline || "Tagline goes here..."}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {footer.columns.map((col, i) => (
                          <div key={`preview-col-${i}`}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {col.title || "Untitled"}
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {col.links.map((l, li) => (
                                <li key={`preview-link-${li}`} className="truncate text-xs text-foreground/70">
                                  {l.label || "Link"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      {footer.socialsEnabled ? (
                        <p className="text-xs text-muted-foreground">+ social icons row</p>
                      ) : null}
                      <Separator />
                      <p className="text-[11px] text-muted-foreground">
                        {footer.copyright || "Copyright line"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            {/* ------------------------- MEDIA & DECOR ------------------------- */}
            <TabsContent value="media" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Media &amp; decor</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("media")}
                  <SaveButton tab="media" build={buildMediaValue} />
                </div>
              </div>
              {media ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* hero marquee */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Hero marquee</CardTitle>
                        <Switch
                          checked={media.heroEnabled}
                          onCheckedChange={(v) => { setMedia({ ...media, heroEnabled: v }); touch("media"); }}
                          aria-label="Toggle hero marquee"
                        />
                      </div>
                      <CardDescription>Image strip on the home hero</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {media.heroImages.map((img, i) => (
                        <div key={`hero-${i}`} className="flex items-center gap-2">
                          <img src={img} alt="" loading="lazy" decoding="async" className="size-10 shrink-0 rounded-md border object-cover" />
                          <Input
                            value={img}
                            onChange={(e) => {
                              const next = [...media.heroImages];
                              next[i] = e.target.value;
                              setMedia({ ...media, heroImages: next });
                              touch("media");
                            }}
                            aria-label={`Marquee image ${i + 1}`}
                            className="flex-1 font-mono text-xs"
                          />
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9"
                              disabled={i === 0}
                              onClick={() => {
                                const next = [...media.heroImages];
                                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                setMedia({ ...media, heroImages: next });
                                touch("media");
                              }}
                              aria-label={`Move image ${i + 1} up`}
                            >
                              <ArrowUp className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9"
                              disabled={i === media.heroImages.length - 1}
                              onClick={() => {
                                const next = [...media.heroImages];
                                [next[i + 1], next[i]] = [next[i], next[i + 1]];
                                setMedia({ ...media, heroImages: next });
                                touch("media");
                              }}
                              aria-label={`Move image ${i + 1} down`}
                            >
                              <ArrowDown className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setMedia({ ...media, heroImages: media.heroImages.filter((_, idx) => idx !== i) });
                                touch("media");
                              }}
                              aria-label={`Remove image ${i + 1}`}
                            >
                              <X className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          value={newImage}
                          onChange={(e) => setNewImage(e.target.value)}
                          placeholder="/images/blog/... (add image URL)"
                          aria-label="New marquee image URL"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          onClick={() => {
                            const url = newImage.trim();
                            if (!url || media.heroImages.includes(url)) return;
                            setMedia({ ...media, heroImages: [...media.heroImages, url] });
                            setNewImage("");
                            touch("media");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* stickers */}
                  <Card className="border-gold/40">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="size-4 text-gold" aria-hidden="true" />
                          Corner stickers
                        </CardTitle>
                        <Switch
                          checked={media.stickersEnabled}
                          onCheckedChange={(v) => { setMedia({ ...media, stickersEnabled: v }); touch("media"); }}
                          aria-label="Toggle corner stickers"
                        />
                      </div>
                      <CardDescription>
                        Floating decor on every page — emoji characters or image/GIF URLs
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {media.stickerItems.map((st, i) => (
                        <div key={`sticker-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                          <span className="flex size-10 items-center justify-center rounded-md bg-muted text-2xl leading-none">
                            {st.value.startsWith("http") || st.value.startsWith("/") ? (
                              <img src={st.value} alt="" className="h-8 w-auto" />
                            ) : (
                              st.value || "?"
                            )}
                          </span>
                          <Input
                            value={st.value}
                            onChange={(e) => {
                              const next = [...media.stickerItems];
                              next[i] = { ...st, value: e.target.value, type: e.target.value.startsWith("http") || e.target.value.startsWith("/") ? "image" : "emoji" };
                              setMedia({ ...media, stickerItems: next });
                              touch("media");
                            }}
                            placeholder="Emoji or image URL"
                            aria-label={`Sticker ${i + 1} value`}
                            className="h-9 min-w-0 flex-1 font-mono text-xs"
                          />
                          <Select
                            value={st.corner}
                            onValueChange={(v) => {
                              const next = [...media.stickerItems];
                              next[i] = { ...st, corner: v };
                              setMedia({ ...media, stickerItems: next });
                              touch("media");
                            }}
                          >
                            <SelectTrigger className="h-9 w-[90px] text-xs" aria-label={`Sticker ${i + 1} corner`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tl">top-left</SelectItem>
                              <SelectItem value="tr">top-right</SelectItem>
                              <SelectItem value="bl">bottom-left</SelectItem>
                              <SelectItem value="br">bottom-right</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setMedia({ ...media, stickerItems: media.stickerItems.filter((_, idx) => idx !== i) });
                              touch("media");
                            }}
                            aria-label={`Remove sticker ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs text-muted-foreground">Quick emoji:</span>
                        {STICKER_PALETTE.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setMedia({ ...media, stickerItems: [...media.stickerItems, { type: "emoji", value: emoji, corner: "br" }] });
                              touch("media");
                            }}
                            aria-label={`Add ${emoji} sticker`}
                            className="flex size-9 items-center justify-center rounded-md border bg-muted/50 text-xl transition-transform hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => {
                          setMedia({ ...media, stickerItems: [...media.stickerItems, { type: "emoji", value: "", corner: "br" }] });
                          touch("media");
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add sticker
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Corners sit clear of the header and mobile tab bar; staff see them on the live site too.
                      </p>
                    </CardContent>
                  </Card>

                  {/* blog gifs */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Blog GIFs</CardTitle>
                        <Switch
                          checked={media.gifsEnabled}
                          onCheckedChange={(v) => { setMedia({ ...media, gifsEnabled: v }); touch("media"); }}
                          aria-label="Toggle blog gifs"
                        />
                      </div>
                      <CardDescription>Animated accents dropped into blog articles</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {media.gifs.map((gif, i) => (
                        <div key={`gif-${i}`} className="flex items-center gap-2">
                          <img src={gif} alt="" loading="lazy" decoding="async" className="h-10 w-auto shrink-0 rounded-md border" />
                          <Input
                            value={gif}
                            onChange={(e) => {
                              const next = [...media.gifs];
                              next[i] = e.target.value;
                              setMedia({ ...media, gifs: next });
                              touch("media");
                            }}
                            aria-label={`GIF ${i + 1} URL`}
                            className="flex-1 font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setMedia({ ...media, gifs: media.gifs.filter((_, idx) => idx !== i) });
                              touch("media");
                            }}
                            aria-label={`Remove GIF ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          value={newGif}
                          onChange={(e) => setNewGif(e.target.value)}
                          placeholder="https://...gif (add GIF URL)"
                          aria-label="New GIF URL"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          onClick={() => {
                            const url = newGif.trim();
                            if (!url || media.gifs.includes(url)) return;
                            setMedia({ ...media, gifs: [...media.gifs, url] });
                            setNewGif("");
                            touch("media");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            {/* ------------------------- ADS ------------------------- */}
            <TabsContent value="ads" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Affiliate ads</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("ads")}
                  <SaveButton tab="ads" build={buildAdsValue} />
                </div>
              </div>
              {ads ? (
                <Card>
                  <CardContent className="space-y-5 pt-6">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Sponsored ad slots</p>
                        <p className="text-xs text-muted-foreground">
                          Featured products rotate through enabled placements (gold dashed cards)
                        </p>
                      </div>
                      <Switch
                        checked={ads.enabled}
                        onCheckedChange={(v) => { setAds({ ...ads, enabled: v }); touch("ads"); }}
                        aria-label="Toggle affiliate ads"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {AD_PLACEMENTS.map((p) => (
                        <label
                          key={p.value}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
                            ads.placements.includes(p.value) && "border-gold/40 bg-gold/[0.04]"
                          )}
                        >
                          <Checkbox
                            checked={ads.placements.includes(p.value)}
                            onCheckedChange={(checked) => {
                              setAds({
                                ...ads,
                                placements: checked
                                  ? [...ads.placements, p.value]
                                  : ads.placements.filter((x) => x !== p.value),
                              });
                              touch("ads");
                            }}
                            aria-label={`Enable ${p.label} placement`}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      At least one placement stays enabled — the resolver falls back to all four when the list is empty.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- FEATURES ------------------------- */}
            <TabsContent value="features" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Features</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("features")}
                  <SaveButton tab="features" build={buildFeaturesValue} />
                </div>
              </div>
              {features ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Feature switches</CardTitle>
                    <CardDescription>Switch any part of the site on or off.</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y">
                    {FEATURE_ROWS.map((row) => (
                      <div
                        key={row.key}
                        className="flex min-h-11 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">{row.hint}</p>
                        </div>
                        <Switch
                          checked={features[row.key]}
                          onCheckedChange={(v) => {
                            setFeatures({ ...features, [row.key]: v });
                            touch("features");
                          }}
                          aria-label={`Toggle ${row.label}`}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- SEO ------------------------- */}
            <TabsContent value="seo" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">SEO defaults</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("seo")}
                  <SaveButton tab="seo" build={buildSeoValue} />
                </div>
              </div>
              {seo ? (
                <Card>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="s-suffix">Title suffix</Label>
                      <Input
                        id="s-suffix"
                        value={seo.titleSuffix}
                        onChange={(e) => { setSeo({ ...seo, titleSuffix: e.target.value }); touch("seo"); }}
                        placeholder=" | MN.KP"
                      />
                      <p className="text-xs text-muted-foreground">Appended to every page title</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s-desc">Default description ({seo.defaultDescription.length}/180)</Label>
                      <Textarea
                        id="s-desc"
                        value={seo.defaultDescription}
                        rows={3}
                        maxLength={180}
                        onChange={(e) => { setSeo({ ...seo, defaultDescription: e.target.value }); touch("seo"); }}
                        placeholder="Portfolio, blog and affiliate store of Mohammed Nihad KP..."
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="s-keyword">Keywords</Label>
                      <div className="flex gap-2">
                        <Input
                          id="s-keyword"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              addKeyword();
                            }
                          }}
                          placeholder="Type a keyword, press Enter (max 16)"
                          aria-label="Add keyword"
                          className="h-10"
                        />
                        <Button type="button" variant="outline" className="h-10" onClick={addKeyword}>
                          Add
                        </Button>
                      </div>
                      {seo.keywords.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {seo.keywords.map((kw) => (
                            <Badge key={kw} variant="secondary" className="gap-1 pr-1.5">
                              {kw}
                              <button
                                type="button"
                                onClick={() => {
                                  setSeo({ ...seo, keywords: seo.keywords.filter((k) => k !== kw) });
                                  touch("seo");
                                }}
                                aria-label={`Remove keyword ${kw}`}
                                className="flex size-5 items-center justify-center rounded-full hover:bg-muted"
                              >
                                <X className="size-3" aria-hidden="true" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          No keywords yet — they feed the default meta keywords tag.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="s-google">Google verification</Label>
                      <Input
                        id="s-google"
                        value={seo.googleVerification}
                        onChange={(e) => { setSeo({ ...seo, googleVerification: e.target.value }); touch("seo"); }}
                        placeholder="google-site-verification token"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Search console verification token — leave empty if unused
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s-bing">Bing verification</Label>
                      <Input
                        id="s-bing"
                        value={seo.bingVerification}
                        onChange={(e) => { setSeo({ ...seo, bingVerification: e.target.value }); touch("seo"); }}
                        placeholder="msvalidate.01 token"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Search console verification token — leave empty if unused
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- CONTACT & SOCIAL ------------------------- */}
            <TabsContent value="contact" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Contact &amp; social</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("contact")}
                  <SaveButton tab="contact" build={buildContactValue} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Defaults mirror the live MN.KP contact details — every field lists its default in the hint below it.
              </p>
              {contact ? (
                <Card>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="c-email">Email</Label>
                      <Input
                        id="c-email"
                        type="email"
                        value={contact.email}
                        onChange={(e) => { setContact({ ...contact, email: e.target.value }); touch("contact"); }}
                        placeholder="intobusyness@gmail.com"
                      />
                      <p className="text-xs text-muted-foreground">Default: intobusyness@gmail.com</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-phone">Phone</Label>
                      <Input
                        id="c-phone"
                        value={contact.phone}
                        onChange={(e) => { setContact({ ...contact, phone: e.target.value }); touch("contact"); }}
                        placeholder="+91 98467 50898"
                      />
                      <p className="text-xs text-muted-foreground">Default: +91 98467 50898</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-wanum">WhatsApp number</Label>
                      <Input
                        id="c-wanum"
                        value={contact.whatsappNumber}
                        onChange={(e) => { setContact({ ...contact, whatsappNumber: e.target.value }); touch("contact"); }}
                        placeholder="+91 98467 50898"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: +91 98467 50898 · auto-link:{" "}
                        <span className="font-mono">{derivedWhatsappUrl || "—"}</span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-waurl">WhatsApp URL</Label>
                      <Input
                        id="c-waurl"
                        value={contact.whatsappUrl}
                        onChange={(e) => { setContact({ ...contact, whatsappUrl: e.target.value }); touch("contact"); }}
                        placeholder="https://wa.me/919846750898"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to auto-build from the WhatsApp number — Default: https://wa.me/919846750898
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-address">Address</Label>
                      <Input
                        id="c-address"
                        value={contact.address}
                        onChange={(e) => { setContact({ ...contact, address: e.target.value }); touch("contact"); }}
                        placeholder="Calicut (Kozhikode), Kerala, India"
                      />
                      <p className="text-xs text-muted-foreground">Default: Calicut (Kozhikode), Kerala, India</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-city">City</Label>
                      <Input
                        id="c-city"
                        value={contact.city}
                        onChange={(e) => { setContact({ ...contact, city: e.target.value }); touch("contact"); }}
                        placeholder="Calicut"
                      />
                      <p className="text-xs text-muted-foreground">Default: Calicut</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-rt">Response time (hours)</Label>
                      <Input
                        id="c-rt"
                        type="number"
                        min={0}
                        max={168}
                        value={contact.responseTimeHours}
                        onChange={(e) => { setContact({ ...contact, responseTimeHours: e.target.value }); touch("contact"); }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Shown as “replies within X hours” on contact pages — Default: 24
                      </p>
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <Label>Contact social links</Label>
                      {contact.socials.map((row, i) => (
                        <div key={`c-social-${i}`} className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={row.key}
                            list="contact-social-keys"
                            onChange={(e) => {
                              const next = [...contact.socials];
                              next[i] = { ...next[i], key: e.target.value };
                              setContact({ ...contact, socials: next });
                              touch("contact");
                            }}
                            placeholder="Platform"
                            aria-label={`Contact social platform ${i + 1}`}
                            className="sm:max-w-[180px]"
                          />
                          <Input
                            value={row.url}
                            onChange={(e) => {
                              const next = [...contact.socials];
                              next[i] = { ...next[i], url: e.target.value };
                              setContact({ ...contact, socials: next });
                              touch("contact");
                            }}
                            placeholder="https://..."
                            aria-label={`Contact social URL ${i + 1}`}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setContact({ ...contact, socials: contact.socials.filter((_, idx) => idx !== i) });
                              touch("contact");
                            }}
                            aria-label={`Remove contact social ${i + 1}`}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <datalist id="contact-social-keys">
                        {CONTACT_SOCIAL_KEYS.map((k) => (
                          <option key={k} value={k} />
                        ))}
                      </datalist>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2"
                          disabled={contact.socials.length >= 8}
                          onClick={() => {
                            setContact({ ...contact, socials: [...contact.socials, { key: "", url: "" }] });
                            touch("contact");
                          }}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                          Add social link
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Empty by default — Brand owns the canonical socials; add up to 8 contact-page links
                          (Instagram, YouTube, LinkedIn, GitHub, X…).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- LOCALIZATION ------------------------- */}
            <TabsContent value="localization" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Localization</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("localization")}
                  <SaveButton tab="localization" build={buildLocalizationValue} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Default mode: India-first — ₹ INR · Asia/Calcutta (IST) · d MMM yyyy · metric.
              </p>
              {localization ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="size-4 text-primary" aria-hidden="true" />
                      Locale &amp; formats
                    </CardTitle>
                    <CardDescription>Applied to prices, dates and measurements across the site</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="l-currency">Currency</Label>
                      <Select
                        value={localization.currency}
                        onValueChange={(v) => { setLocalization({ ...localization, currency: v }); touch("localization"); }}
                      >
                        <SelectTrigger id="l-currency" className="w-full" aria-label="Currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                          {localization.currency && !CURRENCIES.some((c) => c.value === localization.currency) ? (
                            <SelectItem value={localization.currency}>{localization.currency}</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Default: INR — Indian Rupee</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="l-symbol">Currency symbol</Label>
                      <Input
                        id="l-symbol"
                        value={localization.currencySymbol}
                        onChange={(e) => { setLocalization({ ...localization, currencySymbol: e.target.value }); touch("localization"); }}
                        placeholder="₹"
                        className="max-w-[120px]"
                      />
                      <p className="text-xs text-muted-foreground">Prepended to prices — Default: ₹</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="l-tz">Timezone</Label>
                      <Select
                        value={localization.timezone}
                        onValueChange={(v) => { setLocalization({ ...localization, timezone: v }); touch("localization"); }}
                      >
                        <SelectTrigger id="l-tz" className="w-full" aria-label="Timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                          {localization.timezone && !TIMEZONES.some((t) => t.value === localization.timezone) ? (
                            <SelectItem value={localization.timezone}>{localization.timezone}</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Default: Asia/Calcutta (IST)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="l-date">Date format</Label>
                      <Select
                        value={localization.dateFormat}
                        onValueChange={(v) => { setLocalization({ ...localization, dateFormat: v }); touch("localization"); }}
                      >
                        <SelectTrigger id="l-date" className="w-full" aria-label="Date format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_FORMAT_OPTIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Default: d MMM yyyy (5 Mar 2026)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="l-measure">Measurement units</Label>
                      <Select
                        value={localization.measurement}
                        onValueChange={(v) => { setLocalization({ ...localization, measurement: v }); touch("localization"); }}
                      >
                        <SelectTrigger id="l-measure" className="w-full" aria-label="Measurement units">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEASUREMENT_OPTIONS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Default: metric (km / kg / °C)</p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- ANALYTICS ------------------------- */}
            <TabsContent value="analytics" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Analytics</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("analytics")}
                  <SaveButton tab="analytics" build={buildAnalyticsValue} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Default mode: privacy-first — tracking stays OFF until you opt in.
              </p>
              {analytics ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="size-4 text-primary" aria-hidden="true" />
                      Tracking integrations
                    </CardTitle>
                    <CardDescription>Google Analytics and/or Plausible — off by default</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <ShieldCheck className="size-4 text-gold" aria-hidden="true" />
                          Analytics enabled
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Privacy-first: tracking stays off until you enable it — Default: OFF
                        </p>
                      </div>
                      <Switch
                        checked={analytics.enabled}
                        onCheckedChange={(v) => { setAnalytics({ ...analytics, enabled: v }); touch("analytics"); }}
                        aria-label="Toggle analytics"
                      />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="a-ga">Google Analytics ID</Label>
                        <Input
                          id="a-ga"
                          value={analytics.googleAnalyticsId}
                          onChange={(e) => { setAnalytics({ ...analytics, googleAnalyticsId: e.target.value }); touch("analytics"); }}
                          placeholder="G-XXXXXXXXXX"
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">Leave empty = disabled — Default: empty</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="a-plausible">Plausible domain</Label>
                        <Input
                          id="a-plausible"
                          value={analytics.plausibleDomain}
                          onChange={(e) => { setAnalytics({ ...analytics, plausibleDomain: e.target.value }); touch("analytics"); }}
                          placeholder="mohdnihadkp.com"
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">Leave empty = disabled — Default: empty</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Track outbound clicks</p>
                        <p className="text-xs text-muted-foreground">
                          Count clicks on external / affiliate links — only fires while analytics is enabled — Default: ON
                        </p>
                      </div>
                      <Switch
                        checked={analytics.trackOutboundClicks}
                        onCheckedChange={(v) => { setAnalytics({ ...analytics, trackOutboundClicks: v }); touch("analytics"); }}
                        aria-label="Toggle outbound click tracking"
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* ------------------------- MAINTENANCE ------------------------- */}
            <TabsContent value="maintenance" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Maintenance mode</h2>
                <div className="flex items-center gap-2">
                  {dirtyChip("maintenance")}
                  <SaveButton tab="maintenance" build={buildMaintenanceValue} />
                </div>
              </div>
              {maintenance ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className={maintenance.enabled ? "border-amber-500/50" : undefined}>
                    <CardContent className="space-y-5 pt-6">
                      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <Wrench className="size-4 text-amber-500" aria-hidden="true" />
                            Maintenance mode
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Guests see the maintenance page; staff bypass with a gold banner
                          </p>
                        </div>
                        <Switch
                          checked={maintenance.enabled}
                          onCheckedChange={(v) => {
                            if (v) setMaintenanceConfirm(true);
                            else {
                              setMaintenance({ ...maintenance, enabled: false });
                              touch("maintenance");
                            }
                          }}
                          aria-label="Toggle maintenance mode"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-message">Message</Label>
                        <Textarea
                          id="m-message"
                          value={maintenance.message}
                          rows={3}
                          onChange={(e) => { setMaintenance({ ...maintenance, message: e.target.value }); touch("maintenance"); }}
                          placeholder="We are performing scheduled maintenance. Back shortly."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-end">Estimated end (shown as a chip)</Label>
                        <Input
                          id="m-end"
                          value={maintenance.estimatedEnd}
                          onChange={(e) => { setMaintenance({ ...maintenance, estimatedEnd: e.target.value }); touch("maintenance"); }}
                          placeholder="e.g. 11:30 PM IST tonight"
                        />
                      </div>
                      <p className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/[0.04] p-3 text-xs text-muted-foreground">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                        Staff bypass: signed-in editors and admins keep full access while maintenance is on —
                        you can browse and test safely before flipping it off.
                      </p>
                    </CardContent>
                  </Card>

                  {/* preview */}
                  <Card className="h-fit bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Guest preview</CardTitle>
                      <CardDescription>What visitors will see</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-6 text-center">
                        <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
                          <Wrench className="size-6 text-amber-500" aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                          MAINTENANCE
                        </p>
                        <p className="mt-2 text-lg font-semibold">MN.KP is being polished</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {maintenance.message || "We are performing scheduled maintenance. Back shortly."}
                        </p>
                        {maintenance.estimatedEnd ? (
                          <p className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
                            Estimated back by {maintenance.estimatedEnd}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            {/* ------------------------- SYSTEM ------------------------- */}
            <TabsContent value="system" className="space-y-4">
              <h2 className="text-base font-semibold">System</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="size-4 text-primary" aria-hidden="true" />
                      Service health
                    </CardTitle>
                    <CardDescription>GET /api/health · refreshes 30s</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="flex size-2 rounded-full bg-primary" aria-hidden="true" />
                      API responding
                      {healthQuery.isPending ? " (checking...)" : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Uptime: {healthQuery.data ? formatUptime(healthQuery.data.uptime ?? 0) : "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Server time: {healthQuery.data?.time ? new Date(healthQuery.data.time).toLocaleString() : "—"}
                    </p>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground">
                      Sandbox: Next.js dev server + Prisma SQLite (db/custom.db). Production target: Neon/Supabase
                      Postgres + Supabase Auth/Realtime.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Content counts</CardTitle>
                    <CardDescription>GET /api/stats snapshot</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsQuery.data ? (
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Users</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalUsers}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Posts</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalPosts}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Products</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalProducts}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Inquiries</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.totalInquiries}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Subscribers</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.subscribers}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Confirmed</dt>
                          <dd className="font-semibold tabular-nums">{statsQuery.data.kpis.confirmedSubscribers}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">Loading stats...</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DataState>

      {/* maintenance-enable confirm */}
      <AlertDialog open={maintenanceConfirm} onOpenChange={setMaintenanceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn maintenance mode ON?</AlertDialogTitle>
            <AlertDialogDescription>
              The public site will show the maintenance page for all guests until you switch it back
              off. You (staff) keep full access with a gold banner. Remember to press Save on the
              Maintenance tab to apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (maintenance) {
                  setMaintenance({ ...maintenance, enabled: true });
                  touch("maintenance");
                }
              }}
            >
              <Check className="mr-1 size-4" aria-hidden="true" />
              Yes, enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
