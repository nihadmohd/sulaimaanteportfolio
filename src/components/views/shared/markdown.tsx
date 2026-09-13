"use client";

import * as React from "react";
import type { Components } from "react-markdown";
import { Check, Copy } from "lucide-react";
import { ALink } from "@/components/router/link";
import { LoadingState } from "@/components/states/loading";
import { useToast } from "@/hooks/use-toast";

/**
 * Shared lazy markdown renderer for 4-a views (post-view + product-view).
 *
 * react-markdown + remark-gfm are HEAVY — they are dynamically imported
 * inside the lazy component below so they never land in the initial view
 * chunk (BUILD CONTRACT §9). Styling is done via custom renderers because
 * @tailwindcss/typography is not available in this project.
 */

export function slugText(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

/** Flatten React children into plain text (for heading ids). */
export function childText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return childText(node.props.children);
  }
  return "";
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h2 className="mt-10 scroll-mt-28 border-b border-gold/30 pb-2 text-2xl font-semibold tracking-tight md:text-3xl">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2
      id={slugText(childText(children))}
      className="mt-10 scroll-mt-28 border-b border-gold/30 pb-2 text-2xl font-semibold tracking-tight md:text-3xl"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={slugText(childText(children))}
      className="mt-8 scroll-mt-28 text-xl font-semibold tracking-tight md:text-2xl"
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 scroll-mt-28 text-lg font-semibold tracking-tight">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-4 text-pretty text-[15px] leading-7 text-foreground/80 md:text-base md:leading-8">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pl-6 marker:text-gold">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-gold">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[15px] leading-7 text-foreground/80 md:text-base">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-5 rounded-r-lg border-l-4 border-gold bg-primary/[0.06] px-4 py-3 md:px-5 md:py-4 [&>p]:my-2 [&>p]:font-medium [&>p]:text-foreground/90">
      {children}
    </blockquote>
  ),
  img: ({ src, alt }) =>
    src ? (
      <img
        src={typeof src === "string" ? src : ""}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="my-5 max-w-full rounded-xl border"
      />
    ) : null,
  a: ({ href, children }) => {
    if (!href) return <>{children}</>;
    if (href.startsWith("#/")) {
      return (
        <ALink href={href} className="font-medium text-primary underline-offset-2 hover:underline">
          {children}
        </ALink>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        {children}
      </a>
    );
  },
  code: ({ className, children }) => {
    const isBlock =
      (typeof className === "string" && className.startsWith("language-")) ||
      String(children).includes("\n");
    if (isBlock) {
      return <code className="font-mono text-[13px] leading-relaxed">{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-primary">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b px-3 py-2.5 text-left font-semibold tracking-tight">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b px-3 py-2.5 align-top text-foreground/80">{children}</td>
  ),
  hr: () => <hr className="gold-rule my-8 w-full" />,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
};

export interface MarkdownBlockProps {
  content: string;
}

/* ------------------------------------------------------------------ */
/* code block copy button (12-a — additive)                           */
/* ------------------------------------------------------------------ */

/**
 * pre renderer with a top-right copy button. The wrapper carries the old
 * pre margins; the copy button is always visible (subtle) on touch screens
 * and fades in on hover / keyboard focus on md+. Additive — the exported
 * markdown API is unchanged.
 */
function CodeBlock({ children }: { children?: React.ReactNode }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const preRef = React.useRef<HTMLPreElement | null>(null);
  const timerRef = React.useRef(0);

  React.useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copyCode = async () => {
    const text = preRef.current?.querySelector("code")?.textContent ?? preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
      toast({ title: "Code copied", description: "The code block is on your clipboard." });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select the code and copy it manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="group relative my-5">
      <pre
        ref={preRef}
        className="overflow-x-auto rounded-xl border bg-muted p-4 font-mono text-sm leading-relaxed"
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={copyCode}
        aria-label="Copy code to clipboard"
        className="press-sm absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-lg border border-gold/30 bg-card/90 text-muted-foreground shadow-xs backdrop-blur-sm transition-all hover:border-gold/60 hover:text-gold focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        {copied ? (
          <Check className="size-3.5 text-primary" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** Lazy renderer — the markdown stack loads only when first rendered. */
export const MarkdownBlock = React.lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ]);
  const Component = ({ content }: MarkdownBlockProps) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
  return { default: Component };
});

/** Suspense fallback preset for the lazy markdown block. */
export function MarkdownFallback() {
  return <LoadingState variant="spinner" label="Rendering article" />;
}
