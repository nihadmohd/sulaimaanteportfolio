import { db } from "@/lib/db";
import { toJson } from "@/types";
import type { AdPlanDTO } from "@/types";
import type { AdPlan } from "@prisma/client";

/** Shared helpers for the /api/ad-plans routes (private folder — not a route). */

export function serializePlan(plan: AdPlan): AdPlanDTO {
    return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        currency: plan.currency,
        features: JSON.parse(plan.features || "[]") as string[],
        placements: JSON.parse(plan.placements || "[]") as AdPlanDTO["placements"],
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
        sortOrder: plan.sortOrder,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
    };
}

/** Starter catalog — inserted once when the table is completely empty. */
export async function seedAdPlanDefaultsIfEmpty(): Promise<void> {
    const count = await db.adPlan.count();
    if (count > 0) return;
    await db.adPlan.createMany({
        data: [
            {
                code: "starter",
                name: "Starter",
                description: "Marquee mention + between-cards placement across the blog.",
                priceMonthly: 499,
                features: toJson([
                    "Scrolling marquee mention",
                    "Between-cards ad slot",
                    "Monthly performance email",
                ]),
                placements: toJson(["marquee", "between-cards"]),
                sortOrder: 1,
            },
            {
                code: "growth",
                name: "Growth",
                description: "Header banner + blog inline placements on every page.",
                priceMonthly: 1499,
                features: toJson([
                    "Slim header banner on all pages",
                    "Mid-article inline block",
                    "Click + impression reporting",
                    "Priority email support",
                ]),
                placements: toJson(["header-banner", "blog-inline", "between-cards"]),
                isFeatured: true,
                sortOrder: 2,
            },
            {
                code: "brand",
                name: "Brand",
                description: "Premium homepage strip + hero marquee — maximum reach.",
                priceMonthly: 4999,
                features: toJson([
                    "Full-width homepage strip",
                    "Premium hero marquee lane",
                    "Store sidebar placement",
                    "Dedicated account manager",
                    "Custom creatives made for you",
                ]),
                placements: toJson([
                    "home-strip",
                    "hero-marquee",
                    "store-side",
                    "footer-banner",
                    "header-banner",
                ]),
                sortOrder: 3,
            },
        ],
    });
}
