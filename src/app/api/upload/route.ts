import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, ok, withApi } from "@/lib/api-helpers";
import { STAFF_ROLES, requireRole } from "@/lib/auth";
import { UPLOAD_ROOT, uploadMediaType, uploadSafeJoin } from "@/app/api/_lib/uploads";

/**
 * POST /api/upload — staff image upload (Task 13-a).
 *
 * Solves the #1 content pain point: product/blog/marquee images can now be
 * uploaded directly instead of pasting external URLs.
 *
 * - multipart/form-data with a single `file` field (image/*, ≤ 8 MB).
 * - Optional `width` / `height` fields let the client echo measured
 *   dimensions back for instant previews without a server-side decoder.
 * - Stored under <project>/upload/YYYY/MM/<random-hex>.<ext>; served
 *   publicly (immutable cache) from /api/media/YYYY/MM/<name>.
 * - Filenames are server-generated (random) — no user-controlled path
 *   segments, no traversal, no extension guessing beyond a fixed allowlist.
 */

const MAX_BYTES = 8 * 1024 * 1024;

export const POST = withApi(async (req: Request) => {
  await requireRole(req, STAFF_ROLES);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new ApiError(400, "VALIDATION", "Expected a multipart/form-data upload.");
  }

  const form = await req.formData().catch(() => {
    throw new ApiError(400, "VALIDATION", "Could not read the upload form data.");
  });

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "VALIDATION", "Attach an image in the 'file' field.");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new ApiError(400, "VALIDATION", "Image must be between 1 byte and 8 MB.");
  }

  const ext = uploadMediaType(file.type, file.name);
  if (!ext) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Unsupported image type. Use JPG, PNG, WebP, GIF or AVIF."
    );
  }

  // Magic-byte sniff — never trust the declared MIME alone.
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(bytes.subarray(0, 16), ext)) {
    throw new ApiError(400, "VALIDATION", "That file does not look like a real image.");
  }

  const now = new Date();
  const dir = path.join(
    UPLOAD_ROOT,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0")
  );
  const name = `${randomBytes(9).toString("hex")}.${ext}`;
  const dest = uploadSafeJoin(dir, name);

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);

  const url = `/api/media/${path.relative(UPLOAD_ROOT, dest).split(path.sep).join("/")}`;

  const width = clampInt(form.get("width"));
  const height = clampInt(form.get("height"));

  return ok(
    {
      url,
      bytes: file.size,
      type: file.type || `image/${ext}`,
      width,
      height,
      name: file.name,
    },
    { status: 201 }
  );
});

function clampInt(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 20000) return null;
  return Math.round(n);
}

/** Minimal magic-byte check per format family. */
function sniffImage(head: Buffer, ext: string): boolean {
  switch (ext) {
    case "jpg":
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case "png":
      return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    case "gif":
      return head.subarray(0, 3).toString("ascii") === "GIF";
    case "webp":
      return (
        head.subarray(0, 4).toString("ascii") === "RIFF" &&
        head.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "avif":
      return head.subarray(4, 8).toString("ascii") === "ftyp";
    default:
      return false;
  }
}
