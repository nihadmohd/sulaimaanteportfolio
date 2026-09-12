"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Download,
  FileJson2,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderTree,
  Inbox,
  Loader2,
  Mail,
  Megaphone,
  PackageCheck,
  Rocket,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Upload,
  Users,
  type LucideIcon,
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
import { parseCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, useAdminGuard } from "./_shared";

/**
 * Import & Export (#/admin/import — route key "admin-import").
 * The site owner's data portability console:
 *   · Export — one-click complete CSV backups of every content table.
 *   · Import — JSON (posts/products, legacy migration path) or CSV for
 *     posts / products / categories / ventures / ads / subscribers.
 * Any file produced by /api/export round-trips straight back in.
 * Duplicate keys never overwrite — slugs are skipped/auto-renamed and
 * duplicate emails are skipped, so re-running an import is safe.
 */

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

interface ImportSummary {
  posts: { received: number; created: number; skipped: string[] };
  products: { received: number; created: number; skipped: string[] };
  createdPosts: string[];
  createdProducts: string[];
  errors: string[];
  entity?: string;
  received?: number;
  created?: number;
  skipped?: number;
}

interface CsvImportSummary {
  format: "csv";
  entity: string;
  received: number;
  created: number;
  skipped: number;
  skippedNotes: string[];
  createdItems: string[];
  errors: string[];
}

type JsonValidation = { ok: true; count: number } | { ok: false; error: string } | null;

type CsvValidation =
  | { ok: true; count: number; headers: string[]; preview: string[][] }
  | { ok: false; error: string }
  | null;

/* ------------------------------------------------------------------ */
/* export targets + import entity metadata                             */
/* ------------------------------------------------------------------ */

const EXPORT_TARGETS: Array<{ type: string; label: string; icon: LucideIcon }> = [
  { type: "posts", label: "Posts", icon: FileText },
  { type: "products", label: "Products", icon: ShoppingBag },
  { type: "categories", label: "Categories", icon: FolderTree },
  { type: "ventures", label: "Ventures", icon: Rocket },
  { type: "ads", label: "Ads", icon: Megaphone },
  { type: "inquiries", label: "Inquiries", icon: Inbox },
  { type: "subscribers", label: "Subscribers", icon: Mail },
  { type: "users", label: "Users", icon: Users },
  { type: "settings", label: "Settings", icon: Settings },
];

const IMPORT_ENTITIES = ["posts", "products", "categories", "ventures", "ads", "subscribers"] as const;
type ImportEntity = (typeof IMPORT_ENTITIES)[number];

/** Exact header rows produced by GET /api/export (round-trip contract). */
const CSV_COLUMNS: Record<ImportEntity, string[]> = {
  posts: [
    "slug", "title", "excerpt", "content", "coverImageUrl", "status", "isFeatured",
    "tags", "readingTimeMinutes", "viewsCount", "seoTitle", "seoDescription",
    "ogImageUrl", "canonicalUrl", "categorySlug", "publishedAt", "createdAt", "updatedAt",
  ],
  products: [
    "slug", "name", "tagline", "description", "brand", "merchant", "imageUrl",
    "gallery", "price", "compareAtPrice", "currency", "affiliateUrl", "pros", "cons",
    "keySpecs", "rating", "reviewCount", "status", "isFeatured", "clicksCount",
    "categorySlug", "createdAt", "updatedAt",
  ],
  categories: ["name", "slug", "description", "scope", "sortOrder", "createdAt"],
  ventures: [
    "slug", "name", "tagline", "description", "category", "status", "location",
    "websiteUrl", "imageUrl", "highlights", "collabRoles", "sortOrder", "isFeatured",
    "createdAt", "updatedAt",
  ],
  ads: [
    "name", "type", "placement", "title", "body", "imageUrl", "imageAlt", "images",
    "linkUrl", "linkLabel", "active", "priority", "startAt", "endAt",
    "impressions", "clicks", "createdAt", "updatedAt",
  ],
  subscribers: ["email", "status", "source", "subscribedAt", "confirmedAt", "unsubscribedAt"],
};

