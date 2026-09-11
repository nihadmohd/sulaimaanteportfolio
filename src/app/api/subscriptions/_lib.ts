import type { Plan, Subscription, SubscriptionEvent } from "@prisma/client";
import {
  parseJsonArray,
  parseJsonRecord,
  type PlanDTO,
  type SubscriptionDTO,
  type SubscriptionEventDTO,
} from "@/types";

/**
 * Serializers for the mock-billing API surface (5-a owned).
 * NOTE: "payment_pending" is a 5-a event type not present in the
 * SubscriptionEventType union yet — cast locally (see worklog 5-a).
 */

/** Statuses that count as "one active subscription" per user. */
export const ACTIVE_SUB_STATUSES = ["trialing", "active", "past_due"] as const;

/** Interval → period length in days (mock billing: 30 / 365). */
export function intervalDays(interval: string): number {
  return interval === "yearly" ? 365 : 30;
}

/** Price for the interval, INR number straight off the plan row. */
export function priceFor(plan: Plan, interval: string): number {
  return interval === "yearly" ? plan.priceYearly : plan.priceMonthly;
}

/** Parse a SubscriptionEvent.payload JSON column (loose: values keep types). */
function parsePayload(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallthrough
  }
  return {};
}

/** Plan row → PlanDTO (features/limits parsed). */
export function toPlanDTO(plan: Plan): PlanDTO {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    features: parseJsonArray(plan.features),
    limits: parseJsonRecord(plan.limits),
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    sortOrder: plan.sortOrder,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/** Subscription row (with joined plan) → SubscriptionDTO. */
export function toSubscriptionDTO(sub: Subscription & { plan: Plan }): SubscriptionDTO {
  return {
    id: sub.id,
    userId: sub.userId,
    planId: sub.planId,
    billingInterval: sub.billingInterval as SubscriptionDTO["billingInterval"],
    status: sub.status as SubscriptionDTO["status"],
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: sub.canceledAt ? sub.canceledAt.toISOString() : null,
    paymentBrand: sub.paymentBrand,
    paymentLast4: sub.paymentLast4,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
    plan: toPlanDTO(sub.plan),
  };
}

/** SubscriptionEvent row → SubscriptionEventDTO (payload parsed). */
export function toEventDTO(event: SubscriptionEvent): SubscriptionEventDTO {
  return {
    id: event.id,
    subscriptionId: event.subscriptionId,
    userId: event.userId,
    type: event.type as SubscriptionEventDTO["type"],
    amount: event.amount,
    currency: event.currency,
    payload: parsePayload(event.payload),
    createdAt: event.createdAt.toISOString(),
  };
}
