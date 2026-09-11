import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { inquiryUpdateSchema } from "@/lib/validation";
import { serializeInquiry } from "@/app/api/_lib/serialize";

/**
 * PATCH/DELETE /api/inquiries/:id — ADMIN (STAFF_ROLES).
 *
 * PATCH {status?, priority?, internalNote?, replied?}:
 *   · replied === true  → repliedAt stamped now
 *   · replied === false → repliedAt cleared
 *   · status → "replied" also stamps repliedAt when not already set
 * DELETE removes the inquiry.
 */

interface Ctx {
  params: Promise<{ id: string }>;
}

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireRole(req, STAFF_ROLES);

  const inquiry = await db.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    throw new ApiError(404, "NOT_FOUND", "Inquiry not found.");
  }

  const body = inquiryUpdateSchema.parse(await readJson(req));

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "replied" && inquiry.repliedAt == null && body.replied === undefined) {
      data.repliedAt = new Date();
    }
  }
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.internalNote !== undefined) {
    data.internalNote = body.internalNote.trim() === "" ? null : body.internalNote;
  }
  if (body.replied !== undefined) {
    data.repliedAt = body.replied ? new Date() : null;
    if (body.replied && body.status === undefined && inquiry.status === "new") {
      data.status = "replied";
    }
  }

  if (Object.keys(data).length === 0) {
    return ok(serializeInquiry(inquiry));
  }

  const updated = await db.inquiry.update({ where: { id }, data });
  return ok(serializeInquiry(updated));
});

export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireRole(req, STAFF_ROLES);

  const inquiry = await db.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    throw new ApiError(404, "NOT_FOUND", "Inquiry not found.");
  }

  await db.inquiry.delete({ where: { id } });
  return ok({ id, deleted: true });
});
