import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import type { StatsResponse } from "@/types";

/**
 * GET /api/stats — ADMIN (STAFF_ROLES) console KPIs + chart series.
 *
 * Returns EXACTLY StatsResponse from @/types:
 *   kpis  — platform totals (users, posts, views, products, clicks,
 *           inquiries, newsletter subscribers)
 *   series — viewsByPost top8 · clicksByProduct top8 · inquiriesByDay
 *            (last 14 days, zero-filled)
 */

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
    },
    series: {
      viewsByPost: topPosts.map((p) => ({ title: p.title, views: p.viewsCount })),
      clicksByProduct: topProducts.map((p) => ({ name: p.name, clicks: p.clicksCount })),
      inquiriesByDay: Array.from(buckets.entries()).map(([day, count]) => ({ day, count })),
    },
  };
  return ok(stats);
});
