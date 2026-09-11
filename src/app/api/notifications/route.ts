import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireUser } from "@/lib/auth";
import { parseSettingObject } from "@/app/api/settings/_lib";
import type { NotificationItem, NotificationsResponse } from "@/types";

/**
 * GET /api/notifications — requireUser (staff + reader variants).
 *
 * Staff (editor/admin):
 *   · latest 10 NEW inquiries          → type "inquiry"
 *   · subscribers confirmed last 7d    → type "subscriber"
 *   · maintenance-mode-on system item  → type "system"
 * Reader/author:
 *   · own latest 10 subscription_events → type "billing"
 *   · verify-email system item while unverified
 *
 * unreadCount = items.length (NotificationBell subtracts locally-seen ids).
 */

const MAX_ITEMS = 12;

const EVENT_LABELS: Record<string, string> = {
  created: "Subscription started",
  plan_changed: "Plan changed",
  interval_changed: "Billing interval changed",
  renewed: "Subscription renewed",
  canceled: "Subscription canceled",
  resumed: "Subscription resumed",
  payment_succeeded: "Payment succeeded",
  payment_failed: "Payment failed",
  payment_pending: "Payment processing",
  trial_ended: "Trial ended",
};

function inr(amount: number): string {
  return `INR ${amount.toLocaleString("en-IN")}`;
}

export const GET = withApi(async (req: Request) => {
  const user = await requireUser(req);
  const isStaff = STAFF_ROLES.includes(user.role);
  const items: NotificationItem[] = [];

  if (isStaff) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [newInquiries, newSubscribers, maintenanceRow] = await Promise.all([
      db.inquiry.findMany({
        where: { status: "new" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.newsletterSubscriber.findMany({
        where: { status: "confirmed", confirmedAt: { gte: weekAgo } },
        orderBy: { confirmedAt: "desc" },
        take: 10,
      }),
      db.siteSetting.findUnique({ where: { key: "maintenance" } }),
    ]);

    for (const inq of newInquiries) {
      items.push({
        id: `inq-${inq.id}`,
        type: "inquiry",
        title: `New ${inq.type} inquiry — ${inq.name}`,
        body: inq.subject || inq.message.slice(0, 80),
        time: inq.createdAt.toISOString(),
        href: "#/admin/inquiries",
      });
    }
    for (const sub of newSubscribers) {
      items.push({
        id: `sub-${sub.id}`,
        type: "subscriber",
        title: "New newsletter subscriber",
        body: sub.email,
        time: (sub.confirmedAt ?? sub.subscribedAt).toISOString(),
        href: "#/admin/subscribers",
      });
    }
    if (maintenanceRow) {
      const maintenance = parseSettingObject(maintenanceRow.value);
      if (maintenance.enabled === true) {
        items.push({
          id: "sys-maintenance",
          type: "system",
          title: "Maintenance mode is ON",
          body:
            typeof maintenance.message === "string"
              ? maintenance.message
              : "The public site is under maintenance.",
          time: maintenanceRow.updatedAt.toISOString(),
          href: "#/admin/settings",
        });
      }
    }
  } else {
    const events = await db.subscriptionEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const evt of events) {
      let planCode: string | null = null;
      try {
        const payload = JSON.parse(evt.payload) as { planCode?: unknown };
        if (typeof payload.planCode === "string") planCode = payload.planCode;
      } catch {
        planCode = null;
      }
      const label = EVENT_LABELS[evt.type] ?? "Billing update";
      const parts: string[] = [];
      if (planCode) parts.push(planCode);
      if (evt.amount != null) parts.push(inr(evt.amount));
      items.push({
        id: `evt-${evt.id}`,
        type: "billing",
        title: label,
        body: parts.length > 0 ? parts.join(" · ") : "Your subscription was updated.",
        time: evt.createdAt.toISOString(),
        href: "#/account/billing",
      });
    }

    if (!user.emailVerified) {
      items.push({
        id: "sys-verify-email",
        type: "system",
        title: "Verify your email address",
        body: "Confirm your email to secure your MN.KP account.",
        time: user.createdAt.toISOString(),
        href: "#/account",
      });
    }
  }

  items.sort((a, b) => (a.time < b.time ? 1 : -1));
  const capped = items.slice(0, MAX_ITEMS);

  const response: NotificationsResponse = { items: capped, unreadCount: capped.length };
  return ok(response);
});
