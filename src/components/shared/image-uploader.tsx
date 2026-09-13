"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Link2,
  Loader2,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { formatBytes, uploadImageFile } from "@/lib/image-tools";
import { cn } from "@/lib/utils";

/**
 * ImageUploader (Task 13-a) — the shared upload widget every editor uses.
 *
 * Solves the product/blog image pain end-to-end:
 *  • drag & drop files straight onto the zone (or click to browse, or paste
 *    an image from the clipboard while the zone is armed);
 *  • every file is resized + re-encoded to WebP in the browser before upload
 *    (≈3–6× smaller, capped at the long edge — see lib/image-tools);
 *  • gallery mode supports drag-to-reorder + arrow buttons (touch friendly);
 *  • external URL entry stays available as a fallback for linked assets;
 *  • per-file upload state, size labels and human error toasts.
 *
 * Controlled components: parents own the value arrays and persist them.
 */

/* ------------------------------------------------------------------ */
/* shared bits                                                          */
/* ------------------------------------------------------------------ */

interface UploadedMeta {
  url: string;
  bytes: number;
}

interface UploadJob {
  id: number;
  preview: string;
  bytes: number;
}

let jobSeq = 0;

function useImageUploads(onDone: (meta: UploadedMeta) => void, opts?: { multiple?: boolean }) {
  const multiple = opts?.multiple ?? false;
  const [jobs, setJobs] = React.useState<UploadJob[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const runFiles = React.useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name)
      );
      if (list.length === 0) {
        toast({
          title: "Not an image",
          description: "Drop a JPG, PNG, WebP, GIF or AVIF file.",
          variant: "destructive",
        });
        return;
      }
      const batch = multiple ? list : list.slice(0, 1);
      for (const file of batch) {
        const id = ++jobSeq;
        const preview = URL.createObjectURL(file);
        setJobs((j) => [...j, { id, preview, bytes: file.size }]);
        void uploadImageFile(file)
          .then((meta) => {
            onDone({ url: meta.url, bytes: meta.bytes });
          })
          .catch((e: Error) => {
            toast({
              title: "Upload failed",
              description: e.message || "That image could not be uploaded.",
              variant: "destructive",
            });
          })
          .finally(() => {
            setJobs((j) => j.filter((job) => job.id !== id));
            URL.revokeObjectURL(preview);
          });
      }
    },
    [multiple, onDone]
  );

  return { jobs, inputRef, runFiles };
}

