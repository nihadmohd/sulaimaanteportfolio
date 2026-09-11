"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  ChevronDown,
  FileJson2,
  PackageCheck,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, useAdminGuard } from "./_shared";

/**
 * Import Content (#/admin/import — route key "admin-import").
 * Migration path for bringing old-site (mohdnihadkp.vercel.app) posts and
 * products into MN.KP: paste a JSON array → validate → POST /api/import.
 * Slug collisions are skipped/renamed server-side — re-runs are safe.
 */

interface ImportSummary {
  posts: { received: number; created: number; skipped: string[] };
  products: { received: number; created: number; skipped: string[] };
  createdPosts: string[];
  createdProducts: string[];
  errors: string[];
}

type ValidationResult = { ok: true; count: number } | { ok: false; error: string } | null;

const POSTS_EXAMPLE = `[
  {
    "title": "My old blog post",
    "slug": "my-old-blog-post",
    "excerpt": "One-line summary of the post",
    "content": "Full markdown body of the post...",
    "coverImageUrl": "https://mohdnihadkp.vercel.app/images/cover.jpg",
    "tags": ["ai", "freelancing"],
    "status": "published",
    "publishedAt": "2024-06-01T10:00:00.000Z",
    "seoTitle": "My old blog post — SEO title",
    "seoDescription": "Meta description up to 180 chars",
    "canonicalUrl": "https://mohdnihadkp.vercel.app/blog/my-old-blog-post"
  }
]`;

const PRODUCTS_EXAMPLE = `[
  {
    "name": "Sony WH-1000XM5",
    "slug": "sony-wh-1000xm5",
    "tagline": "Best noise-cancelling headphones",
    "description": "Markdown description of the product...",
    "brand": "Sony",
    "merchant": "Amazon",
    "imageUrl": "https://mohdnihadkp.vercel.app/images/xm5.jpg",
    "price": 29990,
    "compareAtPrice": 34990,
    "affiliateUrl": "https://www.amazon.in/dp/B09XS7JWHH",
    "rating": 4.7,
    "status": "active",
    "isFeatured": false,
    "pros": ["Class-leading ANC", "30h battery"],
    "cons": ["Pricey"]
  }
]`;

const POSTS_FIELDS: Array<[string, string]> = [
  ["title *", "4–140 chars"],
  ["slug", "optional — auto-generated from title"],
  ["excerpt", "≤ 300 chars"],
  ["content *", "markdown body"],
  ["coverImageUrl", "optional image URL"],
  ["tags", "string array, max 10"],
  ["status", "draft | published | archived"],
  ["publishedAt", "ISO date (published only)"],
  ["seoTitle / seoDescription", "≤ 70 / ≤ 180 chars"],
  ["canonicalUrl", "point at the old post URL"],
];

const PRODUCTS_FIELDS: Array<[string, string]> = [
  ["name *", "3–140 chars"],
  ["slug", "optional — auto-generated from name"],
  ["tagline", "≤ 160 chars"],
  ["description", "markdown"],
  ["brand / merchant", "≤ 60 chars each"],
  ["imageUrl", "square listing image URL"],
  ["price / compareAtPrice", "numbers in INR"],
  ["affiliateUrl *", "https:// link to the merchant"],
  ["rating", "0–5"],
  ["status / isFeatured", "active | draft | archived · boolean"],
  ["pros / cons", "string arrays, max 10 each"],
];

function validateJson(raw: string): Exclude<ValidationResult, null> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste a JSON array first." };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: `Expected a JSON array — got ${typeof parsed}.` };
    }
    if (parsed.length === 0) return { ok: false, error: "The array is empty." };
    if (parsed.length > 200) return { ok: false, error: "Max 200 items per import — split larger sets." };
    return { ok: true, count: parsed.length };
  } catch (e) {
    return { ok: false, error: `JSON error — ${(e as Error).message}` };
  }
}

function CopyExampleButton({ snippet, label }: { snippet: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast({ title: "Copied", description: `${label} example copied to clipboard.` });
    } catch {
      toast({ title: "Could not copy", description: "Select the snippet and copy manually.", variant: "destructive" });
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={copy}>
      <ClipboardCopy className="size-4" aria-hidden="true" />
      Copy example
    </Button>
  );
}

