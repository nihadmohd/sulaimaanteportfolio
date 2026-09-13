"use client";

import * as React from "react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  SquareCode,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { uploadImageFile } from "@/lib/image-tools";
import { cn } from "@/lib/utils";

/**
 * MarkdownToolbar — compact formatting rail for the editor textareas
 * (Task 12-b). A tiny insertMarkdown() utility does all the work against
 * the textarea's selectionStart/selectionEnd:
 *   · wrap          — bold / italic / inline code / links / images
 *   · blockPrefix   — per-line prefixes (## / ### / - / 1. / >)
 *   · blockWrap     — fenced code blocks and dividers on their own lines
 *
 * Task 13-d: the ImagePlus button opens a popover that uploads through
 * /api/upload (browser-side WebP optimization first) or takes a URL, then
 * drops ![alt](url) at the cursor with the same insertMarkdown helper.
 *
 * The bar scrolls horizontally with .no-scrollbar on narrow screens so
 * it never overflows the card at 390px.
 */

export interface MarkdownInsertSpec {
  /** Text placed immediately before the selection (or placeholder). */
  before?: string;
  /** Text placed immediately after the selection (or placeholder). */
  after?: string;
  /** Prefix prepended to every selected line (headings, lists, quotes). */
  blockPrefix?: string;
  /** Ordered-list mode: prefix each line with an incrementing number. */
  numbered?: boolean;
  /** Force the insert onto its own line(s) (code blocks, dividers, images). */
  blockWrap?: boolean;
  /** Replacement text when nothing is selected. */
  placeholder?: string;
}

interface ToolbarButtonSpec extends MarkdownInsertSpec {
  label: string;
  icon: LucideIcon;
  group: number;
  /** Render the upload-image popover right after this button. */
  uploadAfter?: boolean;
}

const TOOLBAR_BUTTONS: ToolbarButtonSpec[] = [
  { label: "Bold", icon: Bold, group: 1, before: "**", after: "**", placeholder: "bold text" },
  { label: "Italic", icon: Italic, group: 1, before: "*", after: "*", placeholder: "italic text" },
  { label: "Heading 2", icon: Heading2, group: 2, blockPrefix: "## " },
  { label: "Heading 3", icon: Heading3, group: 2, blockPrefix: "### " },
  { label: "Link", icon: LinkIcon, group: 3, before: "[", after: "](https://)", placeholder: "link text" },
  { label: "Inline code", icon: Code, group: 3, before: "`", after: "`", placeholder: "code" },
  { label: "Code block", icon: SquareCode, group: 3, before: "```\n", after: "\n```", placeholder: "code", blockWrap: true },
  { label: "Bullet list", icon: List, group: 4, blockPrefix: "- " },
  { label: "Numbered list", icon: ListOrdered, group: 4, numbered: true },
  { label: "Quote", icon: Quote, group: 4, blockPrefix: "> " },
  { label: "Image link", icon: ImageIcon, group: 5, before: "![", after: "](/images/...)", placeholder: "alt text", blockWrap: true, uploadAfter: true },
  { label: "Divider", icon: Minus, group: 5, before: "---\n", after: "", placeholder: "", blockWrap: true },
];

/**
 * Apply one insertion spec to a textarea and report the new value through
 * `onChange` (React controlled flow). Selection is restored via rAF so it
 * lands after the re-render — the cursor then hugs the inserted text.
 */