/** Columns the server requires for a row to import. */
const CSV_REQUIRED: Record<ImportEntity, string[]> = {
  posts: ["title", "content"],
  products: ["name", "affiliateUrl"],
  categories: ["name", "slug"],
  ventures: ["name", "slug"],
  ads: ["name"],
  subscribers: ["email"],
};

const CSV_NOTES: Record<ImportEntity, string> = {
  posts:
    "categorySlug must match an existing category — unknown slugs import as uncategorized. Dates are ISO strings (2024-06-01T10:00:00.000Z). Duplicate slugs are auto-renamed, never overwritten.",
  products:
    'categorySlug must match an existing category. keySpecs holds a JSON object like {"Battery":"30h"}. Duplicate slugs are auto-renamed, never overwritten.',
  categories:
    "scope is blog or store (defaults to blog). Rows whose slug already exists are skipped.",
  ventures:
    "status is live, incubating, planned, idea or retired (defaults to live). Rows whose slug already exists are skipped. Requires the ventures table — until its migration is applied every row is reported as an error and nothing is created.",
  ads:
    "type is image, gif, sticker, text or marquee; placement must be one of the ten ad placements. Ads have no unique key — every row creates a NEW ad, so re-running an import duplicates them.",
  subscribers:
    "status is pending, confirmed or unsubscribed (defaults to pending); source is blog, store, footer or lead_magnet (defaults to blog). Rows whose email already exists are skipped.",
};

/** Query keys to invalidate after a successful import, per entity. */
const INVALIDATE_BY_ENTITY: Record<ImportEntity, string[][]> = {
  posts: [["admin-posts"], ["admin-stats"]],
  products: [["admin-products"], ["admin-stats"]],
  categories: [["admin-categories"]],
  ventures: [["admin-ventures"], ["admin-stats"]],
  ads: [["admin-ads"], ["admin-ads-stats"], ["ads"]],
  subscribers: [["admin-subscribers"], ["admin-stats"]],
};

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

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

function CopyExampleButton({ snippet, label }: { snippet: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Could not copy", description: "Select the snippet and copy manually.", variant: "destructive" });
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={copy}>
      <ClipboardCopy className="size-4" aria-hidden="true" />
      Copy
    </Button>
  );
}

