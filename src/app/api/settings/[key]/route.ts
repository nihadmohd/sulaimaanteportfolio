import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { settingsUpdateSchema } from "@/lib/validation";
import { toJson } from "@/types";
import { SETTING_KEYS, asJsonRecord, parseSettingObject, type SettingKey } from "@/app/api/settings/_lib";

/**
 * PATCH /api/settings/:key — ADMIN (STAFF_ROLES).
 *
 * Upserts one site_settings row. Keys are limited to the five managed
 * groups (brand/footer/media/ads/maintenance); value must be a JSON object
 * (settingsUpdateSchema). updatedBy tracks the acting admin. Returns the
 * stored value parsed back into JSON.
 */

interface Ctx {
  params: Promise<{ key: string }>;
}

const KEY_SET = new Set<string>(SETTING_KEYS);

export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const { key } = await ctx.params;
  if (!KEY_SET.has(key)) {
    throw new ApiError(
      400,
      "VALIDATION",
      `Unknown settings key "${key}". Allowed: ${SETTING_KEYS.join(", ")}.`
    );
  }

  const user = await requireRole(req, STAFF_ROLES);
  const body = settingsUpdateSchema.parse(await readJson(req));

  await db.siteSetting.upsert({
    where: { key },
    update: { value: toJson(body.value), updatedBy: user.id },
    create: { key, value: toJson(body.value), updatedBy: user.id },
  });

  return ok({ key: key as SettingKey, value: parseSettingObject(toJson(body.value)) });
});

export const GET = withApi<Ctx>(async (req, ctx) => {
  await requireRole(req, STAFF_ROLES);
  const { key } = await ctx.params;
  if (!KEY_SET.has(key)) {
    throw new ApiError(404, "NOT_FOUND", `Unknown settings key "${key}".`);
  }
  const row = await db.siteSetting.findUnique({ where: { key } });
  return ok({ key, value: asJsonRecord(row?.value), updatedAt: row?.updatedAt?.toISOString() ?? null });
});
