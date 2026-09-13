"use client";

import * as React from "react";
import { SITE } from "@/lib/constants";

/**
 * SEOHead — client-side meta manager for the hash-routed shell.
 *
 * LAST-MOUNTED-WINS semantics: every effect run takes a stamp from a
 * module-level counter and applies its meta; the instance with the most
 * recent stamp owns the document head until another instance (re)mounts.
 * In practice the AppRouter renders route defaults first and any view
 * that renders its own <SEOHead> mounts afterwards — so view meta wins.
 * All writes are diff-based, so re-applying the same values is a no-op.
 *
 * Props:
 *   title         — document title (" | MN.KP" appended unless already branded)
 *   description   — meta description
 *   canonicalPath — e.g. "/blog/my-slug" (canonical = SITE.url + path)
 *   noindex       — robots noindex,follow
 *   ogImage       — absolute or site-relative OG image
 *   ogType        — default "website"
 *   jsonLd        — schema.org node(s) for this route (script#route-jsonld)
 */

export interface SEOHeadProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article" | "product" | "profile";
  jsonLd?: unknown | unknown[];
}

/** Build the canonical URL for a hash-route path (production route shape). */
export function buildCanonical(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.url}${clean === "/" ? "/" : clean}`;
}

/* ----------------------------- module registry ---------------------------- */

let seoStamp = 0;

interface MetaValues {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  jsonLd?: string | null;
}

function upsertMeta(attr: "name" | "property", key: string, content: string | undefined): void {
  if (content === undefined) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (el.getAttribute("content") !== content) el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string | undefined): void {
  if (href === undefined) return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  if (el.getAttribute("href") !== href) el.setAttribute("href", href);
}

function applyMeta(values: MetaValues): void {
  const brandedTitle =
    values.title && !values.title.includes("MN.KP")
      ? `${values.title.replace(/\s*\|\s*MN\.KP\s*$/i, "")} | MN.KP`
      : values.title;
  if (brandedTitle !== undefined && document.title !== brandedTitle) {
    document.title = brandedTitle;
  }
  upsertMeta("name", "description", values.description);
  upsertLink("canonical", values.canonical);
  upsertMeta("name", "robots", values.noindex === undefined ? undefined : values.noindex ? "noindex, follow" : "index, follow");

  upsertMeta("property", "og:title", brandedTitle);
  upsertMeta("property", "og:description", values.description);
  upsertMeta("property", "og:type", values.ogType);
  upsertMeta("property", "og:url", values.ogUrl);
  upsertMeta("property", "og:site_name", "MN.KP");
  if (values.ogImage) {
    const img = values.ogImage.startsWith("http") ? values.ogImage : `${SITE.url}${values.ogImage}`;
    upsertMeta("property", "og:image", img);
  }
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", brandedTitle);
  upsertMeta("name", "twitter:description", values.description);
  if (values.ogImage) {
    const img = values.ogImage.startsWith("http") ? values.ogImage : `${SITE.url}${values.ogImage}`;
    upsertMeta("name", "twitter:image", img);
  }

  // Route-level JSON-LD (site-level lives in layout.tsx as #site-jsonld).
  let script = document.getElementById("route-jsonld") as HTMLScriptElement | null;
  if (values.jsonLd === null || values.jsonLd === undefined) {
    if (script) script.remove();
  } else {
    if (!script) {
      script = document.createElement("script");
      script.id = "route-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    if (script.textContent !== values.jsonLd) script.textContent = values.jsonLd;
  }
}

/* -------------------------------- component ------------------------------- */

export function SEOHead({
  title,
  description,
  canonicalPath,
  noindex,
  ogImage,
  ogType = "website",
  jsonLd,
}: SEOHeadProps) {
  const jsonLdKey = React.useMemo(() => JSON.stringify(jsonLd) ?? "", [jsonLd]);
  React.useLayoutEffect(() => {
    seoStamp += 1; // last mounted/updated instance wins
    applyMeta({
      title,
      description,
      canonical: canonicalPath !== undefined ? buildCanonical(canonicalPath) : undefined,
      noindex,
      ogImage: ogImage ?? SITE.ogImage,
      ogType,
      ogUrl: canonicalPath !== undefined ? buildCanonical(canonicalPath) : undefined,
      jsonLd: jsonLd !== undefined ? JSON.stringify(jsonLd) : null,
    });
  }, [title, description, canonicalPath, noindex, ogImage, ogType, jsonLdKey]);

  return null;
}
