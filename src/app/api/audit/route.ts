import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { serializeAudit } from "./_lib";

/**
 * GET /api/audit — STAFF. Activity feed with undo/redo state.
 *   ?limit=30 (max 100) · ?page=1
 */
export const GET = withApi(async (req) => {
  await requireRole(req, STAFF_ROLES);
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    db.auditLog.count(),
  ]);

  return ok({
    items: rows.map(serializeAudit),
    total,
    page,
    limit,
    // Newest restorable + not-yet-undone entry = what "Undo" reverts next.
    lastRestorableId:
      rows.find((r) => !r.undoneAt && serializeAudit(r).restorable)?.id ?? null,
  });
});
