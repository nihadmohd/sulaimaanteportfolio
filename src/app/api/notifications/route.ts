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
 *   · verify-email system item while unverified
 *
 * unreadCount = items.length (NotificationBell subtracts locally-seen ids).
 */

const MAX_ITEMS = 12;

export const GET = withApi(async (req: Request) => {
  const user = await requireUser(req);
  const isStaff = STAFF_ROLES.includes(user.role);
  const items: NotificationItem[] = [];

  if (isStaff) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [newInquiries, newSubscribers, maintenanceRow, pendingAds] = await Promise.all([
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
      db.ad.findMany({
        where: { reviewStatus: "pending" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    for (const inq of newInquiries) {
      items.push({
        id: `inq-${inq.id}`,
        type: "inquiry",
        title: `New ${inq.type} inquiry — ${inq.name}`,
        body: inq.subject || inq.message.slice(0, 80),
        time: inq.createdAt.toISOString(),
        href: "/admin/inquiries",
      });
    }
    for (const ad of pendingAds) {
      items.push({
        id: `adrev-${ad.id}`,
        type: "ad_review",
        title: `Ad submission awaiting review — ${ad.name}`,
        body: ad.clientName || ad.clientEmail || "A client submitted an ad for approval.",
        time: ad.createdAt.toISOString(),
        href: "/admin/ads",
      });
    }
    for (const sub of newSubscribers) {
      items.push({
        id: `sub-${sub.id}`,
        type: "subscriber",
        title: "New newsletter subscriber",
        body: sub.email,
        time: (sub.confirmedAt ?? sub.subscribedAt).toISOString(),
        href: "/admin/subscribers",
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
          href: "/admin/settings",
        });
      }
    }
  } else {
    if (!user.emailVerified) {
      items.push({
        id: "sys-verify-email",
        type: "system",
        title: "Verify your email address",
        body: "Confirm your email to secure your MN.KP account.",
        time: user.createdAt.toISOString(),
        href: "/account",
      });
    }
  }

  items.sort((a, b) => (a.time < b.time ? 1 : -1));
  const capped = items.slice(0, MAX_ITEMS);

  const response: NotificationsResponse = { items: capped, unreadCount: capped.length };
  return ok(response);
});