function FormatGuide({
  kind,
  example,
  fields,
}: {
  kind: "posts" | "products";
  example: string;
  fields: Array<[string, string]>;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left text-sm font-medium outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2">
              <FileJson2 className="size-4 text-gold" aria-hidden="true" />
              Format guide — {kind}
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 py-4">
            <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {fields.map(([field, hint]) => (
                <div key={field} className="flex gap-2">
                  <dt className="shrink-0 font-mono font-medium text-foreground/90">{field}</dt>
                  <dd className="min-w-0 text-muted-foreground">{hint}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Example snippet
                </p>
                <CopyExampleButton snippet={example} label={kind} />
              </div>
              <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed scrollbar-slim">
                {example}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ImportPanel({ kind }: { kind: "posts" | "products" }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = React.useState("");
  const [validation, setValidation] = React.useState<ValidationResult>(null);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);

  const parsedItems = React.useMemo(() => {
    if (validation?.ok) {
      try {
        return JSON.parse(raw.trim()) as unknown[];
      } catch {
        return null;
      }
    }
    return null;
  }, [raw, validation]);

  const importMutation = useMutation({
    mutationFn: (items: unknown[]) =>
      apiFetch<ImportSummary>("/api/import", {
        method: "POST",
        body: JSON.stringify(kind === "posts" ? { posts: items } : { products: items }),
      }),
    onSuccess: (data) => {
      setSummary(data);
      const created = kind === "posts" ? data.posts.created : data.products.created;
      toast({
        title: `Imported ${created} ${kind}`,
        description: data.errors.length > 0 ? `${data.errors.length} error(s) — see the summary.` : "Done.",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) =>
      toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const runValidate = () => {
    setValidation(validateJson(raw));
    setSummary(null);
  };

  const runImport = () => {
    const check = validateJson(raw);
    setValidation(check);
    if (!check.ok) return;
    setSummary(null);
    if (parsedItems) importMutation.mutate(parsedItems);
  };

  const label = kind === "posts" ? "posts" : "products";
  const created = summary
    ? kind === "posts"
      ? summary.createdPosts
      : summary.createdProducts
    : [];
  const skipped = summary
    ? kind === "posts"
      ? summary.posts.skipped
      : summary.products.skipped
    : [];
  const received = summary ? (kind === "posts" ? summary.posts.received : summary.products.received) : 0;
  const errors = summary?.errors ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paste your {kind} JSON</CardTitle>
          <CardDescription>
            An array of {kind} objects exported from your old site — validate first, then import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setValidation(null);
            }}
            rows={12}
            aria-label={`Paste ${kind} JSON array`}
            placeholder={`Paste a JSON array of ${kind} here — try the format guide example below...`}
            className="min-h-[320px] font-mono text-[13px] leading-relaxed"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-10 gap-2" onClick={runValidate}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Validate
            </Button>
            <Button
              type="button"
              className="h-10 gap-2"
              onClick={runImport}
              disabled={!validation?.ok || importMutation.isPending}
            >
              <Upload className="size-4" aria-hidden="true" />
              {importMutation.isPending
                ? "Importing..."
                : validation?.ok
                  ? `Import ${validation.count} ${label}`
                  : `Import ${label}`}
            </Button>
            {raw ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={() => {
                  setRaw("");
                  setValidation(null);
                  setSummary(null);
                }}
              >
                Clear
              </Button>
            ) : null}
            {validation ? (
              validation.ok ? (
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 px-2 py-1 text-primary"
                  role="status"
                >
                  Valid — {validation.count} {label} ready
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="max-w-full border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mr-1 size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{validation.error}</span>
                </Badge>
              )
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* import summary */}
      {summary ? (
        <Card className={errors.length > 0 ? "border-amber-500/40" : "border-primary/40"}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className={cn("size-4", errors.length > 0 ? "text-amber-500" : "text-primary")} aria-hidden="true" />
              Import summary — {received} {label} received
            </CardTitle>
            <CardDescription>
              {created.length} created · {skipped.length} skipped · {errors.length} error
              {errors.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {created.length > 0 ? (
              <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                  Created ({created.length})
                </p>
                <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-sm scrollbar-slim">
                  {created.map((name) => (
                    <li key={name} className="truncate text-foreground/85">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {skipped.length > 0 ? (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                  Skipped / renamed ({skipped.length})
                </p>
                <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-sm scrollbar-slim">
                  {skipped.map((note) => (
                    <li key={note} className="truncate text-muted-foreground">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {errors.length > 0 ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/[0.05] p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-destructive">
                  Errors ({errors.length})
                </p>
                <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-sm scrollbar-slim">
                  {errors.map((note) => (
                    <li key={note} className="truncate text-destructive/90">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {created.length === 0 && skipped.length === 0 && errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing was imported.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <FormatGuide
        kind={kind}
        example={kind === "posts" ? POSTS_EXAMPLE : PRODUCTS_EXAMPLE}
        fields={kind === "posts" ? POSTS_FIELDS : PRODUCTS_FIELDS}
      />
    </div>
  );
}

export default function ImportView() {
  const { isLoading, allowed } = useAdminGuard();

  if (isLoading) return <LoadingState variant="spinner" label="Loading import tool" />;
  if (!allowed) return <ForbiddenState />;

  return (
    <AdminShell
      title="Import Content"
      description="Bring your old site's posts and products into MN.KP."
    >
      <SEOHead title="Import Content — Admin & Developer | MN.KP" noindex />

      <div className="space-y-4">
        <Card className="border-gold/30 bg-gold/[0.03]">
          <CardContent className="flex items-start gap-3 pt-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">Re-running is always safe</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Duplicate slugs are never overwritten — they are skipped or auto-renamed, so
                re-running an import is always safe.
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="posts" className="space-y-4">
          <TabsList className="h-11 w-full sm:w-auto">
            <TabsTrigger value="posts" className="h-9">Posts</TabsTrigger>
            <TabsTrigger value="products" className="h-9">Products</TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="space-y-4">
            <ImportPanel kind="posts" />
          </TabsContent>
          <TabsContent value="products" className="space-y-4">
            <ImportPanel kind="products" />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}
