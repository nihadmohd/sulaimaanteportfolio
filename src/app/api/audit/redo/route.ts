import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { auditIdSchema } from "@/lib/validation";
import { applySnapshot, serializeAudit } from "../_lib";

/**
 * POST /api/audit/redo — STAFF. Re-applies a previously UNDONE change by
 * replaying its AFTER snapshot. Only entries with undoneAt set qualify.
 */
export const POST = withApi(async (req) => {
  const user = await requireRole(req, STAFF_ROLES);
  const { id } = auditIdSchema.parse(await readJson(req));

  const entry = await db.auditLog.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, "NOT_FOUND", "Audit entry not found.");
  if (!entry.undoneAt) throw new ApiError(409, "CONFLICT", "This change has not been undone — nothing to redo.");

  const restored = await applySnapshot(entry.entity, entry.entityId, entry.after);

  const updated = await db.auditLog.update({
    where: { id },
    data: { undoneAt: null, redoneAt: new Date() },
  });

  return ok({
    entry: serializeAudit(updated),
    restored,
    message: `Redone — ${entry.label}`,
    by: user.fullName || user.email,
  });
});
