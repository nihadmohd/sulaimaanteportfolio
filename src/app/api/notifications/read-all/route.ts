import { ok, withApi } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";

/**
 * POST /api/notifications/read-all — requireUser.
 *
 * Demo-mode dismissal endpoint. Read state is tracked client-side by the
 * NotificationBell (localStorage "mnkp_notif_seen"), so this simply
 * acknowledges the action — a real push/inbox backend replaces it on deploy.
 */

export const POST = withApi(async (req: Request) => {
  await requireUser(req);
  return ok({ ok: true, readAt: new Date().toISOString() });
});
