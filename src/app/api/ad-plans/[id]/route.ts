import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { adPlanUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { serializePlan } from "../_lib";

/**
 * PATCH /api/ad-plans/:id — STAFF. Edit price, features, placements, on/off.
 * DELETE /api/ad-plans/:id — STAFF (recoverable via Activity & Undo).
 */

interface Ctx {
    params: Promise<{ id: string }>;
}

async function findPlan(id: string) {
    const plan = await db.adPlan.findUnique({ where: { id } });
    if (!plan) throw new ApiError(404, "NOT_FOUND", "Ad plan not found.");
    return plan;
}

export const PATCH = withApi<Ctx>(async (req, ctx) => {
    const user = await requireRole(req, STAFF_ROLES);
    const { id } = await ctx.params;
    const before = await findPlan(id);
    const body = adPlanUpdateSchema.parse(await readJson(req));

    const after = await db.adPlan.update({
        where: { id },
        data: {
            ...(body.code !== undefined ? { code: body.code } : {}),
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.description !== undefined ? { description: body.description || null } : {}),
            ...(body.priceMonthly !== undefined ? { priceMonthly: body.priceMonthly } : {}),
            ...(body.currency !== undefined ? { currency: body.currency } : {}),
            ...(body.features !== undefined ? { features: toJson(body.features) } : {}),
            ...(body.placements !== undefined ? { placements: toJson(body.placements) } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
            ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
    });

    await writeAudit({
        user,
        action: "update",
        entity: "ad_plan",
        entityId: after.id,
        label: `Ad plan — ${after.name}`,
        before: JSON.parse(JSON.stringify(before)) as Record<string, unknown>,
        after: JSON.parse(JSON.stringify(after)) as Record<string, unknown>,
    });

    return ok(serializePlan(after));
});

export const DELETE = withApi<Ctx>(async (req, ctx) => {
    const user = await requireRole(req, STAFF_ROLES);
    const { id } = await ctx.params;
    const before = await findPlan(id);
    await db.adPlan.delete({ where: { id } });
    await writeAudit({
        user,
        action: "delete",
        entity: "ad_plan",
        entityId: id,
        label: `Ad plan — ${before.name}`,
        before: JSON.parse(JSON.stringify(before)) as Record<string, unknown>,
        after: null,
    });
    return ok({ id, deleted: true });
});