/** Dashed drop zone with browse + clipboard paste + live upload thumbnails. */
function DropZone({
  label,
  hint,
  jobs,
  inputRef,
  onFiles,
  onUrl,
  urlPlaceholder,
  compact,
  multiple,
}: {
  label: string;
  hint: string;
  jobs: UploadJob[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | File[]) => void;
  onUrl?: (url: string) => void;
  urlPlaceholder?: string;
  compact?: boolean;
  multiple?: boolean;
}) {
  const [armed, setArmed] = React.useState(false);
  const [url, setUrl] = React.useState("");

  const commitUrl = () => {
    const trimmed = url.trim();
    if (!trimmed || !onUrl) return;
    onUrl(trimmed);
    setUrl("");
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} — drop, paste or browse images`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setArmed(true);
        }}
        onDragLeave={() => setArmed(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArmed(false);
          if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            onFiles(e.clipboardData.files);
          }
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "min-h-24 px-3 py-3" : "min-h-32 px-4 py-5",
          armed
            ? "border-gold bg-gold/10"
            : "border-border bg-muted/30 hover:border-gold/50 hover:bg-gold/5"
        )}
      >
        <UploadCloud
          className={cn("text-muted-foreground transition-colors group-hover:text-gold", compact ? "size-5" : "size-7")}
          aria-hidden="true"
        />
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{label}</p>
        <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple={multiple ?? false}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-live="polite">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="relative size-16 overflow-hidden rounded-lg border bg-muted"
            >
              { }
              <img
                src={job.preview}
                alt="Uploading…"
                className="size-full object-cover opacity-60"
              />
              <span className="absolute inset-0 grid place-items-center bg-background/40">
                <Loader2 className="size-4 animate-spin text-gold" aria-hidden="true" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {onUrl ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitUrl();
                }
              }}
              placeholder={urlPlaceholder ?? "…or paste an image URL and press Enter"}
              aria-label="Add an image by URL"
              className="h-9 pl-8 font-mono text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!url.trim()}
            onClick={commitUrl}
          >
            Link it
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SingleImageField — main product image / blog cover / venture image   */
/* ------------------------------------------------------------------ */

export function SingleImageField({
  value,
  onChange,
  label = "Image",
  aspect = "aspect-[4/3]",
  recommended = "1600px long edge — auto-converted to WebP",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  aspect?: string;
  recommended?: string;
}) {
  const { jobs, inputRef, runFiles } = useImageUploads((meta) => {
    onChange(meta.url);
    toast({
      title: "Image uploaded",
      description: `Optimized to ${formatBytes(meta.bytes)} and attached as the ${label.toLowerCase()}.`,
    });
  });

  return (
    <div className="space-y-2.5">
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border bg-muted/40">
          { }
          <img src={value} alt={`${label} preview`} className={cn("w-full object-cover", aspect)} />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 via-background/60 to-transparent px-3 pb-2.5 pt-8">
            <span className="truncate font-mono text-[10px] text-muted-foreground">{value}</span>
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="size-3.5" aria-hidden="true" />
                Replace
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs hover:text-destructive"
                onClick={() => onChange("")}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DropZone
        label={value ? "Replace with a new upload" : `Upload the ${label.toLowerCase()}`}
        hint={`Drop, paste or browse — ${recommended}.`}
        jobs={jobs}
        inputRef={inputRef}
        onFiles={runFiles}
        onUrl={onChange}
        compact={Boolean(value)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GalleryField — multi-image product gallery with reorder              */
/* ------------------------------------------------------------------ */

export function GalleryField({
  value,
  onChange,
  max = 8,
  onMakeMain,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  /** Cap enforced before upload is queued (default 8, matching the API). */
  max?: number;
  /** Optional callback when the owner asks for "use as main image". */
  onMakeMain?: (url: string) => void;
}) {
  const add = React.useCallback(
    (url: string) => {
      onChange([...value, url].slice(0, max));
    },
    [value, onChange, max]
  );

  const addUploaded = React.useCallback((meta: UploadedMeta) => add(meta.url), [add]);
  const { jobs, inputRef, runFiles } = useImageUploads(addUploaded, { multiple: true });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const dragFrom = React.useRef<number | null>(null);

  const remaining = Math.max(0, max - value.length);

  return (
    <div className="space-y-2.5">
      {value.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Gallery images in order">
          {value.map((src, i) => (
            <li
              key={`${src}-${i}`}
              draggable
              onDragStart={() => {
                dragFrom.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom.current != null) move(dragFrom.current, i);
                dragFrom.current = null;
              }}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted/40"
            >
              { }
              <img
                src={src}
                alt={`Gallery image ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="pointer-events-none size-full object-cover"
              />
              <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground backdrop-blur-sm">
                {i + 1}
              </span>
              {onMakeMain ? (
                <button
                  type="button"
                  onClick={() => onMakeMain(src)}
                  title="Use as main image"
                  aria-label={`Use gallery image ${i + 1} as the main image`}
                  className="press-sm absolute right-1.5 top-1.5 grid size-6 place-items-center rounded bg-background/85 text-muted-foreground backdrop-blur-sm transition-colors hover:text-gold"
                >
                  <Star className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                    aria-label={`Move gallery image ${i + 1} earlier`}
                    className="press-sm grid size-6 place-items-center rounded bg-background/85 backdrop-blur-sm disabled:opacity-30"
                  >
                    <ArrowLeft className="size-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={i === value.length - 1}
                    onClick={() => move(i, i + 1)}
                    aria-label={`Move gallery image ${i + 1} later`}
                    className="press-sm grid size-6 place-items-center rounded bg-background/85 backdrop-blur-sm disabled:opacity-30"
                  >
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  aria-label={`Remove gallery image ${i + 1}`}
                  className="press-sm grid size-6 place-items-center rounded bg-background/85 text-destructive backdrop-blur-sm"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No gallery images yet — the main image is used on its own.
        </p>
      )}

      {remaining > 0 ? (
        <DropZone
          label={value.length === 0 ? "Upload gallery images" : "Add more images"}
          hint={`Drop or browse multiple files, or paste an image URL — ${remaining} slot${remaining === 1 ? "" : "s"} left. Drag thumbnails to reorder.`}
          jobs={jobs}
          inputRef={inputRef}
          onFiles={runFiles}
          onUrl={add}
          compact
          multiple
        />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Gallery is full ({max}/{max}) — remove one to add more.
        </p>
      )}
    </div>
  );
}
