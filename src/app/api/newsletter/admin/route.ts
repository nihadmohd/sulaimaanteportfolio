import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, pagination, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import type { NewsletterSource, NewsletterStatus, NewsletterSubscriberDTO } from "@/types";

/**
 * GET /api/newsletter/admin — ADMIN (STAFF_ROLES) subscriber list.
 *
 * Query: q (email contains), status (pending|confirmed|unsubscribed),
 * page (limit 20 default), sorted subscribedAt desc.
 * Returns {items: NewsletterSubscriberDTO[], total, page, limit}.
 */

type SubscriberRow = {
  id: string;
  email: string;
  status: string;
  source: string;
  subscribedAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
};

export function serializeSubscriber(row: SubscriberRow): NewsletterSubscriberDTO {
  return {
    id: row.id,
    email: row.email,
    status: row.status as NewsletterStatus,
    source: row.source as NewsletterSource,
    subscribedAt: row.subscribedAt.toISOString(),
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    unsubscribedAt: row.unsubscribedAt ? row.unsubscribedAt.toISOString() : null,
  };
}

const STATUSES = ["pending", "confirmed", "unsubscribed"];

export const GET = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const sp = new URL(req.url).searchParams;
  const { page, limit, skip } = pagination(sp, 20);

  const where: Prisma.NewsletterSubscriberWhereInput = {};
  const q = sp.get("q")?.trim();
  if (q) where.email = { contains: q };
  const status = sp.get("status");
  if (status && STATUSES.includes(status)) where.status = status;

  const [total, rows] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.findMany({
      where,
      orderBy: { subscribedAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return ok({ items: rows.map(serializeSubscriber), total, page, limit });
});
