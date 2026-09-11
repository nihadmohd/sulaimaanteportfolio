import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { adUpdateSchema } from "@/lib/validation";
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

/** GET /api/ads/:id — STAFF. Single ad for the editor dialog. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  await requireRole(req, STAFF_ROLES);
  const { id } = await ctx.params;
  return ok(serializeAd(await findAd(id)));
});

/**
 * PATCH /api/ads/:id — STAFF. Partial update incl. the on/off toggle.
 * Snapshots before/after for undo/redo; a body of only {active} is logged
 * as a "toggle" action so the activity feed reads nicely.
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const user = await requireRole(req, STAFF_ROLES);
  const { id } = await ctx.params;
  const before = await findAd(id);
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
});

/** DELETE /api/ads/:id — STAFF. Removable via undo (before snapshot kept). */
export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const user = await requireRole(req, STAFF_ROLES);
  const { id } = await ctx.params;
  const before = await findAd(id);
  await db.ad.delete({ where: { id } });
  await writeAudit({
    user,
    action: "delete",
    entity: "ad",
    entityId: id,
    label: `Ad — ${before.name}`,
    before: adSnapshot(before),
    after: null,
  });
  return ok({ id, deleted: true });
});
