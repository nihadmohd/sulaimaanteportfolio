import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { planUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { serializePlan } from "@/app/api/_lib/serialize";

/**
 * PATCH /api/plans/:id — ADMIN (STAFF_ROLES) [Task 6-a addendum].
 *
 * Partial plan update. features (string[]) is stored via toJson; setting
 * isDefault=true unsets the flag on every other plan so exactly one
 * default exists (mirrors the production partial-unique behavior).
 */

interface Ctx {
  params: Promise<{ id: string }>;
}

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireRole(req, STAFF_ROLES);

  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) {
    throw new ApiError(404, "NOT_FOUND", "Plan not found.");
  }

  const body = planUpdateSchema.parse(await readJson(req));

  const data: Record<string, unknown> = {};
  if (body.code !== undefined && body.code !== plan.code) {
    const clash = await db.plan.findUnique({ where: { code: body.code } });
    if (clash) {
      throw new ApiError(409, "CONFLICT", `Plan code "${body.code}" is already in use.`);
    }
    data.code = body.code;
  }
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description ?? null;
  if (body.priceMonthly !== undefined) data.priceMonthly = body.priceMonthly;
  if (body.priceYearly !== undefined) data.priceYearly = body.priceYearly;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.features !== undefined) data.features = toJson(body.features);
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.isDefault !== undefined) data.isDefault = body.isDefault;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  if (Object.keys(data).length === 0) {
    return ok(serializePlan(plan));
  }

  const [updated] = await db.$transaction([
    db.plan.update({ where: { id }, data }),
    ...(body.isDefault === true
      ? [db.plan.updateMany({ where: { id: { not: id } }, data: { isDefault: false } })]
      : []),
  ]);

  return ok(serializePlan(updated));
});