/** Import summary card shared by the JSON and CSV panels. */
function SummaryCard({
  label,
  received,
  created,
  createdItems,
  skippedNotes,
  errors,
}: {
  label: string;
  received: number;
  created: number;
  createdItems: string[];
  skippedNotes: string[];
  errors: string[];
}) {
  return (
    <Card className={errors.length > 0 ? "border-amber-500/40" : "border-primary/40"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className={cn("size-4", errors.length > 0 ? "text-amber-500" : "text-primary")} aria-hidden="true" />
          Import summary — {received} {label} received
        </CardTitle>
        <CardDescription>
          {created} created · {skippedNotes.length} skipped · {errors.length} error
          {errors.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {createdItems.length > 0 ? (
          <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              Created ({createdItems.length})
            </p>
            <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-sm scrollbar-slim">
              {createdItems.map((name) => (
                <li key={name} className="truncate text-foreground/85">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {skippedNotes.length > 0 ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
              Skipped / renamed ({skippedNotes.length})
            </p>
            <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-sm scrollbar-slim">
              {skippedNotes.map((note) => (
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
        {createdItems.length === 0 && skippedNotes.length === 0 && errors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing was imported.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* export panel                                                        */
/* ------------------------------------------------------------------ */

function ExportPanel() {
  const [busy, setBusy] = React.useState<string | null>(null);

  const download = async (type: string, label: string) => {
    setBusy(type);
    try {
      const res = await fetch(`/api/export?type=${type}`, { credentials: "include" });
      if (!res.ok) {
        let message = `Export failed (HTTP ${res.status}).`;
        try {
          const json = (await res.json()) as { error?: { message?: string } };
          if (json?.error?.message) message = json.error.message;
        } catch {
          // non-JSON error body — keep the generic message
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? `mnkp-${type}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: `${label} exported`, description: `${filename} downloaded.` });
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
            <Download className="size-4" aria-hidden="true" />
          </span>
          Download your data
        </CardTitle>
        <CardDescription>
          Complete CSV backups of every content table — one click each. Files download
          straight to your device, newest column set, nothing truncated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXPORT_TARGETS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => void download(type, label)}
              disabled={busy !== null}
              aria-label={`Export ${label} as CSV`}
              className="group flex min-h-11 items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors hover:border-gold/50 hover:bg-gold/[0.06] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <Icon
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-gold"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {busy === type ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-gold" aria-hidden="true" />
              ) : (
                <Download
                  className="size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-gold"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
          <span>
            Exports are staff-only and always complete — every column needed to rebuild the
            content is included, and any exported file can be re-imported below. User exports
            carry profile fields only, never credentials.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* JSON import panel (posts/products — legacy migration path)          */
/* ------------------------------------------------------------------ */

function validateJson(raw: string): Exclude<JsonValidation, null> {
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
              Format guide — {kind} (JSON)
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
                <CopyExampleButton snippet={example} label={`${kind} example`} />
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

function JsonImportPanel({ kind }: { kind: "posts" | "products" }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = React.useState("");
  const [validation, setValidation] = React.useState<JsonValidation>(null);
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
  const createdItems = summary ? (kind === "posts" ? summary.createdPosts : summary.createdProducts) : [];
  const skippedNotes = summary ? (kind === "posts" ? summary.posts.skipped : summary.products.skipped) : [];
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

      {summary ? (
        <SummaryCard
          label={label}
          received={received}
          created={createdItems.length}
          createdItems={createdItems}
          skippedNotes={skippedNotes}
          errors={errors}
        />
      ) : null}

      <FormatGuide
        kind={kind}
        example={kind === "posts" ? POSTS_EXAMPLE : PRODUCTS_EXAMPLE}
        fields={kind === "posts" ? POSTS_FIELDS : PRODUCTS_FIELDS}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSV import panel (all six importable entities)                      */
/* ------------------------------------------------------------------ */

function validateCsvText(raw: string, entity: ImportEntity): Exclude<CsvValidation, null> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste some CSV text (or load a file) first." };
  const rows = parseCsv(trimmed);
  if (rows.length === 0) return { ok: false, error: "Could not parse any rows from this text." };
  const headers = rows[0].map((h) => h.trim());
  if (headers.some((h) => !h)) {
    return { ok: false, error: "Every column needs a header — found an empty header cell." };
  }
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  if (dataRows.length === 0) {
    return { ok: false, error: "No data rows found under the header row." };
  }
  if (dataRows.length > 200) {
    return { ok: false, error: `Max 200 rows per import — got ${dataRows.length}. Split larger sets.` };
  }
  const missing = CSV_REQUIRED[entity].filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}.` };
  }
  return { ok: true, count: dataRows.length, headers, preview: dataRows.slice(0, 3) };
}

function CsvColumnGuide({ entity }: { entity: ImportEntity }) {
  const [open, setOpen] = React.useState(false);
  const columns = CSV_COLUMNS[entity];
  const required = CSV_REQUIRED[entity];
  const headerRow = columns.join(",");
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
              <FileSpreadsheet className="size-4 text-gold" aria-hidden="true" />
              CSV columns — {entity}
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 py-4">
            <ul className="flex flex-wrap gap-1.5">
              {columns.map((c) => {
                const isRequired = required.includes(c);
                return (
                  <li
                    key={c}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px]",
                      isRequired
                        ? "border-gold/40 bg-gold/10 text-gold"
                        : "border-border bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {isRequired ? <span aria-hidden="true">*</span> : null}
                    {c}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="text-gold">*</span> required · Every file downloaded from the Export
              panel above can be pasted straight in — the columns match one-to-one. Cells that hold
              lists (tags, gallery, pros, cons, highlights, collabRoles, images) accept a JSON array
              like <span className="font-mono">[&quot;a&quot;,&quot;b&quot;]</span> or plain{" "}
              <span className="font-mono">a | b</span> text.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{CSV_NOTES[entity]}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Header row
                </p>
                <CopyExampleButton snippet={headerRow} label={`${entity} header row`} />
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed scrollbar-slim">
                {headerRow}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CsvImportPanel({ entity }: { entity: ImportEntity }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = React.useState("");
  const [validation, setValidation] = React.useState<CsvValidation>(null);
  const [summary, setSummary] = React.useState<CsvImportSummary | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: () =>
      apiFetch<CsvImportSummary>("/api/import", {
        method: "POST",
        body: JSON.stringify({ format: "csv", entity, csv: raw }),
      }),
    onSuccess: (data) => {
      setSummary(data);
      toast({
        title: `Imported ${data.created} ${entity}`,
        description:
          data.errors.length > 0
            ? `${data.errors.length} row error(s) — see the summary.`
            : `${data.received} row(s) processed.`,
      });
      for (const key of INVALIDATE_BY_ENTITY[entity]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (e: Error) =>
      toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const runValidate = () => {
    setValidation(validateCsvText(raw, entity));
    setSummary(null);
  };

  const runImport = () => {
    const check = validateCsvText(raw, entity);
    setValidation(check);
    if (!check.ok) return;
    setSummary(null);
    importMutation.mutate();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast({
        title: "File too large",
        description: "Keep CSV imports under 2 MB (about 200 rows of site content).",
        variant: "destructive",
      });
      return;
    }
    try {
      const text = await file.text();
      setRaw(text);
      setValidation(null);
      setSummary(null);
      toast({
        title: "File loaded",
        description: `${file.name} — ${text.length.toLocaleString()} characters. Hit Validate when ready.`,
      });
    } catch {
      toast({
        title: "Could not read file",
        description: "Try opening it in a text editor and pasting the contents instead.",
        variant: "destructive",
      });
    }
  };

  const required = CSV_REQUIRED[entity];
  const previewHeaders = validation?.ok ? validation.headers.slice(0, 6) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paste your {entity} CSV</CardTitle>
          <CardDescription>
            First row = column headers, then one row per record. Load an export file or paste
            spreadsheet text — validate for a preview before importing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setValidation(null);
            }}
            rows={10}
            aria-label={`Paste ${entity} CSV`}
            placeholder={"slug,title,content...\nmy-post,My post title,Full markdown body..."}
            className="min-h-[240px] font-mono text-[13px] leading-relaxed"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="size-4" aria-hidden="true" />
              Load file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              aria-label={`Load a ${entity} CSV file`}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
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
                  ? `Import ${validation.count} ${entity}`
                  : `Import ${entity}`}
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
                  Valid — {validation.count} {entity} row(s) ready
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

      {validation?.ok ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Detected columns ({validation.headers.length})
            </CardTitle>
            <CardDescription>
              {validation.count} data row(s) — up to 3 previewed below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="flex flex-wrap gap-1.5">
              {validation.headers.map((h) => {
                const isRequired = required.includes(h);
                return (
                  <li
                    key={h}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px]",
                      isRequired
                        ? "border-gold/40 bg-gold/10 text-gold"
                        : "border-border bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {isRequired ? <span aria-hidden="true">*</span> : null}
                    {h}
                  </li>
                );
              })}
            </ul>
            <div className="overflow-x-auto rounded-lg border scrollbar-slim">
              <table className="w-full min-w-max text-xs">
                <caption className="sr-only">First rows of the parsed CSV preview</caption>
                <thead>
                  <tr className="border-b bg-muted/40">
                    {previewHeaders.map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="whitespace-nowrap px-2.5 py-2 text-left font-mono font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validation.preview.map((row, r) => (
                    <tr key={r} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                      {previewHeaders.map((h, c) => (
                        <td
                          key={h}
                          className="max-w-[180px] truncate whitespace-nowrap px-2.5 py-2 text-foreground/80"
                          title={row[c] || undefined}
                        >
                          {row[c] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validation.headers.length > previewHeaders.length ? (
              <p className="text-xs text-muted-foreground">
                + {validation.headers.length - previewHeaders.length} more column
                {validation.headers.length - previewHeaders.length === 1 ? "" : "s"} not shown —
                all columns are still imported.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <SummaryCard
          label={entity}
          received={summary.received}
          created={summary.created}
          createdItems={summary.createdItems}
          skippedNotes={summary.skippedNotes}
          errors={summary.errors}
        />
      ) : null}

      <CsvColumnGuide entity={entity} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* import section (format toggle + entity panels)                      */
/* ------------------------------------------------------------------ */

function ImportSection({ entity }: { entity: ImportEntity }) {
  const supportsJson = entity === "posts" || entity === "products";
  const [mode, setMode] = React.useState<"json" | "csv">(supportsJson ? "json" : "csv");

  const modeButton = (value: "json" | "csv", label: string) => (
    <button
      key={value}
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        "inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium transition-colors",
        mode === value
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {supportsJson ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Format
          </span>
          <div
            className="inline-flex h-9 items-center rounded-lg border bg-muted/40 p-0.5"
            role="tablist"
            aria-label="Import format"
          >
            {modeButton("json", "JSON")}
            {modeButton("csv", "CSV")}
          </div>
          <p className="text-xs text-muted-foreground">
            JSON for old-site migration arrays · CSV for spreadsheet-style data and round-trips.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          CSV import — paste rows below or load an exported file.
        </p>
      )}
      {supportsJson && mode === "json" ? (
        <JsonImportPanel kind={entity} />
      ) : (
        <CsvImportPanel entity={entity} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function ImportView() {
  const { isLoading, allowed } = useAdminGuard();

  if (isLoading) return <LoadingState variant="spinner" label="Loading import tool" />;
  if (!allowed) return <ForbiddenState />;

  return (
    <AdminShell
      title="Import & Export"
      description="Move content in and out of MN.KP — download complete CSV backups, bring data back in via JSON or CSV."
    >
      <SEOHead title="Import & Export — Admin & Developer | MN.KP" noindex />

      <div className="space-y-4">
        <ExportPanel />

        <section className="space-y-4" aria-label="Import data">
          <div>
            <h2 className="text-base font-semibold">Import</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Bring content in from an old site or a spreadsheet — six entity types, validated
              row-by-row before anything is written.
            </p>
          </div>

          <Card className="border-gold/30 bg-gold/[0.03]">
            <CardContent className="flex items-start gap-3 pt-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium">Re-running is always safe</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Duplicate keys are never overwritten — post and product slugs are skipped or
                  auto-renamed, duplicate category/venture slugs and subscriber emails are skipped.
                  Ads are the one exception: every imported row creates a new ad.
                </p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="posts" className="space-y-4">
            <div className="overflow-x-auto scrollbar-slim">
              <TabsList className="h-11 w-max min-w-full sm:w-auto">
                <TabsTrigger value="posts" className="h-9">Posts</TabsTrigger>
                <TabsTrigger value="products" className="h-9">Products</TabsTrigger>
                <TabsTrigger value="categories" className="h-9">Categories</TabsTrigger>
                <TabsTrigger value="ventures" className="h-9">Ventures</TabsTrigger>
                <TabsTrigger value="ads" className="h-9">Ads</TabsTrigger>
                <TabsTrigger value="subscribers" className="h-9">Subscribers</TabsTrigger>
              </TabsList>
            </div>
            {IMPORT_ENTITIES.map((entity) => (
              <TabsContent key={entity} value={entity} className="space-y-4">
                <ImportSection entity={entity} />
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </div>
    </AdminShell>
  );
}
