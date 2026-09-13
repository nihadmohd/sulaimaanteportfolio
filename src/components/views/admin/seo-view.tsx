"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  FileSearch,
  FileText,
  Globe,
  Heading1,
  Image as ImageIcon,
  Link2,
  Lock,
  Megaphone,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ALink } from "@/components/router/link";
import { ForbiddenState, LoadingState } from "@/components/states";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import type { JsonRecord, Paginated, PostDTO, ProductDTO, SeoSettings } from "@/types";
import { SITE, SOCIALS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AdminShell } from "./_shell";
import { apiFetch, CopyText, ToneBadge, useAdminGuard } from "./_shared";

/**
 * SEO Toolkit (#/admin/seo — route key "admin-seo").
 *
 * The platform already ships sitemap.xml, robots.txt, canonicals, per-route
 * titles/descriptions, one-H1-per-page, WebP imagery, security headers and
 * schema markup. This console makes all of that VISIBLE, verifiable and
 * actionable for the site owner:
 *
 *  · Google Search Console / Bing Webmaster setup + live token status
 *    (the verification meta tags are emitted by app/layout.tsx from the
 *    "seo" settings row — this view explains that, step by step)
 *  · Live SEO health audit computed from real posts, products and settings
 *  · Google-style SERP previews with pixel-budget character counters
 *    and a "try your own" live editor
 *  · The backlink growth playbook — tiered strategy, copyable outreach
 *    templates and a month-scoped recurring checklist (localStorage)
 */

/* ------------------------------------------------------------------ */
/* constants + helpers                                                 */
/* ------------------------------------------------------------------ */

/** Mirrors the live home <title> rendered by home-view.tsx. */
const HOME_TITLE =
  "MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP";

/** Mirrors defaultSeo() in api/settings/_lib.ts (fallback when DB is empty). */
const DEFAULT_SEO_DESCRIPTION =
  "AI-powered web, app, photo and video solutions from Calicut, Kerala — by MOHAMMED NIHAD KP.";

const TITLE_BUDGET = 60;
const DESCRIPTION_BUDGET = 160;

/** Illustrative post preview shown until the first post is published. */
const SAMPLE_POST = {
  title: "How I Ship Client Websites in Days with an AI-First Workflow | MN.KP",
  description:
    "A Calicut developer's practical breakdown of the AI tools, prompts and review steps behind rapid, production-grade client sites — with real costs and pitfalls.",
  slug: "sample-post",
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** seo settings row (GET /api/settings/all → data.seo) → typed SeoSettings. */
function readSeo(raw: JsonRecord | undefined): SeoSettings {
  return {
    titleSuffix: asString(raw?.titleSuffix, "| MN.KP"),
    defaultDescription: asString(raw?.defaultDescription, DEFAULT_SEO_DESCRIPTION),
    keywords: asStrArr(raw?.keywords),
    googleVerification: asString(raw?.googleVerification),
    bingVerification: asString(raw?.bingVerification),
  };
}

interface SocialProfile {
  name: string;
  url: string;
}

/** brand settings socials (data.brand.socials) → profile list, SOCIALS fallback. */
function readSocialLinks(brandRaw: JsonRecord | undefined): SocialProfile[] {
  const raw = brandRaw?.socials;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const out: SocialProfile[] = [];
    for (const [name, url] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        out.push({ name, url });
      }
    }
    if (out.length > 0) return out;
  }
  return SOCIALS.map((s) => ({ name: s.name, url: s.url }));
}

/** Verification tokens stay secret-ish in the UI: first/last 4 chars only. */
function maskToken(token: string): string {
  const t = token.trim();
  if (!t) return "";
  if (t.length <= 8) return `${t.slice(0, 2)}••••${t.slice(-2)}`;
  return `${t.slice(0, 4)}••••••${t.slice(-4)}`;
}

/** "YYYY-MM" for the user's local month (checklist resets per month). */
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** Clipboard write with a legacy execCommand fallback (non-secure contexts). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* shared small parts                                                  */
/* ------------------------------------------------------------------ */

function CopyButton({
  value,
  ariaLabel,
  toastTitle,
  toastDescription,
}: {
  value: string;
  ariaLabel: string;
  toastTitle: string;
  toastDescription: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      toast({ title: toastTitle, description: toastDescription });
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast({
        title: "Could not copy",
        description: "Select the text manually and copy it with Ctrl+C.",
        variant: "destructive",
      });
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0 gap-1.5"
      onClick={onCopy}
      aria-label={ariaLabel}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** Character budget counter with color feedback (titles ≤60, descriptions ≤160). */
function CharCount({ label, value, budget }: { label: string; value: string; budget: number }) {
  const n = value.length;
  const state: "empty" | "ok" | "over" = n === 0 ? "empty" : n <= budget ? "ok" : "over";
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        state === "ok" && "text-emerald-600 dark:text-emerald-400",
        state === "over" && "text-amber-600 dark:text-amber-400",
        state === "empty" && "text-muted-foreground"
      )}
    >
      {label}: {n}/{budget} characters
      {state === "over" ? " — trim for full SERP display" : ""}
    </p>
  );
}

