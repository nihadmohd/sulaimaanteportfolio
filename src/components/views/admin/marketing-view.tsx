"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Megaphone,
  MousePointerClick,
  Rss,
  Search,
  Settings,
  Target,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ALink } from "@/components/router/link";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { navigate } from "@/hooks/use-router";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import type { AdDTO, AdPlacement, AdStatsDTO, SeoSettings, StatsResponse } from "@/types";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, formatCompact, KpiCard, useAdminGuard } from "./_shared";

/**
 * Marketing Hub (#/admin/marketing — route key "admin-marketing").
 * Professional growth console — recharts stays out of this bundle entirely
 * (proportional copper bars only).
 *
 * · KPIs:           /api/ads?all=1&stats=1 + /api/stats
 * · UTM builder:    pure client-side (no network)
 * · Funnel:         stats kpis (views → clicks → CTR + top products)
 * · Top content:    stats series viewsByPost
 * · Ad performance: /api/ads?all=1&stats=1 items (top 6 by clicks)
 * · SEO health:     useSettings → PublicSettings.seo group
 */

interface AdsAllResponse {
  items: AdDTO[];
  stats?: AdStatsDTO;
}

const PLACEMENT_LABEL: Record<AdPlacement, string> = {
  "header-banner": "Header banner",
  "blog-inline": "Blog inline",
  "blog-sidebar": "Blog sidebar",
  "between-cards": "Between cards",
  "home-strip": "Home strip",
  "hero-marquee": "Hero marquee",
  "store-side": "Store side",
  "footer-banner": "Footer banner",
  "product-inline": "Product inline",
  marquee: "Marquee",
  sticker: "Sticker",
};

