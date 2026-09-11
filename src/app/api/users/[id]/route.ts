import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
import { serializeUser } from "@/app/api/users/_lib";

/**
 * PATCH /api/users/:id — ADMIN (STAFF_ROLES).
 *
 * {role?, isActive?} — the acting admin can never change their own role or
 * active status (400), which guards against self-lockout.
 */

interface Ctx {
  params: Promise<{ id: string }>;
}

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = await requireRole(req, STAFF_ROLES);

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    throw new ApiError(404, "NOT_FOUND", "User not found.");
  }

  const body = userUpdateSchema.parse(await readJson(req));

  if (target.id === actor.id && (body.role !== undefined || body.isActive !== undefined)) {
    throw new ApiError(
      400,
      "VALIDATION",
      "You cannot change your own role or active status. Ask another admin."
    );
  }

  const data: { role?: string; isActive?: boolean } = {};
  if (body.role !== undefined) data.role = body.role;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return ok(serializeUser(target));
  }

  const updated = await db.user.update({ where: { id }, data });
  return ok(serializeUser(updated));
});
