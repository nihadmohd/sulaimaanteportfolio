import { withApi } from "@/lib/api-helpers";
import { withSession } from "@/lib/auth";

/**
 * POST /api/auth/logout — clear the session cookie.
 * Returns {ok:true} data payload.
 */
export const POST = withApi(async () => {
  return withSession({ ok: true as const, data: { ok: true } }, null);
});
