"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  FilePlus2,
  Inbox,
  MousePointerClick,
  Package,
  ShoppingBag,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ALink } from "@/components/router/link";
import { DataState, ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { navigate } from "@/hooks/use-router";
import type { InquiryDTO, Paginated, StatsResponse } from "@/types";
import { AdminShell } from "./_shell";
import {
  apiFetch,
  formatCompact,
  InquiryStatusBadge,
  KpiCard,
  timeAgo,
  useAdminGuard,
  usePresenceOnline,
} from "./_shared";

/**
 * Admin overview (#/admin — route key "admin").
 * 8 KPI cards over /api/stats, lazy recharts panel, live presence card
 * (REST fallback polled every 10s), quick actions + latest inquiries.
 */

const AdminCharts = React.lazy(() => import("./_charts"));

function ChartFallback() {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-xl border bg-card">
      <LoadingState variant="spinner" label="Loading charts" />
    </div>
  );
}

export default function OverviewView() {
  const { isLoading, allowed } = useAdminGuard();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<StatsResponse>("/api/stats"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const presence = usePresenceOnline(10_000);

  const inquiriesQuery = useQuery({
    queryKey: ["admin-inquiries", "latest"],
    queryFn: () => apiFetch<Paginated<InquiryDTO>>("/api/inquiries?limit=5"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return <LoadingState variant="spinner" label="Loading console" />;
  }
  if (!allowed) {
    return <ForbiddenState />;
  }

  const k = statsQuery.data?.kpis;

  return (
    <AdminShell
      title="Overview"
      description="The whole platform at a glance — traffic, commerce, inbox and people."
      actions={
        <>
          <ALink href="/admin/posts/new">
            <Button size="sm" className="h-9 gap-2">
              <FilePlus2 className="size-4" aria-hidden="true" />
              New post
            </Button>
          </ALink>
          <ALink href="/admin/products/new">
            <Button size="sm" variant="outline" className="h-9 gap-2">
              <ShoppingBag className="size-4" aria-hidden="true" />
              Add product
            </Button>
          </ALink>
          <ALink href="/admin/inquiries">
            <Button size="sm" variant="outline" className="h-9 gap-2">
              <Inbox className="size-4" aria-hidden="true" />
              Inquiries
            </Button>
          </ALink>
        </>
      }
    >
      <SEOHead title="Overview — Admin & Developer | MN.KP" noindex />
      {/* KPI grid */}
      <DataState query={statsQuery} skeletonRows={6}>
        {(stats) => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              label="Posts"
              value={formatCompact(stats.kpis.totalPosts)}
              sub={`${stats.kpis.publishedPosts} published`}
              icon={FilePlus2}
            />
            <KpiCard
              label="Total views"
              value={formatCompact(stats.kpis.totalViews)}
              sub="across all posts"
              icon={Eye}
            />
            <KpiCard
              label="Products"
              value={formatCompact(stats.kpis.totalProducts)}
              sub={`${stats.kpis.activeProducts} active`}
              icon={Package}
            />
            <KpiCard
              label="Affiliate clicks"
              value={formatCompact(stats.kpis.totalClicks)}
              sub="outbound tracked"
              icon={MousePointerClick}
            />
            <KpiCard
              label="New inquiries"
              value={stats.kpis.newInquiries}
              sub={`${stats.kpis.totalInquiries} total`}
              icon={Inbox}
            />
            <KpiCard
              label="Users"
              value={stats.kpis.totalUsers}
              sub="registered accounts"
              icon={Users}
            />
            <KpiCard
              label="Newsletter"
              value={`${stats.kpis.confirmedSubscribers}/${stats.kpis.subscribers}`}
              sub="confirmed subscribers"
              icon={UserPlus}
            />
          </div>
        )}
      </DataState>

      {/* Live presence + quick links */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
              Live activity
            </CardTitle>
            <CardDescription>Visitors online right now (refreshes 10s)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <p className="text-4xl font-semibold tabular-nums tracking-tight">
              {presence.data ?? "—"}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {presence.data == null
                ? "Presence service offline — the realtime counter lands with the presence wave."
                : "Connected via the presence service."}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Latest inquiries</CardTitle>
            <CardDescription>Newest messages from the contact form</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState query={inquiriesQuery} emptyVariant="inbox" skeletonRows={3}>
              {(data) => (
                <ul className="space-y-2">
                  {data.items.map((inq) => (
                    <li
                      key={inq.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        onClick={() => navigate("/admin/inquiries")}
                        className="text-left text-sm font-medium hover:text-primary"
                      >
                        {inq.name}
                      </button>
                      <InquiryStatusBadge status={inq.status} />
                      <span className="text-xs text-muted-foreground">{inq.type}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeAgo(inq.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
            <ALink
              href="/admin/inquiries"
              className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
            >
              Open the full inbox →
            </ALink>
          </CardContent>
        </Card>
      </div>

      {/* Charts (lazy recharts) */}
      <div className="mt-6">
        <React.Suspense fallback={<ChartFallback />}>
          {statsQuery.data ? <AdminCharts series={statsQuery.data.series} /> : <ChartFallback />}
        </React.Suspense>
      </div>
    </AdminShell>
  );
}
