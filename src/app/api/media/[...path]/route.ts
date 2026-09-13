import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ApiError, withApi } from "@/lib/api-helpers";
import { UPLOAD_ROOT, uploadContentType, uploadSafeJoin } from "@/app/api/_lib/uploads";

/**
 * GET /api/media/:year/:month/:file — public immutable serving of uploaded
 * images (Task 13-a).
 *
 * Random filenames make every URL content-addressed in practice, so responses
 * are cacheable for a year. Sits outside /public so it survives the
 * standalone build snapshot.
 */

interface Ctx {
  params: Promise<{ path: string[] }>;
}

export const GET = withApi<Ctx>(async (_req, ctx) => {
  const { path: segments } = await ctx.params;
  if (!segments || segments.length === 0 || segments.length > 4) {
    throw new ApiError(404, "NOT_FOUND", "Media not found.");
  }

  const ext = segments[segments.length - 1].split(".").pop() ?? "";
  const contentType = uploadContentType(ext);
  if (!contentType) {
    throw new ApiError(404, "NOT_FOUND", "Media not found.");
  }

  let absolute: string;
  try {
    absolute = uploadSafeJoin(UPLOAD_ROOT, ...segments);
  } catch {
    throw new ApiError(404, "NOT_FOUND", "Media not found.");
  }

  const info = await stat(absolute).catch(() => null);
  if (!info || !info.isFile()) {
    throw new ApiError(404, "NOT_FOUND", "Media not found.");
  }

  const bytes = await readFile(absolute);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Uploaded images are embedded cross-origin (Vercel domain, custom
      // domains, local previews) — allow it without CORS surprises.
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// Mark the route as dynamically rendered (fs read per request).
export const dynamic = "force-dynamic";
