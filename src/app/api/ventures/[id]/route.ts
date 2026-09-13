import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { ventureUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { writeAudit } from "@/app/api/audit/_lib";
import { serializeVenture, ventureSlugify, ventureSlugTaken, ventureSnapshot } from "../_lib";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function findVenture(id: string) {
  const venture = await db.venture.findUnique({ where: { id } });
  if (!venture) throw new ApiError(404, "NOT_FOUND", "Venture not found.");
  return venture;
}

/** GET /api/ventures/:id — STAFF. Single venture for the editor dialog. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  await requireRole(req, STAFF_ROLES);
  const { id } = await ctx.params;
  return ok(serializeVenture(await findVenture(id)));
});

/**
 * PATCH /api/ventures/:id — STAFF. Partial update incl. the feature toggle.
 * Snapshots before/after for undo/redo; a body containing only isFeatured
 * and/or status keys is logged as a "toggle" so the activity feed reads nicely.
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const user = await requireRole(req, STAFF_ROLES);
  const { id } = await ctx.params;
  const before = await findVenture(id);
  const body = ventureUpdateSchema.parse(await readJson(req));
  const keys = Object.keys(body);

  if (body.slug !== undefined) {
    const slug = ventureSlugify(body.slug.trim() ? body.slug : before.name);
    if (slug !== before.slug && (await ventureSlugTaken(slug, id))) {
      throw new ApiError(
        409,
        "CONFLICT",
        `A venture with the slug "${slug}" already exists — pick another.`
      );
    }
    body.slug = slug;
  }

  const after = await db.venture.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.tagline !== undefined ? { tagline: body.tagline || null } : {}),
      ...(body.description !== undefined ? { description: body.description || null } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.location !== undefined ? { location: body.location || null } : {}),
      ...(body.websiteUrl !== undefined ? { websiteUrl: body.websiteUrl || null } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
      ...(body.highlights !== undefined ? { highlights: toJson(body.highlights) } : {}),
      ...(body.collabRoles !== undefined ? { collabRoles: toJson(body.collabRoles) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
    },
  });

  await writeAudit({
    user,
    action:
      keys.length > 0 && keys.every((k) => k === "isFeatured" || k === "status")
        ? "toggle"
        : "update",
    entity: "venture",
    entityId: after.id,
    label: `Venture — ${after.name}`,
    before: ventureSnapshot(before),
    after: ventureSnapshot(after),
  });

  return ok(serializeVenture(after));
});

/** DELETE /api/ventures/:id — STAFF. Removable via undo (before snapshot kept). */
export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const user = await requireRole(req, STAFF_ROLES);
  const { id } = await ctx.params;
  const before = await findVenture(id);
  await db.venture.delete({ where: { id } });
  await writeAudit({
    user,
    action: "delete",
    entity: "venture",
    entityId: id,
    label: `Venture — ${before.name}`,
    before: ventureSnapshot(before),
    after: null,
  });
  return ok({ id, deleted: true });
});
