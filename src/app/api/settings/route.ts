import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import {
  parseSettingObject,
  resolveAds,
  resolveBrand,
  resolveFooter,
  resolveMaintenance,
  resolveMedia,
} from "@/app/api/settings/_lib";

/**
 * GET /api/settings — PUBLIC sanitized site settings (BUILD CONTRACT §4).
 *
 * Reads the five site_settings rows, merges each over the constants.ts
 * defaults (missing rows / partial values degrade gracefully) and returns
 * {brand, footer, media, ads, maintenance}. The app shell (3-a useSettings)
 * polls this — no secrets live in these blobs by design.
 */

export const GET = withApi(async () => {
  const rows = await db.siteSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return ok({
    brand: resolveBrand(parseSettingObject(byKey.get("brand")?.value)),
    footer: resolveFooter(parseSettingObject(byKey.get("footer")?.value)),
    media: resolveMedia(parseSettingObject(byKey.get("media")?.value)),
    ads: resolveAds(parseSettingObject(byKey.get("ads")?.value)),
    maintenance: resolveMaintenance(parseSettingObject(byKey.get("maintenance")?.value)),
  });
});
