import { db } from "@/lib/db";
import { ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { adPlanCreateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { seedAdPlanDefaultsIfEmpty, serializePlan } from "./_lib";

/**
 * Ad plans — monthly placement packages sold on the public #/advertise
 * page (Task 14). The owner edits prices/features in the Ad Manager.
 *
 * GET  /api/ad-plans        → public: ACTIVE plans, sort order (used by
 *                             #/advertise). Seeds the three defaults the
 *                             first time the table is empty.
 * GET  /api/ad-plans?all=1  → staff: every plan incl. inactive (Ad Manager).
 * POST /api/ad-plans        → staff: create a plan.
 */
export const GET = withApi(async (req: Request) => {
    const wantsAll = new URL(req.url).searchParams.get("all") === "1";
    if (wantsAll) {
        await requireRole(req, STAFF_ROLES);
        const plans = await db.adPlan.findMany({
            orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
        });
        return ok({ items: plans.map(serializePlan) });
    }

    await seedAdPlanDefaultsIfEmpty();
    const plans = await db.adPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
    });
    return ok({ items: plans.map(serializePlan) });
});

export const POST = withApi(async (req: Request) => {
    const user = await requireRole(req, STAFF_ROLES);
    const body = adPlanCreateSchema.parse(await readJson(req));

    const base =
        body.code ??
        body.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40);

    // keep codes unique — append a counter instead of failing the save
    let code = base && base.length >= 3 ? base : `plan-${Date.now().toString(36)}`;
    for (let suffix = 2; (await db.adPlan.findUnique({ where: { code } })) != null; suffix += 1) {
        code = `${base}-${suffix}`;
    }

    const created = await db.adPlan.create({
        data: {
            code,
            name: body.name,
            description: body.description || null,
            priceMonthly: body.priceMonthly,
            currency: body.currency,
            features: toJson(body.features),
            placements: toJson(body.placements),
            isActive: body.isActive,
            isFeatured: body.isFeatured,
            sortOrder: body.sortOrder,
        },
    });

    await writeAudit({
        user,
        action: "create",
        entity: "ad_plan",
        entityId: created.id,
        label: `Ad plan — ${created.name}`,
        before: null,
        after: JSON.parse(JSON.stringify(created)) as Record<string, unknown>,
    });

    return ok(serializePlan(created), { status: 201 });
});
