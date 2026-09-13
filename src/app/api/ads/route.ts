import { db } from "@/lib/db";
import { ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { adCreateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { adInSchedule, adSnapshot, serializeAd } from "./_lib";

/**
 * GET /api/ads — public ad delivery by placement.
 *   ?placement=blog-inline      → only ACTIVE ads in schedule, priority order
 *   ?all=1  (staff only)        → every ad incl. inactive/expired (Ad Manager)
 *   ?stats=1                    → lightweight totals for the marketing hub
 */
export const GET = withApi(async (req) => {
  const url = new URL(req.url);
  const placement = url.searchParams.get("placement");
  const wantsAll = url.searchParams.get("all") === "1";
  const wantsStats = url.searchParams.get("stats") === "1";

  if (wantsAll) {
    await requireRole(req, STAFF_ROLES);
    const items = await db.ad.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
    if (wantsStats) {
      const impressions = items.reduce((n, a) => n + a.impressions, 0);
      const clicks = items.reduce((n, a) => n + a.clicks, 0);
      return ok({
        items: items.map(serializeAd),
        stats: {
          totalAds: items.length,
          activeAds: items.filter((a) => a.active).length,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        },
      });
    }
    return ok({ items: items.map(serializeAd) });
  }

  const items = await db.ad.findMany({
    where: { active: true, ...(placement ? { placement } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  const live = items.filter((a) => adInSchedule(a));

  if (wantsStats) {
    const impressions = live.reduce((n, a) => n + a.impressions, 0);
    const clicks = live.reduce((n, a) => n + a.clicks, 0);
    return ok({
      items: live.map(serializeAd),
      stats: {
        totalAds: live.length,
        activeAds: live.length,
        impressions,
        clicks,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      },
    });
  }
  return ok({ items: live.map(serializeAd) });
});

/**
 * POST /api/ads — STAFF. Create a new ad (Ad Manager "Create ad").
 * Writes an audit entry so the creation can be undone.
 */
export const POST = withApi(async (req) => {
  const user = await requireRole(req, STAFF_ROLES);
  const body = adCreateSchema.parse(await readJson(req));

  const ad = await db.ad.create({
    data: {
      name: body.name,
      type: body.type,
      placement: body.placement,
      title: body.title || null,
      body: body.body || null,
      imageUrl: body.imageUrl || null,
      imageAlt: body.imageAlt || null,
      images: toJson(body.images),
      linkUrl: body.linkUrl || null,
      linkLabel: body.linkLabel,
      active: body.active,
      priority: body.priority,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
    },
  });

  await writeAudit({
    user,
    action: "create",
    entity: "ad",
    entityId: ad.id,
    label: `Ad — ${ad.name}`,
    before: null,
    after: adSnapshot(ad),
  });

  return ok(serializeAd(ad), { status: 201 });
});