function ctrOf(clicks: number, impressions: number): string {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

/* ------------------------------------------------------------------ */
/* UTM campaign builder (star feature — pure client-side)              */
/* ------------------------------------------------------------------ */

const DEFAULT_BASE_URL = "https://mohdnihadkp.vercel.app";

type UtmValues = Record<"source" | "medium" | "campaign" | "term" | "content", string>;

const UTM_FIELDS: Array<{
  id: keyof UtmValues;
  label: string;
  placeholder: string;
  required?: boolean;
}> = [
  { id: "source", label: "Campaign source", placeholder: "whatsapp", required: true },
  { id: "medium", label: "Campaign medium", placeholder: "social" },
  { id: "campaign", label: "Campaign name", placeholder: "venture-launch", required: true },
  { id: "term", label: "Campaign term", placeholder: "optional — paid keyword" },
  { id: "content", label: "Campaign content", placeholder: "optional — variant / link text" },
];

/** Clipboard write with a legacy execCommand fallback (non-secure contexts). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function UtmBuilder() {
  const [baseUrl, setBaseUrl] = React.useState(DEFAULT_BASE_URL);
  const [values, setValues] = React.useState<UtmValues>({
    source: "",
    medium: "",
    campaign: "",
    term: "",
    content: "",
  });
  const [copied, setCopied] = React.useState(false);

  const campaignUrl = React.useMemo(() => {
    const raw = baseUrl.trim();
    if (!raw) return "";
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return "";
    }
    const entries: Array<[string, string]> = [
      ["utm_source", values.source.trim()],
      ["utm_medium", values.medium.trim()],
      ["utm_campaign", values.campaign.trim()],
      ["utm_term", values.term.trim()],
      ["utm_content", values.content.trim()],
    ];
    for (const [key, value] of entries) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  }, [baseUrl, values]);

  const trimmedBase = baseUrl.trim();
  const paramCount = (["source", "medium", "campaign", "term", "content"] as const).filter(
    (key) => values[key].trim()
  ).length;
  const missingRequired = !values.source.trim() || !values.campaign.trim();

  const hint: { tone: "warn" | "ok"; text: string } = !trimmedBase || !campaignUrl
    ? { tone: "warn", text: "Enter a valid base URL (e.g. https://mohdnihadkp.vercel.app) to build on." }
    : missingRequired
      ? { tone: "warn", text: "Add a campaign source and campaign name to complete the tag." }
      : {
          tone: "ok",
          text: `${paramCount} UTM parameter${paramCount === 1 ? "" : "s"} tagged — ready to share.`,
        };

  const onCopy = async () => {
    if (!campaignUrl) return;
    const ok = await copyText(campaignUrl);
    if (ok) {
      setCopied(true);
      toast({
        title: "Campaign URL copied",
        description: "Paste it straight into your campaign post or bio link.",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast({
        title: "Could not copy",
        description: "Select the URL field and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const onOpen = () => {
    if (campaignUrl) window.open(campaignUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="min-w-0 py-4 md:py-6">
      <CardHeader className="px-4 pb-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-gold" aria-hidden="true" />
          UTM campaign builder
        </CardTitle>
        <CardDescription>
          Tag any link with UTM parameters before sharing it — analytics-ready in one paste.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-0 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-3">
            <Label htmlFor="utm-base" className="text-xs">
              Base URL
            </Label>
            <Input
              id="utm-base"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              inputMode="url"
              className="h-9"
            />
          </div>
          {UTM_FIELDS.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`utm-${field.id}`} className="text-xs">
                {field.label}
                {field.required ? (
                  <>
                    <span className="ml-0.5 text-gold" aria-hidden="true">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </>
                ) : null}
              </Label>
              <Input
                id={`utm-${field.id}`}
                value={values[field.id]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.id]: e.target.value }) as UtmValues)
                }
                placeholder={field.placeholder}
                className="h-9"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Generated campaign URL
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              readOnly
              value={campaignUrl}
              placeholder="https://…"
              aria-label="Generated campaign URL"
              className="h-9 min-w-0 flex-1 font-mono text-xs"
            />
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={onCopy}
                disabled={!campaignUrl}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" className="h-9 gap-1.5" onClick={onOpen} disabled={!campaignUrl}>
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open
              </Button>
            </div>
          </div>
          <p
            className={cn(
              "mt-2 flex items-center gap-1.5 text-xs",
              hint.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            {hint.tone === "warn" ? (
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Check
                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            )}
            {hint.text}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* SEO health checklist                                                */
/* ------------------------------------------------------------------ */

function SeoHealthCard({ seo, loading }: { seo?: SeoSettings; loading: boolean }) {
  const checks: Array<{ label: string; detail: string; passing: boolean }> = seo
    ? [
        {
          label: "Title suffix",
          detail: seo.titleSuffix.trim() ? `“${seo.titleSuffix.trim()}”` : "Not set",
          passing: seo.titleSuffix.trim().length > 0,
        },
        {
          label: "Meta description (70+ chars)",
          detail: `${seo.defaultDescription.trim().length} chars`,
          passing: seo.defaultDescription.trim().length >= 70,
        },
        {
          label: "Target keywords (3+)",
          detail: `${seo.keywords.length} keywords`,
          passing: seo.keywords.length >= 3,
        },
        {
          label: "Google Search Console",
          detail: seo.googleVerification.trim() ? "Verified" : "Not set",
          passing: seo.googleVerification.trim().length > 0,
        },
        {
          label: "Bing Webmaster",
          detail: seo.bingVerification.trim() ? "Verified" : "Not set",
          passing: seo.bingVerification.trim().length > 0,
        },
      ]
    : [];
  const passing = checks.filter((c) => c.passing).length;

  return (
    <Card className="min-w-0 py-4 md:py-6">
      <CardHeader className="px-4 pb-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4 text-gold" aria-hidden="true" />
          SEO health
        </CardTitle>
        <CardDescription>
          {loading ? "Checking SEO defaults…" : seo ? `${passing} / 5 checks passing` : "SEO settings unavailable"}
        </CardDescription>
        <CardAction>
          <ALink href="/admin/settings">
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Settings className="size-3.5" aria-hidden="true" />
              Open SEO settings
            </Button>
          </ALink>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4 pt-0 md:px-6">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : !seo ? (
          <p className="text-sm text-muted-foreground">
            Could not read SEO settings just now — open the SEO settings tab to review them directly.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {checks.map((check) => (
                <li
                  key={check.label}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md",
                      check.passing
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {check.passing ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{check.label}</p>
                  <p
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      check.passing ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {check.detail}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-1" aria-hidden="true">
              {checks.map((check) => (
                <div
                  key={check.label}
                  className={cn("h-1 flex-1 rounded-full", check.passing ? "bg-gold" : "bg-muted")}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function MarketingView() {
  const { isLoading, allowed } = useAdminGuard();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<StatsResponse>("/api/stats"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const adsQuery = useQuery({
    queryKey: ["admin-ads-stats"],
    queryFn: () => apiFetch<AdsAllResponse>("/api/ads?all=1&stats=1"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const settingsQuery = useSettings();
  const seo = (settingsQuery.data as unknown as { seo?: SeoSettings } | null | undefined)?.seo;

  if (isLoading) return <LoadingState variant="spinner" label="Loading marketing hub" />;
  if (!allowed) return <ForbiddenState />;

  const k = statsQuery.data?.kpis;
  const adStats = adsQuery.data?.stats;
  const allAds = adsQuery.data?.items ?? [];
  const topAds = [...allAds].sort((a, b) => b.clicks - a.clicks).slice(0, 6);
  const topProducts = (statsQuery.data?.series.clicksByProduct ?? []).slice(0, 3);
  const topPosts = (statsQuery.data?.series.viewsByPost ?? []).slice(0, 3);
  const maxProductClicks = Math.max(1, ...topProducts.map((p) => p.clicks));
  const maxPostViews = Math.max(1, ...topPosts.map((p) => p.views));
  const affiliateCtr = k && k.totalViews > 0 ? (k.totalClicks / k.totalViews) * 100 : 0;
  const funnelBarWidth = k && k.totalClicks > 0 ? Math.min(100, Math.max(affiliateCtr, 1.5)) : 0;

  return (
    <AdminShell
      title="Marketing Hub"
      description="Build campaign links, track ad performance, the affiliate funnel and SEO health in one place."
    >
      <SEOHead title="Marketing Hub — Admin & Developer | MN.KP" noindex />

      <DataState query={statsQuery} empty={false} skeletonRows={4}>
        {() => (
          <div className="space-y-4 md:space-y-6">
            {/* 1 · KPI row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-5">
              <KpiCard
                label="Ad impressions"
                value={adStats ? formatCompact(adStats.impressions) : "—"}
                sub="Across all placements"
                icon={Megaphone}
              />
              <KpiCard
                label="Ad clicks"
                value={adStats ? formatCompact(adStats.clicks) : "—"}
                sub={adStats ? `CTR ${adStats.ctr.toFixed(2)}%` : undefined}
                icon={MousePointerClick}
              />
              <KpiCard
                label="Newsletter"
                value={k ? `${k.confirmedSubscribers} / ${k.subscribers}` : "—"}
                sub="confirmed subscribers"
                icon={Rss}
              />
              <KpiCard
                label="Affiliate clicks"
                value={k ? formatCompact(k.totalClicks) : "—"}
                sub="Product link clicks"
                icon={Target}
              />
              <KpiCard
                label="Total views"
                value={k ? formatCompact(k.totalViews) : "—"}
                sub="Across all posts"
                icon={Eye}
              />
            </div>

            {/* 2 · UTM campaign builder */}
            <UtmBuilder />

            {/* 3 + 4 · affiliate funnel / top content */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="min-w-0 py-4 md:py-6">
                <CardHeader className="px-4 pb-3 md:px-6">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-gold" aria-hidden="true" />
                    Affiliate funnel
                  </CardTitle>
                  <CardDescription>Content views → affiliate clicks → conversion</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pt-0 md:px-6">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {[
                      { label: "Total views", value: k ? formatCompact(k.totalViews) : "—" },
                      { label: "Affiliate clicks", value: k ? formatCompact(k.totalClicks) : "—" },
                      { label: "CTR", value: k ? `${affiliateCtr.toFixed(1)}%` : "—" },
                    ].map((step, i) => (
                      <React.Fragment key={step.label}>
                        {i > 0 ? (
                          <ArrowRight
                            className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div
                          className={cn(
                            "min-w-0 flex-1 rounded-lg border bg-muted/30 px-2 py-2 text-center sm:px-3",
                            i === 2 && "border-gold/40"
                          )}
                        >
                          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {step.label}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 text-base font-semibold tabular-nums tracking-tight sm:text-lg",
                              i === 2 && "text-gold"
                            )}
                          >
                            {step.value}
                          </p>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Views → clicks conversion</p>
                      <p className="text-xs font-semibold tabular-nums text-gold">
                        {affiliateCtr.toFixed(1)}%
                      </p>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`Affiliate click-through rate ${affiliateCtr.toFixed(1)} percent`}
                    >
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${funnelBarWidth}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Top clicked products
                    </p>
                    {topProducts.length > 0 ? (
                      topProducts.map((p) => (
                        <div key={p.name} className="flex items-center gap-3">
                          <p className="w-[45%] shrink-0 truncate text-sm" title={p.name}>
                            {p.name}
                          </p>
                          <div
                            aria-hidden="true"
                            className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className="h-full rounded-full bg-gold"
                              style={{
                                width: `${Math.max(6, (p.clicks / maxProductClicks) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                            {formatCompact(p.clicks)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No product clicks recorded yet — affiliate links will show up here.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 py-4 md:py-6">
                <CardHeader className="px-4 pb-3 md:px-6">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4 text-gold" aria-hidden="true" />
                    Top content
                  </CardTitle>
                  <CardDescription>Most-viewed posts across the blog</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pt-0 md:px-6">
                  <ol className="space-y-2.5">
                    {topPosts.length > 0 ? (
                      topPosts.map((p, i) => (
                        <li key={p.title} className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                              i === 0 ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {i + 1}
                          </span>
                          <p className="w-[45%] shrink-0 truncate text-sm font-medium" title={p.title}>
                            {p.title}
                          </p>
                          <div
                            aria-hidden="true"
                            className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className="h-full rounded-full bg-gold"
                              style={{ width: `${Math.max(6, (p.views / maxPostViews) * 100)}%` }}
                            />
                          </div>
                          <p className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
                            {formatCompact(p.views)}
                            <span className="sr-only"> views</span>
                          </p>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">
                        No post views recorded yet — publish and share to start the counter.
                      </li>
                    )}
                  </ol>
                </CardContent>
              </Card>
            </div>

            {/* 5 · ad performance */}
            <Card className="min-w-0 py-4 md:py-6">
              <CardHeader className="px-4 pb-3 md:px-6">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="size-4 text-gold" aria-hidden="true" />
                  Ad performance
                </CardTitle>
                <CardDescription>
                  {allAds.length > 6
                    ? `Top 6 of ${allAds.length} ads by clicks`
                    : `${allAds.length} ${allAds.length === 1 ? "ad" : "ads"}, sorted by clicks`}
                </CardDescription>
                <CardAction>
                  <ALink href="/admin/ads">
                    <Button variant="outline" size="sm" className="h-9 gap-1.5">
                      Ad Manager
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </ALink>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 pb-3">
                {adsQuery.isPending ? (
                  <div className="space-y-2 px-4 md:px-6" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
                    ))}
                  </div>
                ) : topAds.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6">
                    <p className="text-sm text-muted-foreground">
                      No ads yet — create your first one in the Ad Manager.
                    </p>
                    <ALink href="/admin/ads">
                      <Button variant="outline" size="sm" className="h-9 gap-1.5">
                        <Megaphone className="size-3.5" aria-hidden="true" />
                        Create ad
                      </Button>
                    </ALink>
                  </div>
                ) : (
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-0">Ad</TableHead>
                          <TableHead className="hidden w-24 text-center md:table-cell">
                            Status
                          </TableHead>
                          <TableHead className="hidden text-right md:table-cell">Impr.</TableHead>
                          <TableHead className="w-16 text-right">Clicks</TableHead>
                          <TableHead className="w-16 text-right">CTR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topAds.map((ad) => (
                          <TableRow
                            key={ad.id}
                            className="cursor-pointer"
                            onClick={() => navigate("/admin/ads")}
                          >
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "size-1.5 shrink-0 rounded-full md:hidden",
                                    ad.active ? "bg-gold" : "bg-muted-foreground/40"
                                  )}
                                />
                                <p className="truncate text-sm font-medium">{ad.name}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className="mt-1 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                              >
                                {PLACEMENT_LABEL[ad.placement]}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs",
                                  ad.active ? "text-gold" : "text-muted-foreground"
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    ad.active ? "bg-gold" : "bg-muted-foreground/40"
                                  )}
                                />
                                {ad.active ? "Active" : "Off"}
                              </span>
                            </TableCell>
                            <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                              {formatCompact(ad.impressions)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">
                              {formatCompact(ad.clicks)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {ctrOf(ad.clicks, ad.impressions)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {allAds.length > 6 ? (
                      <p className="px-4 pt-2 text-xs text-muted-foreground md:px-6">
                        Showing the 6 most-clicked ads — open the Ad Manager for the full list.
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 6 · SEO health */}
            <SeoHealthCard seo={seo} loading={settingsQuery.isPending} />

            {/* 7 · quick actions */}
            <section aria-label="Quick actions" className="flex flex-wrap items-center gap-2">
              <ALink href="/admin/ads">
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Megaphone className="size-3.5" aria-hidden="true" />
                  Ad Manager
                </Button>
              </ALink>
              <ALink href="/admin/import">
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Upload className="size-3.5" aria-hidden="true" />
                  Import &amp; Export
                </Button>
              </ALink>
              <ALink href="/admin/subscribers">
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  Subscribers
                </Button>
              </ALink>
              <ALink href="/admin/settings">
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Settings className="size-3.5" aria-hidden="true" />
                  SEO settings
                </Button>
              </ALink>
            </section>
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
