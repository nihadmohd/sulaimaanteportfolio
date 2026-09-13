import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Uniform API envelope helpers — every route uses these. */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code:
      | "VALIDATION"
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "RATE_LIMIT"
      | "SERVER",
    message: string
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

/** Wrap a route handler with uniform error translation. */
export function withApi<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        return fail(400, "VALIDATION", e.issues[0]?.message ?? "Invalid input.");
      }
      console.error("[api-error]", e);
      return fail(500, "SERVER", "Something went wrong on our end. Please try again.");
    }
  };
}

export function pagination(searchParams: URLSearchParams, defLimit = 12) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit") ?? defLimit) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Parse a JSON body safely (throws 400 VALIDATION on malformed JSON). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "VALIDATION", "Request body must be valid JSON.");
  }
}

/** Derive a lightweight client fingerprint for click/view de-duplication. */
export function clientIpHash(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "0.0.0.0";
  const ip = fwd.split(",")[0].trim();
  let hash = 5381;
  for (let i = 0; i < ip.length; i++) hash = ((hash << 5) + hash + ip.charCodeAt(i)) >>> 0;
  return `h${hash.toString(16)}`;
}

export function deviceFrom(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  const ua = userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}
