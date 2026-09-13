"use client";

/**
 * image-tools — client-side image pipeline (Task 13-a).
 *
 * Every image uploaded through the admin editors is resized and re-encoded
 * to WebP in the browser before it ever hits the network:
 *   • long edge clamped to `maxDim` (default 1600px) — sharp on retina,
 *     tiny on disk;
 *   • WebP quality 0.85 — typically 3–6× smaller than the source JPEG/PNG;
 *   • animated GIFs are passed through untouched (canvas would flatten them);
 *   • if the WebP somehow ends up LARGER than the original, the original is
 *     kept (never pay for a worse file).
 *
 * The result is a `File` ready for /api/upload plus its measured dimensions.
 */

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
  /** True when the original bytes were kept (gif passthrough / better size). */
  passthrough: boolean;
  previewUrl: string;
}

export interface PrepareOptions {
  maxDim?: number;
  quality?: number;
}

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.85;

/** Decode a File/Blob into an <img> element with intrinsic size. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.decoding = "async";
    img.src = url;
    // Revoke once the bitmap is safe (element keeps its own reference).
    img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  });
}

/**
 * Resize + re-encode one image file to WebP.
 * Throws on decode failure — callers surface the message in a toast.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareOptions = {}
): Promise<PreparedImage> {
  const maxDim = options.maxDim ?? DEFAULT_MAX_DIM;
  const quality = options.quality ?? DEFAULT_QUALITY;

  // Animated GIFs must keep their frames — no canvas round-trip.
  if (file.type === "image/gif") {
    const gif = await loadImage(file);
    return {
      file,
      width: gif.naturalWidth,
      height: gif.naturalHeight,
      passthrough: true,
      previewUrl: URL.createObjectURL(file),
    };
  }

  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create a canvas.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (!blob) throw new Error("WebP encoding failed. Try a different image.");

  // Keep whichever artifact is smaller.
  const useOriginal = blob.size >= file.size && file.size > 0 && file.type === "image/webp";
  const finalFile = useOriginal
    ? file
    : new File([blob], replaceExt(file.name, "webp"), { type: "image/webp" });

  return {
    file: finalFile,
    width,
    height,
    passthrough: useOriginal,
    previewUrl: URL.createObjectURL(finalFile),
  };
}

function replaceExt(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "").slice(0, 60) || "image";
  return `${base}.${ext}`;
}

/** Human label for a byte count (used in upload UIs). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload response shape from POST /api/upload. */
export interface UploadedImage {
  url: string;
  bytes: number;
  type: string;
  width: number | null;
  height: number | null;
  name: string;
}

/**
 * Prepare + upload one file. Returns the public URL it now lives at.
 * Uses raw fetch (NOT apiFetch) because FormData must not get a JSON
 * Content-Type.
 */
export async function uploadImageFile(
  file: File,
  options?: PrepareOptions
): Promise<UploadedImage> {
  const prepared = await prepareImageForUpload(file, options);
  const form = new FormData();
  form.set("file", prepared.file);
  if (prepared.width > 0) form.set("width", String(prepared.width));
  if (prepared.height > 0) form.set("height", String(prepared.height));

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
    credentials: "include",
  });

  interface UploadEnvelope {
    ok?: boolean;
    data?: UploadedImage;
    error?: { message?: string };
  }
  let json: UploadEnvelope | null = null;
  try {
    json = (await res.json()) as UploadEnvelope | null;
  } catch {
    json = null;
  }
  if (!res.ok || !json?.ok || !json.data) {
    throw new Error(json?.error?.message ?? "Upload failed. Please try again.");
  }
  URL.revokeObjectURL(prepared.previewUrl);
  return json.data;
}
