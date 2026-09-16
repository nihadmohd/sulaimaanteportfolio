import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { AD_SUBMIT_ROLES, STAFF_ROLES, getSessionUser, requireRole } from "@/lib/auth";
import { adCreateSchema, adSubmitSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { adInSchedule, adSnapshot, serializeAd } from "./_lib";

/**
 * GET /api/ads — ad delivery + management feeds.
 *   ?placement=blog-inline      → LIVE public ads (approved + active + in
 *                                 schedule), priority order. Pending client
 *                                 submissions are NEVER public (Task 14).
 *   ?all=1  (staff only)        → every ad incl. pending/inactive (Ad Manager)
 *   ?stats=1                    → lightweight totals for the marketing hub
 *   ?mine=1 (advertiser)        → this advertiser's own submissions, all
 *                                 review states, newest first (#/studio)
 */
export const GET = withApi(async (req) => {
  const url = new URL(req.url);
  const placement = url.searchParams.get("placement");
  const wantsAll = url.searchParams.get("all") === "1";
  const wantsStats = url.searchParams.get("stats") === "1";
  const wantsMine = url.searchParams.get("mine") === "1";

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
          pendingReview: items.filter((a) => a.reviewStatus === "pending").length,
        },
      });
    }
    return ok({ items: items.map(serializeAd) });
  }

  if (wantsMine) {
    const user = await requireRole(req, AD_SUBMIT_ROLES);
    const items = await db.ad.findMany({
      where: { submittedById: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ items: items.map(serializeAd) });
  }

  const items = await db.ad.findMany({
    where: {
      active: true,
      reviewStatus: "approved",
      ...(placement ? { placement } : {}),
    },
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
 * POST /api/ads — two doors (Task 14):
 *
 *  1. STAFF (editor/admin) — full adCreateSchema. Owner ads and client
 *     campaigns the owner creates on a client's behalf. reviewStatus stays
 *     "approved" (the owner made it), the active switch controls delivery.
 *
 *  2. ADVERTISER — narrow adSubmitSchema (#/studio). The API FORCES
 *     source="client", reviewStatus="pending", active=false and stamps
 *     submittedById — nothing a client submits is ever public until the
 *     owner approves it in the Ad Manager.
 */
export const POST = withApi(async (req) => {
  const user = await getSessionUser(req);
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const isStaff = STAFF_ROLES.includes(user.role);
  const isAdvertiser = AD_SUBMIT_ROLES.includes(user.role);
  if (!isStaff && !isAdvertiser) {
    throw new ApiError(403, "FORBIDDEN", "Advertiser access is required to submit ads.");
  }

  if (isStaff) {
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
        source: body.source,
        clientName: body.clientName || null,
        clientCompany: body.clientCompany || null,
        clientEmail: body.clientEmail || null,
        monthlyRate: body.monthlyRate ?? null,
        planCode: body.planCode || null,
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
  }

  // ---- advertiser submission (client ad, pending review) ----
  const body = adSubmitSchema.parse(await readJson(req));
  const ad = await db.ad.create({
    data: {
      name: body.name,
      type: body.type,
      placement: body.placement,
      title: body.title || null,
      body: body.body || null,
      imageUrl: body.imageUrl || null,
      imageAlt: body.imageAlt || null,
      images: "[]",
      linkUrl: body.linkUrl || null,
      linkLabel: body.linkLabel,
      active: false,
      priority: 0,
      source: "client",
      clientName: user.fullName || null,
      clientEmail: user.email || null,
      reviewStatus: "pending",
      submittedById: user.id,
    },
  });

  // No audit entry: client submissions are not staff mutations. The owner
  // sees them in the Ad Manager review queue + notification bell instead.

  return ok(serializeAd(ad), { status: 201 });
});
