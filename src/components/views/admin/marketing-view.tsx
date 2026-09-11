"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Eye,
  Megaphone,
  MousePointerClick,
  Rss,
  Target,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALink } from "@/components/router/link";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import type { AdDTO, AdStatsDTO, StatsResponse } from "@/types";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, formatCompact, formatINR, KpiCard, useAdminGuard } from "./_shared";

/**
 * Marketing Hub (#/admin/marketing — route key "admin-marketing").
 * Compact stat cards only — recharts stays out of this bundle entirely.
 * · KPIs: /api/ads?all=1&stats=1 + /api/stats
 * · Affiliate funnel: stats kpis/series (views → clicks → CTR + top products)
 * · Top content: stats series viewsByPost
 * · Ad performance: ads list sorted by clicks
 */

interface AdsAllResponse {
  items: AdDTO[];
  stats?: AdStatsDTO;
}

function ctrOf(clicks: number, impressions: number): string {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

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

  if (isLoading) return <LoadingState variant="spinner" label="Loading marketing hub" />;
  if (!allowed) return <ForbiddenState />;

  const k = statsQuery.data?.kpis;
  const adStats = adsQuery.data?.stats;
  const adsByClicks = [...(adsQuery.data?.items ?? [])].sort((a, b) => b.clicks - a.clicks);
  const topProducts = (statsQuery.data?.series.clicksByProduct ?? []).slice(0, 3);
  const topPosts = (statsQuery.data?.series.viewsByPost ?? []).slice(0, 3);
  const maxProductClicks = Math.max(1, ...topProducts.map((p) => p.clicks));
  const affiliateCtr = k && k.totalViews > 0 ? (k.totalClicks / k.totalViews) * 100 : 0;

  return (
    <AdminShell
      title="Marketing Hub"
      description="Ad performance, affiliate funnel, top content and list growth."
    >
      <SEOHead title="Marketing Hub — Admin & Developer | MN.KP" noindex />

      <DataState query={statsQuery} empty={false} skeletonRows={4}>
        {() => (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Ad impressions"
                value={adStats ? formatCompact(adStats.impressions) : "—"}
                sub="Across all placements"
                icon={Eye}
              />
              <KpiCard
                label="Ad clicks"
                value={adStats ? formatCompact(adStats.clicks) : "—"}
                sub={adStats ? `CTR ${adStats.ctr.toFixed(2)}%` : undefined}
                icon={MousePointerClick}
              />
              <KpiCard
                label="Subscribers"
                value={k ? String(k.confirmedSubscribers) : "—"}
                sub={k ? `confirmed of ${k.subscribers} total` : undefined}
                icon={Rss}
              />
              <KpiCard
                label="Affiliate clicks"
                value={k ? formatCompact(k.totalClicks) : "—"}
                sub="Product link clicks"
                icon={Target}
              />
              <KpiCard
                label="MRR"
                value={k ? formatINR(k.mrr) : "—"}
                sub={k ? `${k.activeSubscriptions} active subscriptions` : undefined}
                icon={Wallet}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* affiliate funnel */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                    Affiliate funnel
                  </CardTitle>
                  <CardDescription>Content views → affiliate clicks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label: "Total views", value: k ? formatCompact(k.totalViews) : "—" },
                      { label: "Affiliate clicks", value: k ? formatCompact(k.totalClicks) : "—" },
                      { label: "CTR", value: `${affiliateCtr.toFixed(1)}%` },
                    ].map((step, i) => (
                      <React.Fragment key={step.label}>
                        {i > 0 ? (
                          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : null}
                        <div className="min-w-28 flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {step.label}
                          </p>
                          <p className="text-lg font-semibold tabular-nums tracking-tight">{step.value}</p>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Top clicked products
                    </p>
                    {topProducts.length > 0 ? (
                      topProducts.map((p) => (
                        <div key={p.name} className="flex items-center gap-3">
                          <p className="min-w-0 flex-1 truncate text-sm">{p.name}</p>
                          <div
                            aria-hidden="true"
                            className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(6, (p.clicks / maxProductClicks) * 100)}%` }}
                            />
                          </div>
                          <p className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
                            {formatCompact(p.clicks)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No product clicks recorded yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* top content */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Top content</CardTitle>
                  <CardDescription>Most-read posts this cycle</CardDescription>
                </CardHeader>
                <CardContent>
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
                          <p className="min-w-0 flex-1 truncate text-sm">{p.title}</p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                            {formatCompact(p.views)} views
                          </p>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">No post views recorded yet.</li>
                    )}
                  </ol>
                </CardContent>
              </Card>
            </div>

            {/* ad performance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="size-4 text-gold" aria-hidden="true" />
                  Ad performance
                </CardTitle>
                <CardDescription>Every ad, sorted by clicks</CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {adsQuery.isPending ? (
                  <p className="px-6 text-sm text-muted-foreground">Loading ads…</p>
                ) : adsByClicks.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6">
                    <p className="text-sm text-muted-foreground">
                      No ads yet — create one in the Ad Manager.
                    </p>
                    <ALink href="#/admin/ads">
                      <Button variant="outline" size="sm" className="h-9 gap-2">
                        <Megaphone className="size-4" aria-hidden="true" />
                        New ad
                      </Button>
                    </ALink>
                  </div>
                ) : (
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[46%] min-w-[200px]">Ad</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adsByClicks.map((ad) => (
                          <TableRow key={ad.id}>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    ad.active ? "bg-primary" : "bg-muted-foreground/40"
                                  )}
                                />
                                <p className="truncate text-sm font-medium">{ad.name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatCompact(ad.impressions)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatCompact(ad.clicks)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {ctrOf(ad.clicks, ad.impressions)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs",
                                  ad.active ? "text-primary" : "text-muted-foreground"
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    ad.active ? "bg-primary" : "bg-muted-foreground/40"
                                  )}
                                />
                                {ad.active ? "on" : "off"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* quick actions */}
            <div className="flex flex-wrap gap-2">
              <ALink href="#/admin/ads">
                <Button variant="outline" size="sm" className="h-10 gap-2">
                  <Megaphone className="size-4" aria-hidden="true" />
                  New ad
                </Button>
              </ALink>
              <ALink href="#/admin/import">
                <Button variant="outline" size="sm" className="h-10 gap-2">
                  <Upload className="size-4" aria-hidden="true" />
                  Import content
                </Button>
              </ALink>
              <ALink href="#/admin/subscribers">
                <Button variant="outline" size="sm" className="h-10 gap-2">
                  <Users className="size-4" aria-hidden="true" />
                  Newsletter list
                </Button>
              </ALink>
            </div>
          </div>
        )}
      </DataState>
    </AdminShell>
  );
}
