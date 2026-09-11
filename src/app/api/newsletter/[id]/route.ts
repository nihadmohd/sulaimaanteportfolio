import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { newsletterUpdateSchema } from "@/lib/validation";
import { serializeSubscriber } from "@/app/api/newsletter/admin/route";

/**
 * PATCH/DELETE /api/newsletter/:id — ADMIN (STAFF_ROLES).
 *
 * PATCH {status}: pending|confirmed|unsubscribed — confirmedAt is stamped
 * the first time a subscriber flips to confirmed; unsubscribedAt is stamped
 * on unsubscribe. DELETE removes the row outright.
 */

interface Ctx {
  params: Promise<{ id: string }>;
}

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireRole(req, STAFF_ROLES);

  const existing = await db.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Subscriber not found.");
  }

  const body = newsletterUpdateSchema.parse(await readJson(req));

  const data: { status: string; confirmedAt?: Date | null; unsubscribedAt?: Date | null } = {
    status: body.status,
  };
  if (body.status === "confirmed" && !existing.confirmedAt) {
    data.confirmedAt = new Date();
  }
  if (body.status === "unsubscribed") {
    data.unsubscribedAt = new Date();
    if (!existing.confirmedAt) data.confirmedAt = null;
  }
  if (body.status === "pending") {
    data.confirmedAt = null;
    data.unsubscribedAt = null;
  }

  const updated = await db.newsletterSubscriber.update({ where: { id }, data });
  return ok(serializeSubscriber(updated));
});

export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireRole(req, STAFF_ROLES);

  const existing = await db.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Subscriber not found.");
  }

  await db.newsletterSubscriber.delete({ where: { id } });
  return ok({ id, deleted: true });
});
