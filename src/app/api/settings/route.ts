import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import {
  parseSettingObject,
  resolveAds,
  resolveBrand,
  resolveFeatures,
  resolveFooter,
  resolveMaintenance,
  resolveMedia,
  resolveSeo,
} from "@/app/api/settings/_lib";

/**
 * GET /api/settings — PUBLIC sanitized site settings (BUILD CONTRACT §4).
 *
 * Reads the site_settings rows, merges each over the constants.ts defaults
 * (missing rows / partial values degrade gracefully) and returns
 * {brand, footer, media, ads, features, seo, maintenance}. The app shell
 * (useSettings) polls this — no secrets live in these blobs by design.
 */

export const GET = withApi(async () => {
  const rows = await db.siteSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return ok({
    brand: resolveBrand(parseSettingObject(byKey.get("brand")?.value)),
    footer: resolveFooter(parseSettingObject(byKey.get("footer")?.value)),
    media: resolveMedia(parseSettingObject(byKey.get("media")?.value)),
    ads: resolveAds(parseSettingObject(byKey.get("ads")?.value)),
    features: resolveFeatures(parseSettingObject(byKey.get("features")?.value)),
    seo: resolveSeo(parseSettingObject(byKey.get("seo")?.value)),
    maintenance: resolveMaintenance(parseSettingObject(byKey.get("maintenance")?.value)),
  });
});
