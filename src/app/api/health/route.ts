import { ok, withApi } from "@/lib/api-helpers";

/**
 * GET /api/health — liveness probe.
 */

export const GET = withApi(async () => {
  return ok({
    ok: true,
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});
