import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { ACTIVE_SUB_STATUSES, toEventDTO, toPlanDTO, toSubscriptionDTO } from "./_lib";

/**
 * GET /api/subscriptions — billing surface for the signed-in user:
 * {plans: active plans ordered by sortOrder, current: subscription+plan|null,
 *  history: latest 20 subscription events, newest first}.
 * All JSON columns (features/limits/payload) are parsed before leaving.
 */
export const GET = withApi(async (req) => {
  const user = await requireUser(req);

  const [plans, current, history] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findFirst({
      where: { userId: user.id, status: { in: [...ACTIVE_SUB_STATUSES] } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    db.subscriptionEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return ok({
    plans: plans.map(toPlanDTO),
    current: current ? toSubscriptionDTO(current) : null,
    history: history.map(toEventDTO),
  });
});