export function insertMarkdown(
  textarea: HTMLTextAreaElement,
  spec: MarkdownInsertSpec,
  onChange: (value: string) => void
): void {
  const { selectionStart, selectionEnd, value } = textarea;

  // ----- per-line block prefixes (headings, lists, quotes) -----
  if (spec.blockPrefix != null || spec.numbered) {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    let lineEnd = value.indexOf("\n", selectionEnd);
    if (lineEnd === -1) lineEnd = value.length;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const prefixed = lines
      .map((line, i) => {
        if (line.trim() === "") return line; // leave empty lines alone
        const prefix = spec.numbered ? `${i + 1}. ` : (spec.blockPrefix ?? "");
        return line.startsWith(prefix) ? line : prefix + line;
      })
      .join("\n");
    onChange(value.slice(0, lineStart) + prefixed + value.slice(lineEnd));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
    return;
  }

  // ----- inline wraps (bold, italic, code, links, images, dividers) -----
  const selected = value.slice(selectionStart, selectionEnd);
  const inner = selected || spec.placeholder || "";
  let before = spec.before ?? "";
  let after = spec.after ?? "";
  if (spec.blockWrap) {
    if (selectionStart > 0 && value[selectionStart - 1] !== "\n") before = `\n${before}`;
    if (selectionEnd < value.length && value[selectionEnd] !== "\n") after = `${after}\n`;
  }
  const next = value.slice(0, selectionStart) + before + inner + after + value.slice(selectionEnd);
  onChange(next);
  const caretStart = selectionStart + before.length;
  requestAnimationFrame(() => {
    textarea.focus();
    if (inner) textarea.setSelectionRange(caretStart, caretStart + inner.length);
    else textarea.setSelectionRange(caretStart, caretStart);
  });
}

export function MarkdownToolbar({
  textareaRef,
  onChange,
  className,
}: {
  /** Ref of the textarea this toolbar operates on (must be controlled). */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Setter for the textarea's field value (form.setValue etc.). */
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Markdown formatting"
      className={cn(
        "no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border bg-muted/30 p-1",
        className
      )}
    >
      {TOOLBAR_BUTTONS.map((spec, i) => (
        <React.Fragment key={spec.label}>
          {i > 0 && TOOLBAR_BUTTONS[i - 1].group !== spec.group ? (
            <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
          ) : null}
          <button
            type="button"
            title={spec.label}
            aria-label={spec.label}
            onClick={() => {
              const el = textareaRef.current;
              if (el) insertMarkdown(el, spec, onChange);
            }}
            className="press-sm flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <spec.icon className="size-4" aria-hidden="true" />
          </button>
          {spec.uploadAfter ? (
            <ImageUploadButton textareaRef={textareaRef} onChange={onChange} />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ImageUploadButton — upload or link an image, insert ![alt](url)     */
/* ------------------------------------------------------------------ */

function ImageUploadButton({
  textareaRef,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [armed, setArmed] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  /** Drop ![alt](src) at the textarea's saved cursor position. */
  const insert = (src: string) => {
    const el = textareaRef.current;
    if (!el) return;
    insertMarkdown(
      el,
      { before: "![", after: `](${src})`, placeholder: "alt text", blockWrap: true },
      onChange
    );
  };

  const runFile = (file: File) => {
    setBusy(true);
    uploadImageFile(file)
      .then((meta) => {
        insert(meta.url);
        toast({
          title: "Image uploaded",
          description: "Markdown image inserted at the cursor — edit the alt text inline.",
        });
        setOpen(false);
      })
      .catch((e: Error) => {
        toast({
          title: "Upload failed",
          description: e.message || "That image could not be uploaded.",
          variant: "destructive",
        });
      })
      .finally(() => setBusy(false));
  };

  const commitUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    insert(trimmed);
    setUrl("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Upload image"
          aria-label="Upload image"
          disabled={busy}
          className="press-sm flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin text-gold" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-4" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <p className="text-xs font-medium">Insert an image</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Uploads are resized and converted to WebP in your browser first.
        </p>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload an image — drop or browse"
          onClick={() => {
            if (!busy) inputRef.current?.click();
          }}
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
            const file = e.dataTransfer.files[0];
            if (file) runFile(file);
          }}
          className={cn(
            "mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            armed ? "border-gold bg-gold/10" : "border-border bg-muted/30 hover:border-gold/50"
          )}
        >
          <UploadCloud className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-medium">Drop an image or click to browse</p>
          <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP, GIF or AVIF</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) runFile(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitUrl();
              }
            }}
            placeholder="…or paste an image URL"
            aria-label="Image URL"
            className="h-8 font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!url.trim()}
            onClick={commitUrl}
          >
            Insert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