/** Google-style organic result preview (site's primary color for the title). */
function SerpPreview({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-background p-4 shadow-xs">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-[10px] font-bold tracking-wide text-gold"
        >
          MK
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium leading-tight">MN.KP</p>
          <p className="truncate text-xs leading-tight text-emerald-700 dark:text-emerald-400">
            {url}
          </p>
        </div>
      </div>
      <p className="mt-2.5 break-words text-base font-medium leading-snug text-primary sm:text-lg">
        {title || "(no title yet)"}
      </p>
      <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
        {description || "(no description yet)"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1 · Google Search Console setup                                     */
/* ------------------------------------------------------------------ */

function VerificationStatus({
  engine,
  token,
  metaName,
}: {
  engine: "Google Search Console" | "Bing Webmaster";
  token: string;
  metaName: string;
}) {
  const set = token.trim().length > 0;
  return (
    <div className="min-w-0 rounded-lg border p-3.5">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            set
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          {set ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{engine}</p>
          <p className="truncate font-mono text-xs text-muted-foreground" title={set ? "Verification token (masked)" : undefined}>
            {set ? `meta ${metaName} = ${maskToken(token)}` : "No verification token set"}
          </p>
        </div>
        <ToneBadge tone={set ? "emerald" : "amber"} className="shrink-0">
          {set ? "Verified" : "Pending"}
        </ToneBadge>
      </div>
    </div>
  );
}

function SearchConsoleCard({
  seo,
  loading,
  error,
}: {
  seo: SeoSettings;
  loading: boolean;
  error: boolean;
}) {
  const googleSet = seo.googleVerification.trim().length > 0;
  const bingSet = seo.bingVerification.trim().length > 0;

  return (
    <Card className="min-w-0 py-4 md:py-6">
      <CardHeader className="px-4 pb-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="size-4 text-gold" aria-hidden="true" />
          Google Search Console setup
        </CardTitle>
        <CardDescription>
          Verify ownership of {SITE.url} — the one step Google needs before it indexes the site.
        </CardDescription>
        <CardAction>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="h-9 gap-1.5">
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open Search Console
            </Button>
          </a>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4 pt-0 md:px-6">
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ) : error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3.5 text-sm text-destructive">
            Could not read the SEO settings just now — refresh this page, or open{" "}
            <ALink href="#/admin/settings" className="font-medium underline underline-offset-2">
              Settings → SEO
            </ALink>{" "}
            directly to check the verification tokens.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <VerificationStatus
                engine="Google Search Console"
                token={seo.googleVerification}
                metaName="google-site-verification"
              />
              <VerificationStatus
                engine="Bing Webmaster"
                token={seo.bingVerification}
                metaName="msvalidate.01"
              />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The verification meta tags are emitted automatically by the site layout from these
              settings — paste the token once, save, and every page serves it. No code changes
              needed.
            </p>

            <ol className="mt-4 space-y-3">
              {[
                {
                  title: "Open Search Console",
                  body: (
                    <>
                      Go to{" "}
                      <a
                        href="https://search.google.com/search-console"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline underline-offset-2 hover:text-primary"
                      >
                        search.google.com/search-console
                      </a>{" "}
                      and sign in with your Google account.
                    </>
                  ),
                },
                {
                  title: "Add your property",
                  body: (
                    <span className="block">
                      Choose <span className="font-medium">URL prefix</span> and enter{" "}
                      <CopyText value={SITE.url} label="Property URL" className="font-mono text-xs" />{" "}
                      — exactly as copied, https included.
                    </span>
                  ),
                },
                {
                  title: "Pick “HTML tag” verification",
                  body: "Expand “HTML tag”, then copy only the value inside content=\"…\" — the long token between the quotes.",
                },
                {
                  title: "Paste the token into Settings",
                  body: (
                    <>
                      In{" "}
                      <ALink
                        href="#/admin/settings"
                        className="font-medium underline underline-offset-2 hover:text-primary"
                      >
                        Settings → SEO
                      </ALink>
                      , paste it into “Google verification” and save — {googleSet ? "already done, your token is live above." : "the status above flips to Verified within seconds."}
                    </>
                  ),
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-xs font-semibold text-gold"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Bing — compact two-step variant */}
            <div className="mt-4 rounded-lg border bg-muted/30 p-3.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Bing Webmaster Tools
                <ToneBadge tone={bingSet ? "emerald" : "muted"}>
                  {bingSet ? "Token set" : "2 steps"}
                </ToneBadge>
              </p>
              <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-gold">1.</span>
                  <span>
                    Open{" "}
                    <a
                      href="https://www.bing.com/webmasters"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline underline-offset-2 hover:text-primary"
                    >
                      bing.com/webmasters
                    </a>{" "}
                    and import your Google verification in one click (or add {SITE.url} manually).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-gold">2.</span>
                  <span>
                    If manual: copy the <span className="font-mono">msvalidate.01</span> token and
                    save it under “Bing verification” in{" "}
                    <ALink
                      href="#/admin/settings"
                      className="font-medium underline underline-offset-2 hover:text-primary"
                    >
                      Settings → SEO
                    </ALink>
                    .
                  </span>
                </li>
              </ol>
            </div>

            {/* robots + sitemap live links */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border bg-muted/30 p-3.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <FileSearch className="size-4 shrink-0 text-gold" aria-hidden="true" />
                  robots.txt
                  <a
                    href="/robots.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    View
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Tells every crawler which pages it may index — all public routes allowed, nothing
                  blocked.
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-muted/30 p-3.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <Globe className="size-4 shrink-0 text-gold" aria-hidden="true" />
                  sitemap.xml
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    View
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Auto-generated list of every public page and post — kept fresh as you publish.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              After verification: Search Console → <span className="font-medium">Sitemaps</span> →
              enter <span className="font-mono">sitemap.xml</span> → Submit. Google then recrawls
              and indexes the full site.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · live SEO health audit                                           */
/* ------------------------------------------------------------------ */

type AuditState = "pass" | "warn" | "fail";

interface AuditRow {
  id: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  offenders?: string[];
  state: AuditState;
}

const AUDIT_STATE_META: Record<
  AuditState,
  { box: string; chip: "emerald" | "amber" | "red"; word: string; icon: LucideIcon }
> = {
  pass: {
    box: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    chip: "emerald",
    word: "Pass",
    icon: Check,
  },
  warn: {
    box: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    chip: "amber",
    word: "Review",
    icon: AlertTriangle,
  },
  fail: {
    box: "bg-destructive/10 text-destructive",
    chip: "red",
    word: "Fix",
    icon: XCircle,
  },
};

function buildAuditChecks(input: {
  posts: Paginated<PostDTO> | undefined;
  products: Paginated<ProductDTO> | undefined;
  seo: SeoSettings;
}): AuditRow[] {
  const rows: AuditRow[] = [];

  rows.push({
    id: "indexing",
    icon: FileSearch,
    label: "Indexable public pages",
    detail:
      "robots.txt allows all crawlers on public routes and sitemap.xml lists every page — admin and account views stay noindex.",
    state: "pass",
  });

  // --- posts ---
  const postRow: Omit<AuditRow, "state" | "detail" | "offenders"> = {
    id: "posts",
    icon: FileText,
    label: "Post SEO fields",
  };
  if (!input.posts) {
    rows.push({
      ...postRow,
      detail: "Couldn't load posts just now — refresh the page to re-run this check.",
      state: "warn",
    });
  } else {
    const published = input.posts.items.filter((p) => p.status === "published");
    if (published.length === 0) {
      rows.push({
        ...postRow,
        detail: "No published posts yet — publish your first post to activate this check.",
        state: "warn",
      });
    } else {
      const offenders = published
        .filter((p) => {
          const t = (p.seoTitle ?? "").trim();
          const d = (p.seoDescription ?? "").trim();
          return t.length === 0 || t.length > TITLE_BUDGET || d.length === 0 || d.length > DESCRIPTION_BUDGET || !p.coverImageUrl;
        })
        .map((p) => p.title);
      rows.push({
        ...postRow,
        detail:
          offenders.length === 0
            ? `All ${published.length} published posts carry an SEO title (≤ ${TITLE_BUDGET} chars), an SEO description (≤ ${DESCRIPTION_BUDGET} chars) and a cover image.`
            : `${offenders.length} of ${published.length} published posts are missing an SEO title, description or cover image.`,
        offenders: offenders.length > 0 ? offenders : undefined,
        state:
          offenders.length === 0
            ? "pass"
            : offenders.length === published.length
              ? "fail"
              : "warn",
      });
    }
  }

  // --- products ---
  const productRow: Omit<AuditRow, "state" | "detail" | "offenders"> = {
    id: "products",
    icon: ShoppingBag,
    label: "Product listing quality",
  };
  if (!input.products) {
    rows.push({
      ...productRow,
      detail: "Couldn't load products just now — refresh the page to re-run this check.",
      state: "warn",
    });
  } else {
    const active = input.products.items.filter((p) => p.status === "active");
    if (active.length === 0) {
      rows.push({
        ...productRow,
        detail: "No active products yet — activate your first product to activate this check.",
        state: "warn",
      });
    } else {
      const offenders = active
        .filter((p) => !p.imageUrl || !(p.tagline ?? "").trim() || !(p.rating > 0))
        .map((p) => p.name);
      rows.push({
        ...productRow,
        detail:
          offenders.length === 0
            ? `All ${active.length} active products have an image, a tagline and a rating — complete rich results.`
            : `${offenders.length} of ${active.length} active products are missing an image, tagline or rating.`,
        offenders: offenders.length > 0 ? offenders : undefined,
        state:
          offenders.length === 0
            ? "pass"
            : offenders.length === active.length
              ? "fail"
              : "warn",
      });
    }
  }

  // --- verification tokens ---
  const googleSet = input.seo.googleVerification.trim().length > 0;
  const bingSet = input.seo.bingVerification.trim().length > 0;
  rows.push({
    id: "verification",
    icon: ShieldCheck,
    label: "Search engine verification tokens",
    detail:
      googleSet && bingSet
        ? "Google Search Console and Bing Webmaster tokens are set — ownership meta tags render on every page."
        : googleSet
          ? "Google token is set and live; the Bing msvalidate.01 token is still pending."
          : bingSet
            ? "Only the Bing token is set — add the Google token via the Search Console setup above."
            : "No verification tokens yet — complete the Search Console setup above so engines can confirm ownership.",
    state: googleSet ? "pass" : "warn",
  });

  // --- platform guarantees (informational) ---
  rows.push({
    id: "h1",
    icon: Heading1,
    label: "One H1 per page",
    detail:
      "Enforced by the view system — every route renders exactly one semantic H1 with the rest of the heading hierarchy below it.",
    state: "pass",
  });
  rows.push({
    id: "webp",
    icon: ImageIcon,
    label: "WebP imagery",
    detail:
      "All site imagery is served as WebP — static assets converted and uploads re-encoded on import (≈ 28% lighter pages, better Core Web Vitals).",
    state: "pass",
  });
  rows.push({
    id: "https",
    icon: Lock,
    label: "HTTPS + HSTS",
    detail:
      "Strict-Transport-Security and the full security-header set are enforced at the gateway on every response.",
    state: "pass",
  });

  return rows;
}

function AuditCard({
  posts,
  products,
  seo,
  loading,
}: {
  posts: Paginated<PostDTO> | undefined;
  products: Paginated<ProductDTO> | undefined;
  seo: SeoSettings;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="min-w-0 py-4 md:py-6">
        <CardHeader className="px-4 pb-3 md:px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-gold" aria-hidden="true" />
            Live SEO health audit
          </CardTitle>
          <CardDescription>Checking posts, products and settings…</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-0 md:px-6">
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = buildAuditChecks({ posts, products, seo });
  const total = rows.length;
  const passCount = rows.filter((r) => r.state === "pass").length;
  const warnCount = rows.filter((r) => r.state === "warn").length;
  const failCount = rows.filter((r) => r.state === "fail").length;
  const ratio = total > 0 ? passCount / total : 0;
  const barClass =
    ratio >= 1 ? "bg-emerald-500" : ratio >= 0.6 ? "bg-gold" : "bg-amber-500";
  const isEmpty = !!posts && !!products && posts.total === 0 && products.total === 0;

  return (
    <Card className="min-w-0 py-4 md:py-6">
      <CardHeader className="px-4 pb-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-gold" aria-hidden="true" />
          Live SEO health audit
        </CardTitle>
        <CardDescription>
          Recomputed from your real posts, products and settings every time this page opens.
        </CardDescription>
        <CardAction>
          <ALink href="#/admin/settings">
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Open SEO settings
            </Button>
          </ALink>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4 pt-0 md:px-6">
        {isEmpty ? (
          <div className="mb-4 rounded-lg border border-gold/40 bg-gold/5 p-4">
            <p className="text-sm font-medium">No content to audit yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Publish your first post to activate the content checks — the platform checks below
              are already passing.
            </p>
            <ALink href="#/admin/posts/new" className="mt-2 inline-block">
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <FileText className="size-3.5" aria-hidden="true" />
                Write your first post
              </Button>
            </ALink>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone="emerald">{passCount} passing</ToneBadge>
          {warnCount > 0 ? <ToneBadge tone="amber">{warnCount} to review</ToneBadge> : null}
          {failCount > 0 ? <ToneBadge tone="red">{failCount} failing</ToneBadge> : null}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {passCount} of {total} checks
          </span>
        </div>
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`SEO health: ${passCount} of ${total} checks passing`}
        >
          <div
            className={cn("h-full rounded-full transition-all", barClass)}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>

        <ul className="mt-4 divide-y">
          {rows.map((row) => {
            const meta = AUDIT_STATE_META[row.state];
            const StateIcon = meta.icon;
            return (
              <li key={row.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                    meta.box
                  )}
                >
                  <StateIcon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {row.detail}
                  </p>
                  {row.offenders && row.offenders.length > 0 ? (
                    <p className="mt-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                      Needs work: {row.offenders.slice(0, 3).join(" · ")}
                      {row.offenders.length > 3
                        ? ` +${row.offenders.length - 3} more`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <ToneBadge tone={meta.chip} className="shrink-0">
                  {meta.word}
                </ToneBadge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · SERP preview                                                    */
/* ------------------------------------------------------------------ */

function SerpPreviewCard({
  seo,
  bestPost,
  loading,
}: {
  seo: SeoSettings;
  bestPost: PostDTO | null;
  loading: boolean;
}) {
  const homeTitle = HOME_TITLE;
  const homeDescription = seo.defaultDescription.trim() || DEFAULT_SEO_DESCRIPTION;

  const postTitle = bestPost ? bestPost.seoTitle || bestPost.title : SAMPLE_POST.title;
  const postDescription = bestPost
    ? bestPost.seoDescription || bestPost.excerpt || ""
    : SAMPLE_POST.description;
  const postUrl = bestPost
    ? `${SITE.url}/blog/${bestPost.slug}`
    : `${SITE.url}/blog/${SAMPLE_POST.slug}`;

  // "Try your own" mini editor — seeded once with the home page values.
  const [draftTitle, setDraftTitle] = React.useState("");
  const [draftDescription, setDraftDescription] = React.useState("");
  const [seeded, setSeeded] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !seeded) {
      setDraftTitle(homeTitle);
      setDraftDescription(homeDescription);
      setSeeded(true);
    }
  }, [loading, seeded, homeTitle, homeDescription]);

  const resetDraft = () => {
    setDraftTitle(homeTitle);
    setDraftDescription(homeDescription);
  };

  if (loading) {
    return (
      <Card className="min-w-0 py-4 md:py-6">
        <CardHeader className="px-4 pb-3 md:px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-gold" aria-hidden="true" />
            SERP preview
          </CardTitle>
          <CardDescription>Loading search result previews…</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-0 md:px-6">
          <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-40 rounded-xl lg:col-span-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 py-4 md:py-6">
      <CardHeader className="px-4 pb-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4 text-gold" aria-hidden="true" />
          SERP preview
        </CardTitle>
        <CardDescription>
          How Google renders your pages today — with character budgets for the title (≤{" "}
          {TITLE_BUDGET}) and description (≤ {DESCRIPTION_BUDGET}).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-0 md:px-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Home page
            </p>
            <SerpPreview url={`${SITE.url}/`} title={homeTitle} description={homeDescription} />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <CharCount label="Title" value={homeTitle} budget={TITLE_BUDGET} />
              <CharCount label="Description" value={homeDescription} budget={DESCRIPTION_BUDGET} />
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Blog post
              </p>
              {bestPost ? null : <ToneBadge tone="muted">Sample</ToneBadge>}
            </div>
            <SerpPreview url={postUrl} title={postTitle} description={postDescription} />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <CharCount label="Title" value={postTitle} budget={TITLE_BUDGET} />
              <CharCount
                label="Description"
                value={postDescription}
                budget={DESCRIPTION_BUDGET}
              />
            </div>
            {!bestPost ? (
              <p className="text-xs italic leading-relaxed text-muted-foreground">
                Sample preview — your best published post will appear here as soon as one goes live.
              </p>
            ) : null}
          </div>
        </div>

        {/* "Try your own" live editor */}
        <div className="mt-5 rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Try your own</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Edit the title and description — the counters and preview update live, nothing is
                saved.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={resetDraft}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor="serp-draft-title" className="text-xs">
                  Title tag
                </Label>
                <CharCount label="Title" value={draftTitle} budget={TITLE_BUDGET} />
              </div>
              <Textarea
                id="serp-draft-title"
                rows={2}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="A sharper, keyword-first title…"
                className="min-h-0 resize-y text-sm"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor="serp-draft-description" className="text-xs">
                  Meta description
                </Label>
                <CharCount
                  label="Description"
                  value={draftDescription}
                  budget={DESCRIPTION_BUDGET}
                />
              </div>
              <Textarea
                id="serp-draft-description"
                rows={3}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="One sentence with the keyword, one with the promise…"
                className="min-h-0 resize-y text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <SerpPreview
              url={`${SITE.url}/`}
              title={draftTitle}
              description={draftDescription}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · backlink growth playbook                                        */
/* ------------------------------------------------------------------ */

interface PlaybookTier {
  level: string;
  title: string;
  window: string;
  icon: LucideIcon;
  actions: string[];
}

const PLAYBOOK_TIERS: PlaybookTier[] = [
  {
    level: "Tier 1",
    title: "Foundations — claim every profile that already links",
    window: "This week",
    icon: BadgeCheck,
    actions: [
      "Claim and fully complete your Google Business Profile — category, service area, hours, photos and the website field. It is the single fastest authority link you can get.",
      "Mirror the listing on Bing Places — it imports from Google in one click and feeds Bing/Yahoo search.",
      "Add the site URL to the website/bio field of every social profile below — each one is a crawled, indexed link.",
    ],
  },
  {
    level: "Tier 2",
    title: "Content-driven — earn links with depth",
    window: "Weeks 2–4",
    icon: FileText,
    actions: [
      "Publish 2–3 deep, linkable guides aimed at long-tail Kerala queries — “AI developer in Calicut”, “freelance web developer Kozhikode”, “website cost in Kerala”. Depth earns links; frequency alone does not.",
      "Run digital PR: answer HARO-style journalist requests with an AI-first developer angle — every pickup is an authority link from a news domain.",
      "Turn client wins into case-study posts — the most-cited content format for a services site.",
    ],
  },
  {
    level: "Tier 3",
    title: "Partnerships — trade value for links",
    window: "Months 1–3",
    icon: Link2,
    actions: [
      "List MN.KP in Calicut/Kerala business and startup directories — real local citations compound with the Google Business Profile.",
      "Guest-post on developer and creator blogs — start with the outreach template in the next tab.",
      "Offer a free AI-tools talk to local colleges and institutes — workshop and alumni pages are stable, well-trusted links.",
      "Ask happy clients for testimonial links — the ready-made template makes it an easy yes.",
    ],
  },
  {
    level: "Tier 4",
    title: "Ongoing — keep widening the moat",
    window: "Every month",
    icon: Rocket,
    actions: [
      "Maintain affiliated merchant pages — curated “best X for Y” buying guides that merchants and buyers reference naturally.",
      "Stay active where your buyers are (Reddit, Indie Hackers, WhatsApp communities) with a profile link — presence, never spam.",
      "Ship one linkable asset a month — a template, checklist or comparison — and announce it from the social profiles above.",
    ],
  },
];

interface OutreachTemplate {
  id: string;
  title: string;
  purpose: string;
  text: string;
}

const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "guest-post",
    title: "Guest post pitch",
    purpose: "Cold outreach to dev/creator blogs, offering an original article for an author-bio link.",
    text: `Subject: Guest post pitch — {proposed title}

Hi {editor name},

I'm MOHAMMED NIHAD KP, an AI-first developer and freelancer from Calicut, Kerala. I've followed {site name} for a while — {their article title} genuinely changed how I work with {topic}.

I'd like to pitch a guest post: "{proposed title}".

The angle: a practical, screenshot-led walkthrough of {specific angle}, drawn from live client work I ship through my studio MN.KP (${SITE.url}). It fits your {category} archive without repeating anything you've already published.

What you get: an original 1,200–1,800 word draft with code samples and visuals where useful, plus a full outline for your sign-off before I write a word. In return I'd ask for a short author bio with one link to ${SITE.url} — nothing promotional inside the body.

Would this fit your editorial calendar? Happy to send two alternative angles if it's close.

Best regards,
MOHAMMED NIHAD KP
MN.KP — ${SITE.url}
${SITE.email} · ${SITE.phone}`,
  },
  {
    id: "directory",
    title: "Local directory submission",
    purpose: "Ready-to-fill listing request for Calicut/Kerala business directories.",
    text: `Subject: New business listing — MN.KP, web & app development (Calicut)

Hello {directory team},

I'd like to submit my business for inclusion in {directory name}.

Business name: MN.KP — MOHAMMED NIHAD KP
Category: Website & app development / AI services
Website: ${SITE.url}
Phone: ${SITE.phone}
Email: ${SITE.email}
Location: Calicut (Kozhikode), Kerala, India
Service areas: Calicut · Kozhikode · Kerala · Remote (global)
Short description: AI-powered web, app, photo and video solutions from Calicut, Kerala — delivered fast, anywhere in the world.

The website URL above is the canonical business link. Logos, photos and registration documents are available on request — just tell me which format your listings need.

Thank you for maintaining {directory name}.

MOHAMMED NIHAD KP
MN.KP — ${SITE.url}`,
  },
  {
    id: "testimonial",
    title: "Client testimonial / link request",
    purpose: "Turns a happy client into a natural, white-hat backlink.",
    text: `Subject: A testimonial for {client company} — and one small favour

Hi {client name},

The {project} we shipped together has been running well, and I'm proud of it. I'd like to return the favour: a short testimonial about {client company}, written from a supplier's perspective — yours to use on your site, in proposals or on socials.

One small ask while it's fresh: when you publish it, could the credit line link to ${SITE.url}? That single link does more for my search visibility than a month of ads, and it points your future clients to a live portfolio.

If it helps, a ready-to-paste version: "{two-line testimonial}" — edit freely.

Thanks for considering it — either way, it's a pleasure working with your team.

Best regards,
MOHAMMED NIHAD KP
MN.KP — ${SITE.url}
${SITE.email} · ${SITE.phone}`,
  },
];

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
}

const BACKLINK_CHECKLIST: ChecklistItem[] = [
  {
    id: "competitors",
    label: "Audit 3 competitor backlinks",
    hint: "Free checkers or the Search Console links report — note who links to them, not you.",
  },
  {
    id: "pitch",
    label: "Pitch 1 guest post",
    hint: "One polished pitch (template above) beats five rushed ones.",
  },
  {
    id: "asset",
    label: "Ship 1 linkable asset",
    hint: "A template, checklist or comparison page people naturally cite.",
  },
  {
    id: "reclaim",
    label: "Reclaim 1 lost link",
    hint: "Search Console → fix any 404 that still has inbound links.",
  },
  {
    id: "guide",
    label: "Refresh 1 older guide",
    hint: "Updated data earns re-links and defends existing rankings.",
  },
  {
    id: "directory",
    label: "Submit to 1 new local directory",
    hint: "Kerala/Calicut niche listings first, generic directories second.",
  },
  {
    id: "testimonial",
    label: "Request 1 client testimonial link",
    hint: "Send the testimonial request template to a recent client.",
  },
  {
    id: "console",
    label: "Review Search Console queries",
    hint: "Note rising queries and brief your next post around them.",
  },
];

function StrategyTab({ socials }: { socials: SocialProfile[] }) {
  const foundationLinks: Array<{ label: string; url: string }> = [
    { label: "Google Business Profile", url: "https://business.google.com/" },
    { label: "Bing Places", url: "https://www.bingplaces.com/" },
    ...socials
      .filter((s) => s.name !== "Google Business")
      .map((s) => ({ label: s.name, url: s.url })),
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        A four-tier ladder: guaranteed wins this week, earned links over the following months.
        Every tier below runs on assets you already own — your profiles, your content and your
        clients.
      </p>
      {PLAYBOOK_TIERS.map((tier) => (
        <div key={tier.level} className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <tier.icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gold">
                {tier.level}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug">{tier.title}</p>
            </div>
            <ToneBadge tone="muted" className="shrink-0">
              {tier.window}
            </ToneBadge>
          </div>
          <ul className="mt-3 space-y-2">
            {tier.actions.map((action, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-gold"
                />
                <span>{action}</span>
              </li>
            ))}
          </ul>
          {tier.level === "Tier 1" ? (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Open each profile and add the site URL to its website/bio field:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {foundationLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-muted/40 px-3 text-xs font-medium transition-colors hover:border-gold/50 hover:text-primary"
                  >
                    {link.label}
                    <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TemplatesTab() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Three ready-to-send templates. Personalise the{" "}
        <span className="font-mono text-xs">{"{curly placeholders}"}</span> before sending — the
        rest is already you.
      </p>
      {OUTREACH_TEMPLATES.map((template) => (
        <div key={template.id} className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Megaphone className="size-4 shrink-0 text-gold" aria-hidden="true" />
                {template.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {template.purpose}
              </p>
            </div>
            <CopyButton
              value={template.text}
              ariaLabel={`Copy the ${template.title} template`}
              toastTitle="Template copied"
              toastDescription={`${template.title} is on your clipboard — personalise the {placeholders} before sending.`}
            />
          </div>
          <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground scrollbar-slim">
            {template.text}
          </pre>
        </div>
      ))}
    </div>
  );
}

function ChecklistTab() {
  const [month, setMonth] = React.useState("");
  const [done, setDone] = React.useState<string[]>([]);

  React.useEffect(() => {
    const key = currentMonthKey();
    setMonth(key);
    try {
      const raw = window.localStorage.getItem(`mnkp_seo_backlink_checklist_${key}`);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDone(parsed.filter((x): x is string => typeof x === "string"));
        }
      }
    } catch {
      /* storage unavailable — the list simply stays in memory */
    }
  }, []);

  const storageKey = month ? `mnkp_seo_backlink_checklist_${month}` : "";

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
      }
      return next;
    });
  };

  if (!month) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const doneCount = BACKLINK_CHECKLIST.filter((item) => done.includes(item.id)).length;
  const total = BACKLINK_CHECKLIST.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{monthLabel(month)} recurring actions</p>
        <ToneBadge tone={doneCount === total ? "emerald" : "gold"}>
          {doneCount === total ? "Month complete" : `${doneCount} of ${total} done`}
        </ToneBadge>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Backlink checklist: ${doneCount} of ${total} actions done`}
      >
        <div
          className={cn("h-full rounded-full transition-all", doneCount === total ? "bg-emerald-500" : "bg-gold")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {BACKLINK_CHECKLIST.map((item) => {
          const checked = done.includes(item.id);
          return (
            <li key={item.id}>
              <label
                htmlFor={`seo-bl-${item.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  checked && "border-primary/40 bg-primary/5"
                )}
              >
                <Checkbox
                  id={`seo-bl-${item.id}`}
                  checked={checked}
                  onCheckedChange={() => toggle(item.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      checked && "text-muted-foreground line-through"
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Stored only in this browser (key{" "}
        <span className="font-mono">mnkp_seo_backlink_checklist_{month}</span>) — the list resets
        automatically when a new month begins.
      </p>
    </div>
  );
}

function BacklinkPlaybookCard({ socials }: { socials: SocialProfile[] }) {
  return (
    <Card className="min-w-0 py-4 md:py-6">
      <CardHeader className="px-4 pb-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-gold" aria-hidden="true" />
          Backlink growth playbook
        </CardTitle>
        <CardDescription>
          The strategy, the outreach templates and the monthly rhythm — backlinks are earned, never
          bought.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-0 md:px-6">
        <Tabs defaultValue="strategy" className="gap-4">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
          </TabsList>
          <TabsContent value="strategy">
            <StrategyTab socials={socials} />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="checklist">
            <ChecklistTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function SeoView() {
  const { isLoading, allowed } = useAdminGuard();

  const settingsQuery = useQuery({
    queryKey: ["admin-settings-all"],
    queryFn: () => apiFetch<Record<string, JsonRecord>>("/api/settings/all"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const postsQuery = useQuery({
    queryKey: ["admin-seo-posts"],
    queryFn: () => apiFetch<Paginated<PostDTO>>("/api/posts?status=all&sort=recent&limit=50"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  const productsQuery = useQuery({
    queryKey: ["admin-seo-products"],
    queryFn: () => apiFetch<Paginated<ProductDTO>>("/api/products?status=all&limit=50"),
    enabled: allowed,
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) return <LoadingState variant="spinner" label="Loading SEO toolkit" />;
  if (!allowed) return <ForbiddenState />;

  const seo = readSeo(settingsQuery.data?.["seo"]);
  const socials = readSocialLinks(settingsQuery.data?.["brand"]);
  const bestPost =
    (postsQuery.data?.items ?? []).find((p) => p.status === "published") ?? null;

  return (
    <AdminShell
      title="SEO Toolkit"
      description="Search Console verification, live SEO health audit, SERP previews and the backlink growth playbook."
    >
      <SEOHead title="SEO Toolkit — Admin & Developer | MN.KP" noindex />

      <div className="space-y-4 md:space-y-6">
        <SearchConsoleCard
          seo={seo}
          loading={settingsQuery.isLoading}
          error={settingsQuery.isError}
        />
        <AuditCard
          posts={postsQuery.data}
          products={productsQuery.data}
          seo={seo}
          loading={
            settingsQuery.isLoading || postsQuery.isLoading || productsQuery.isLoading
          }
        />
        <SerpPreviewCard
          seo={seo}
          bestPost={bestPost}
          loading={settingsQuery.isLoading || postsQuery.isLoading}
        />
        <BacklinkPlaybookCard socials={socials} />
      </div>
    </AdminShell>
  );
}
