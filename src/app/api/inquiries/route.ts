import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, pagination, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, getSessionUser, requireRole } from "@/lib/auth";
import { inquiryCreateSchema } from "@/lib/validation";
import { serializeInquiry } from "@/app/api/_lib/serialize";

/**
 * /api/inquiries (BUILD CONTRACT §4 — SHARED FILE, resolution documented in §5).
 *
 * POST — public (session optional; a signed-in user's id is attached).
 * GET  — staff only; filters status / type / q (name/email/subject contains),
 * page + limit, sorted createdAt desc. Returns {items,total,page,limit}.
 */

export const POST = withApi(async (req: Request) => {
  const body = inquiryCreateSchema.parse(await readJson(req));
  const user = await getSessionUser(req);

  const inquiry = await db.inquiry.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      type: body.type,
      subject: body.subject ?? null,
      message: body.message,
      userId: user?.id ?? null,
    },
  });

  return ok(serializeInquiry(inquiry), { status: 201 });
});

export const GET = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const sp = new URL(req.url).searchParams;
  const { page, limit, skip } = pagination(sp);

  const where: Prisma.InquiryWhereInput = {};
  const status = sp.get("status");
  if (status) where.status = status;
  const type = sp.get("type");
  if (type) where.type = type;

  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { subject: { contains: q } },
    ];
  }

  const [total, inquiries] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  return ok({ items: inquiries.map(serializeInquiry), total, page, limit });
});
