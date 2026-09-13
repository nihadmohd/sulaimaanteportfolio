import path from "node:path";

/**
 * Shared upload helpers (Task 13-a).
 *
 * UPLOAD_ROOT — the on-disk folder every uploaded image lives in. Sits OUTSIDE
 * /public on purpose: the Next.js standalone build snapshots /public at build
 * time, so files written there post-deploy would 404. /api/media/* streams
 * from UPLOAD_ROOT instead and works identically in dev and production.
 */

export const UPLOAD_ROOT = path.join(process.cwd(), "upload");

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/** Extension for a declared MIME type, falling back to the filename. */
export function uploadMediaType(mime: string, filename: string): string | null {
  const normalized = (mime.split(";")[0] ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  if (map[normalized]) return map[normalized];

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXT.has(ext) ? ext : null;
}

/** Content-Type for a stored upload extension. */
export function uploadContentType(ext: string): string | null {
  return TYPE_BY_EXT[ext.toLowerCase()] ?? null;
}

/**
 * Traversal-safe join. Every segment must be a plain `[a-z0-9-_.]` token and
 * the resolved path must stay inside `base` — otherwise 400 at the caller.
 */
export function uploadSafeJoin(base: string, ...segments: string[]): string {
  const joined = path.resolve(base, ...segments);
  const root = path.resolve(base);
  if (joined !== root && !joined.startsWith(root + path.sep)) {
    throw new Error("Path escapes the upload root.");
  }
  for (const segment of segments) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment)) {
      throw new Error(`Unsafe path segment: ${segment}`);
    }
  }
  return joined;
}
