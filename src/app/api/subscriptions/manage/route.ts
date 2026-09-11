import type { Plan, Subscription, SubscriptionEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { subscriptionManageSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { toJson } from "@/types";
import { ACTIVE_SUB_STATUSES, intervalDays, priceFor, toEventDTO, toSubscriptionDTO } from "../_lib";

/**
 * POST /api/subscriptions/manage — the mock billing state machine.
 *
 * Body: {action: change|cancel|resume|renew|simulate, planCode?, interval?,
 *        paymentOutcome?} → {subscription (with plan), event}.
 *
 * Rules (worklog 5-a documents the ambiguous readings):
 * - ONE active subscription per user (trialing/active/past_due) — enforced here.
 * - change:   plan required; creates (event "created", Visa/4242 mock card) or
 *             updates (event "plan_changed" {from,to}); then a payment event
 *             per outcome — success→active, failed→past_due, pending→trialing.
 *             Period restarts at now + 30/365d.
 * - cancel:   cancelAtPeriodEnd=true + canceledAt=now; status untouched.
 * - resume:   clears the cancellation markers.
 * - renew:    success extends the period and re-activates; failed/pending flip
 *             status without extending (payment still outstanding).
 * - simulate: outcome required — failed→past_due, pending→trialing,
 *             success→active + period extension.
 * - Every event payload carries {planCode, interval, outcome}; amounts are
 *   plain INR numbers from the plan row.
 */

type PaymentOutcome = "success" | "failed" | "pending";

const DAY_MS = 86_400_000;

function paymentEventType(outcome: PaymentOutcome): string {
  if (outcome === "failed") return "payment_failed";
  if (outcome === "pending") return "payment_pending";
  return "payment_succeeded";
}

async function logEvent(
  sub: Subscription,
  type: string,
  amount: number | null,
  payload: Record<string, unknown>
): Promise<SubscriptionEvent> {
  return db.subscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      userId: sub.userId,
      type,
      amount,
      currency: "INR",
      payload: toJson(payload),
    },
  });
}

export const POST = withApi(async (req) => {
  const user = await requireUser(req);
  const input = subscriptionManageSchema.parse(await readJson(req));
  const now = new Date();

  const existing = await db.subscription.findFirst({
    where: { userId: user.id, status: { in: [...ACTIVE_SUB_STATUSES] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  let sub: Subscription & { plan: Plan } | null = existing;
  let lastEvent: SubscriptionEvent | null = null;

  if (input.action === "change") {
    if (!input.planCode) {
      throw new ApiError(400, "VALIDATION", "Choose a plan to switch to.");
    }
    const plan = await db.plan.findFirst({ where: { code: input.planCode, isActive: true } });
    if (!plan) {
      throw new ApiError(404, "NOT_FOUND", "That plan is not available.");
    }
    const interval = input.interval ?? "monthly";
    const outcome: PaymentOutcome = input.paymentOutcome ?? "success";
    const amount = priceFor(plan, interval);
    const periodEnd = new Date(now.getTime() + intervalDays(interval) * DAY_MS);
    const status = outcome === "failed" ? "past_due" : outcome === "pending" ? "trialing" : "active";
    const basePayload = { planCode: plan.code, interval, outcome };

    if (existing) {
      const from = existing.plan.code;
      sub = await db.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          billingInterval: interval,
          status,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        include: { plan: true },
      });
      await logEvent(sub, "plan_changed", amount, { ...basePayload, from, to: plan.code });
    } else {
      sub = await db.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          billingInterval: interval,
          status,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          paymentBrand: "Visa",
          paymentLast4: "4242",
        },
        include: { plan: true },
      });
      await logEvent(sub, "created", amount, { ...basePayload, from: null, to: plan.code });
    }
    lastEvent = await logEvent(sub, paymentEventType(outcome), amount, {
      ...basePayload,
      brand: sub.paymentBrand,
      last4: sub.paymentLast4,
    });
  } else if (input.action === "cancel") {
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "You do not have an active subscription to cancel.");
    }
    sub = await db.subscription.update({
      where: { id: existing.id },
      data: { cancelAtPeriodEnd: true, canceledAt: now },
      include: { plan: true },
    });
    lastEvent = await logEvent(sub, "canceled", null, {
      planCode: existing.plan.code,
      interval: existing.billingInterval,
      outcome: input.paymentOutcome ?? "success",
    });
  } else if (input.action === "resume") {
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "You do not have a subscription to resume.");
    }
    sub = await db.subscription.update({
      where: { id: existing.id },
      data: { cancelAtPeriodEnd: false, canceledAt: null },
      include: { plan: true },
    });
    lastEvent = await logEvent(sub, "resumed", null, {
      planCode: existing.plan.code,
      interval: existing.billingInterval,
      outcome: input.paymentOutcome ?? "success",
    });
  } else if (input.action === "renew") {
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "You do not have a subscription to renew.");
    }
    const interval = existing.billingInterval;
    const outcome: PaymentOutcome = input.paymentOutcome ?? "success";
    const amount = priceFor(existing.plan, interval);
    const basePayload = { planCode: existing.plan.code, interval, outcome };

    if (outcome === "success") {
      const base = existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
      sub = await db.subscription.update({
        where: { id: existing.id },
        data: {
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: new Date(base.getTime() + intervalDays(interval) * DAY_MS),
        },
        include: { plan: true },
      });
    } else {
      sub = await db.subscription.update({
        where: { id: existing.id },
        data: { status: outcome === "failed" ? "past_due" : "trialing" },
        include: { plan: true },
      });
    }
    await logEvent(sub, "renewed", amount, {
      ...basePayload,
      extendedDays: outcome === "success" ? intervalDays(interval) : 0,
    });
    lastEvent = await logEvent(sub, paymentEventType(outcome), amount, {
      ...basePayload,
      brand: existing.paymentBrand,
      last4: existing.paymentLast4,
    });
  } else {
    // simulate
    if (!input.paymentOutcome) {
      throw new ApiError(400, "VALIDATION", "Choose a payment outcome to simulate.");
    }
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "You do not have a subscription to simulate payments on.");
    }
    const interval = existing.billingInterval;
    const amount = priceFor(existing.plan, interval);
    const basePayload = { planCode: existing.plan.code, interval, outcome: input.paymentOutcome };

    if (input.paymentOutcome === "success") {
      const base = existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
      sub = await db.subscription.update({
        where: { id: existing.id },
        data: {
          status: "active",
          currentPeriodEnd: new Date(base.getTime() + intervalDays(interval) * DAY_MS),
        },
        include: { plan: true },
      });
    } else {
      sub = await db.subscription.update({
        where: { id: existing.id },
        data: { status: input.paymentOutcome === "failed" ? "past_due" : "trialing" },
        include: { plan: true },
      });
    }
    lastEvent = await logEvent(sub, paymentEventType(input.paymentOutcome), amount, {
      ...basePayload,
      brand: existing.paymentBrand,
      last4: existing.paymentLast4,
    });
  }

  if (!sub || !lastEvent) {
    throw new ApiError(500, "SERVER", "The billing action did not complete. Please try again.");
  }

  return ok({ subscription: toSubscriptionDTO(sub), event: toEventDTO(lastEvent) });
});
