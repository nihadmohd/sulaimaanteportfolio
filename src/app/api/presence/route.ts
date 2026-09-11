import { ok, withApi } from "@/lib/api-helpers";

/**
 * GET /api/presence — REST polling fallback for the live-visitor badge.
 *
 * Probes the internal presence mini-service (localhost:3003) with a 2s
 * AbortController timeout. The service lands with wave 7-a; until then
 * (or whenever it is down) this resolves {online:null} and the badge
 * hides itself gracefully.
 */

export const GET = withApi(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch("http://localhost:3003/presence", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return ok({ online: null });
    const json: unknown = await res.json();
    let online: number | null = null;
    if (json && typeof json === "object") {
      const direct = (json as { online?: unknown }).online;
      const nested = (json as { data?: { online?: unknown } }).data?.online;
      if (typeof direct === "number") online = Math.max(0, Math.round(direct));
      else if (typeof nested === "number") online = Math.max(0, Math.round(nested));
    }
    return ok({ online });
  } catch {
    return ok({ online: null });
  } finally {
    clearTimeout(timeout);
  }
});
