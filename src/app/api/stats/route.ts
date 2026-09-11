import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import type { StatsResponse } from "@/types";

/**
 * GET /api/stats — ADMIN (STAFF_ROLES) console KPIs + chart series.
 *
 * Returns EXACTLY StatsResponse from @/types (2-a binding contract):
 *   kpis  — platform totals (counts + aggregates + mrr)
 *   series — viewsByPost top8 · clicksByProduct top8 · inquiriesByDay
 *            (last 14 days, zero-filled) · planDist (active subs by plan)
 *
 * MRR notes (5-a handoff): active statuses = trialing|active|past_due;
 * yearly subscriptions contribute priceYearly / 12 (monthly-normalized).
 */

const ACTIVE_SUB_STATUSES = ["trialing", "active", "past_due"];
const DAYS_WINDOW = 14;

function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const GET = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (DAYS_WINDOW - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalPosts,
    publishedPosts,
    viewsAgg,
    totalProducts,
    activeProducts,
    clicksAgg,
    totalInquiries,
    newInquiries,
    subscribers,
    confirmedSubscribers,
    activeSubsWithPlans,
    topPosts,
    topProducts,
    recentInquiries,
  ] = await Promise.all([
    db.user.count(),
    db.post.count(),
    db.post.count({ where: { status: "published" } }),
    db.post.aggregate({ _sum: { viewsCount: true } }),
    db.product.count(),
    db.product.count({ where: { status: "active" } }),
    db.product.aggregate({ _sum: { clicksCount: true } }),
    db.inquiry.count(),
    db.inquiry.count({ where: { status: "new" } }),
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { status: "confirmed" } }),
    db.subscription.findMany({
      where: { status: { in: ACTIVE_SUB_STATUSES } },
      select: {
        billingInterval: true,
        plan: { select: { code: true, priceMonthly: true, priceYearly: true } },
      },
    }),
    db.post.findMany({
      orderBy: [{ viewsCount: "desc" }, { publishedAt: "desc" }],
      take: 8,
      select: { title: true, viewsCount: true },
    }),
    db.product.findMany({
      orderBy: [{ clicksCount: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: { name: true, clicksCount: true },
    }),
    db.inquiry.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const mrr = activeSubsWithPlans.reduce((sum, sub) => {
    const monthly =
      sub.billingInterval === "yearly" ? sub.plan.priceYearly / 12 : sub.plan.priceMonthly;
    return sum + (Number.isFinite(monthly) ? monthly : 0);
  }, 0);

  // last 14 days zero-filled, oldest → newest
  const buckets = new Map<string, number>();
  for (let i = 0; i < DAYS_WINDOW; i += 1) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    buckets.set(dayKey(d), 0);
  }
  for (const inquiry of recentInquiries) {
    const key = dayKey(inquiry.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const planCounts = new Map<string, number>();
  for (const sub of activeSubsWithPlans) {
    const code = sub.plan.code;
    planCounts.set(code, (planCounts.get(code) ?? 0) + 1);
  }

  const stats: StatsResponse = {
    kpis: {
      totalUsers,
      totalPosts,
      publishedPosts,
      totalViews: viewsAgg._sum.viewsCount ?? 0,
      totalProducts,
      activeProducts,
      totalClicks: clicksAgg._sum.clicksCount ?? 0,
      totalInquiries,
      newInquiries,
      subscribers,
      confirmedSubscribers,
      activeSubscriptions: activeSubsWithPlans.length,
      mrr: Math.round(mrr),
    },
    series: {
      viewsByPost: topPosts.map((p) => ({ title: p.title, views: p.viewsCount })),
      clicksByProduct: topProducts.map((p) => ({ name: p.name, clicks: p.clicksCount })),
      inquiriesByDay: Array.from(buckets.entries()).map(([day, count]) => ({ day, count })),
      planDist: Array.from(planCounts.entries()).map(([plan, count]) => ({ plan, count })),
    },
  };
  return ok(stats);
});
