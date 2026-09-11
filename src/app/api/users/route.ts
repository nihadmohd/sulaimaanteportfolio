import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, pagination, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { serializeUser, USER_ROLES } from "@/app/api/users/_lib";

/**
 * GET /api/users — ADMIN (STAFF_ROLES) user directory.
 *
 * Query: q (fullName/email/displayName contains), role (reader|author|
 * editor|admin), page (limit 20 default), sorted createdAt desc.
 * Returns {items: SafeUser[], total, page, limit}.
 */

export const GET = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const sp = new URL(req.url).searchParams;
  const { page, limit, skip } = pagination(sp, 20);

  const where: Prisma.UserWhereInput = {};

  const role = sp.get("role");
  if (role && (USER_ROLES as string[]).includes(role)) {
    where.role = role;
  }

  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { email: { contains: q } },
      { displayName: { contains: q } },
    ];
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  return ok({ items: users.map(serializeUser), total, page, limit });
});
