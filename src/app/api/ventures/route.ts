import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { ventureCreateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { serializeVenture, ventureSlugify, ventureSlugTaken, ventureSnapshot } from "./_lib";

/**
 * GET /api/ventures — public Ventures & Business Ideas feed.
 *   (default)       → every venture with status != "retired"
 *   ?all=1 (staff)  → every venture including retired (Ventures admin list)
 * Ordered sortOrder asc, then createdAt desc. Returns {items, total}.
 */
export const GET = withApi(async (req) => {
  const url = new URL(req.url);
  const wantsAll = url.searchParams.get("all") === "1";

  let where: Prisma.VentureWhereInput = { status: { not: "retired" } };
  if (wantsAll) {
    await requireRole(req, STAFF_ROLES);
    where = {};
  }

  const items = await db.venture.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return ok({ items: items.map(serializeVenture), total: items.length });
});

/**
 * POST /api/ventures — STAFF. Create a venture (Ventures admin "New venture").
 * Slug: explicit or auto-derived from the name; conflicts fail 409 CONFLICT.
 * Writes an audit entry so the creation can be undone.
 */
export const POST = withApi(async (req) => {
  const user = await requireRole(req, STAFF_ROLES);
  const body = ventureCreateSchema.parse(await readJson(req));

  const slug = ventureSlugify(body.slug && body.slug.trim() ? body.slug : body.name);
  if (await ventureSlugTaken(slug)) {
    throw new ApiError(
      409,
      "CONFLICT",
      `A venture with the slug "${slug}" already exists — pick another.`
    );
  }

  const venture = await db.venture.create({
    data: {
      slug,
      name: body.name,
      tagline: body.tagline || null,
      description: body.description || null,
      category: body.category,
      status: body.status,
      location: body.location || null,
      websiteUrl: body.websiteUrl || null,
      imageUrl: body.imageUrl || null,
      highlights: toJson(body.highlights),
      collabRoles: toJson(body.collabRoles),
      sortOrder: body.sortOrder,
      isFeatured: body.isFeatured,
    },
  });

  await writeAudit({
    user,
    action: "create",
    entity: "venture",
    entityId: venture.id,
    label: `Venture — ${venture.name}`,
    before: null,
    after: ventureSnapshot(venture),
  });

  return ok(serializeVenture(venture), { status: 201 });
});
