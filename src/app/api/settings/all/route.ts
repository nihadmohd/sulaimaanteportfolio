import { db } from "@/lib/db";
import { ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import type { JsonRecord } from "@/types";
import {
  SETTING_KEYS,
  asJsonRecord,
  defaultAds,
  defaultAnalytics,
  defaultBrand,
  defaultContact,
  defaultFeatures,
  defaultFooter,
  defaultLocalization,
  defaultMaintenance,
  defaultMedia,
  defaultSeo,
} from "@/app/api/settings/_lib";

/**
 * GET /api/settings/all — ADMIN (STAFF_ROLES).
 *
 * Every site_settings row parsed (nested JSON kept intact), keyed by key.
 * Rows that are missing degrade to the constants.ts defaults so the admin
 * Settings forms always show the platform's effective values.
 */

function defaultForKey(key: string): Record<string, unknown> {
  switch (key) {
    case "brand":
      return defaultBrand() as unknown as Record<string, unknown>;
    case "footer":
      return defaultFooter() as unknown as Record<string, unknown>;
    case "media":
      return defaultMedia() as unknown as Record<string, unknown>;
    case "ads":
      return defaultAds() as unknown as Record<string, unknown>;
    case "features":
      return defaultFeatures() as unknown as Record<string, unknown>;
    case "seo":
      return defaultSeo() as unknown as Record<string, unknown>;
    case "contact":
      return defaultContact() as unknown as Record<string, unknown>;
    case "localization":
      return defaultLocalization() as unknown as Record<string, unknown>;
    case "analytics":
      return defaultAnalytics() as unknown as Record<string, unknown>;
    default:
      return defaultMaintenance() as unknown as Record<string, unknown>;
  }
}

export const GET = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const rows = await db.siteSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const out: Record<string, JsonRecord> = {};
  for (const key of SETTING_KEYS) {
    const row = byKey.get(key);
    if (row) {
      out[key] = asJsonRecord(row.value);
    } else {
      const fallback = defaultForKey(key);
      for (const [k, v] of Object.entries(fallback)) {
        out[key] = out[key] ?? {};
        (out[key] as Record<string, unknown>)[k] = v;
      }
    }
  }

  return ok(out);
});
