import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { auditIdSchema } from "@/lib/validation";
import { applySnapshot, serializeAudit } from "../_lib";

/**
 * POST /api/audit/undo — STAFF. Reverts one logged change by replaying its
 * BEFORE snapshot (settings value, ad, post or product row; deleted rows
 * are recreated, created rows are removed). Idempotency: a second undo of
 * the same entry returns 409.
 */
export const POST = withApi(async (req) => {
  const user = await requireRole(req, STAFF_ROLES);
  const { id } = auditIdSchema.parse(await readJson(req));

  const entry = await db.auditLog.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, "NOT_FOUND", "Audit entry not found.");
  if (entry.undoneAt) throw new ApiError(409, "CONFLICT", "This change has already been undone.");

  const restored = await applySnapshot(entry.entity, entry.entityId, entry.before);

  const updated = await db.auditLog.update({
    where: { id },
    data: { undoneAt: new Date(), redoneAt: null },
  });

  return ok({
    entry: serializeAudit(updated),
    restored,
    message: `Undone — ${entry.label}`,
    by: user.fullName || user.email,
  });
});
