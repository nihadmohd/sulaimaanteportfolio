import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { AD_SUBMIT_ROLES, STAFF_ROLES, getSessionUser, requireRole } from "@/lib/auth";
import { adSubmitUpdateSchema, adUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { adSnapshot, serializeAd } from "../_lib";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function findAd(id: string) {
  const ad = await db.ad.findUnique({ where: { id } });
  if (!ad) throw new ApiError(404, "NOT_FOUND", "Ad not found.");
  return ad;
}

/** GET /api/ads/:id — STAFF, or the advertiser who submitted it (#/studio). */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const user = await requireRole(req, AD_SUBMIT_ROLES);
  const { id } = await ctx.params;
  const ad = await findAd(id);

  const isStaff = STAFF_ROLES.includes(user.role);
  if (!isStaff && ad.submittedById !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You can only view your own ad submissions.");
  }
  return ok(serializeAd(ad));
});

/**
 * PATCH /api/ads/:id — two doors (Task 14):
 *
 *  · STAFF — full update incl. the on/off toggle, client-campaign billing
 *    fields and the review controls (reviewStatus + reviewNote → reviewedAt).
 *    Snapshots before/after for undo/redo; a body of only {active} is logged
 *    as a "toggle" action so the activity feed reads nicely.
 *
 *  · ADVERTISER — may edit ONLY their own submission and ONLY while it is
 *    still pending review, through the narrow adSubmitUpdateSchema. Delivery
 *    fields (active, priority, schedule, billing) are untouchable.
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const user = await getSessionUser(req);
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }
  const { id } = await ctx.params;
  const before = await findAd(id);

  const isStaff = STAFF_ROLES.includes(user.role);
  const isOwner = before.submittedById === user.id && AD_SUBMIT_ROLES.includes(user.role);
  if (!isStaff && !isOwner) {
    throw new ApiError(403, "FORBIDDEN", "You can only edit your own ad submissions.");
  }

  if (isStaff) {
    const body = adUpdateSchema.parse(await readJson(req));
    const keys = Object.keys(body);

    const after = await db.ad.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.placement !== undefined ? { placement: body.placement } : {}),
        ...(body.title !== undefined ? { title: body.title || null } : {}),
        ...(body.body !== undefined ? { body: body.body || null } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
        ...(body.imageAlt !== undefined ? { imageAlt: body.imageAlt || null } : {}),
        ...(body.images !== undefined ? { images: toJson(body.images) } : {}),
        ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl || null } : {}),
        ...(body.linkLabel !== undefined ? { linkLabel: body.linkLabel } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.startAt !== undefined ? { startAt: body.startAt ? new Date(body.startAt) : null } : {}),
        ...(body.endAt !== undefined ? { endAt: body.endAt ? new Date(body.endAt) : null } : {}),
        ...(body.source !== undefined ? { source: body.source } : {}),
        ...(body.clientName !== undefined ? { clientName: body.clientName || null } : {}),
        ...(body.clientCompany !== undefined ? { clientCompany: body.clientCompany || null } : {}),
        ...(body.clientEmail !== undefined ? { clientEmail: body.clientEmail || null } : {}),
        ...(body.monthlyRate !== undefined ? { monthlyRate: body.monthlyRate ?? null } : {}),
        ...(body.planCode !== undefined ? { planCode: body.planCode || null } : {}),
        ...(body.reviewStatus !== undefined || body.reviewNote !== undefined
          ? { reviewedAt: new Date() }
          : {}),
        ...(body.reviewStatus !== undefined ? { reviewStatus: body.reviewStatus } : {}),
        ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote || null } : {}),
      },
    });

    await writeAudit({
      user,
      action: keys.length === 1 && keys[0] === "active" ? "toggle" : "update",
      entity: "ad",
      entityId: after.id,
      label: `Ad — ${after.name}`,
      before: adSnapshot(before),
      after: adSnapshot(after),
    });

    return ok(serializeAd(after));
  }

  // ---- advertiser: own submission, pending only, narrow field set ----
  if (before.reviewStatus !== "pending") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This submission has already been reviewed — contact us to request changes."
    );
  }
  const body = adSubmitUpdateSchema.parse(await readJson(req));
  const after = await db.ad.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.placement !== undefined ? { placement: body.placement } : {}),
      ...(body.title !== undefined ? { title: body.title || null } : {}),
      ...(body.body !== undefined ? { body: body.body || null } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
      ...(body.imageAlt !== undefined ? { imageAlt: body.imageAlt || null } : {}),
      ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl || null } : {}),
      ...(body.linkLabel !== undefined ? { linkLabel: body.linkLabel } : {}),
    },
  });
  return ok(serializeAd(after));
});

/**
 * DELETE /api/ads/:id — STAFF always; an advertiser may withdraw their own
 * STILL-PENDING submission. Staff deletions keep a before snapshot for undo.
 */
export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const user = await getSessionUser(req);
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }
  const { id } = await ctx.params;
  const before = await findAd(id);

  const isStaff = STAFF_ROLES.includes(user.role);
  const isOwner = before.submittedById === user.id && AD_SUBMIT_ROLES.includes(user.role);
  if (!isStaff && !isOwner) {
    throw new ApiError(403, "FORBIDDEN", "You can only withdraw your own submissions.");
  }
  if (!isStaff && before.reviewStatus !== "pending") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This submission has already been reviewed — contact us to take it down."
    );
  }

  await db.ad.delete({ where: { id } });
  if (isStaff) {
    await writeAudit({
      user,
      action: "delete",
      entity: "ad",
      entityId: id,
      label: `Ad — ${before.name}`,
      before: adSnapshot(before),
      after: null,
    });
  }
  return ok({ id, deleted: true });
});
