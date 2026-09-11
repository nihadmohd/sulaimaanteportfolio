"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { ALink } from "@/components/router/link";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Breadcrumbs — semantic breadcrumb trail with optional BreadcrumbList JSON-LD.
 * Last item gets aria-current="page"; internal hrefs route through ALink.
 */

export interface BreadcrumbItem {
  label: string;
  /** Hash-route href (e.g. "#/blog"); omit for the current page. */
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Inject BreadcrumbList JSON-LD (default true). */
  jsonLd?: boolean;
  className?: string;
}

export function Breadcrumbs({ items, jsonLd = true, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const ld =
    jsonLd && items.length > 1
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, index) => {
            let url: string | undefined;
            if (item.href) {
              const clean = item.href.replace(/^#/, "");
              url = `${SITE.url}${clean.startsWith("/") ? clean : `/${clean}`}`;
            }
            return {
              "@type": "ListItem",
              position: index + 1,
              name: item.label,
              ...(url ? { item: url } : {}),
            };
          }),
        }
      : null;

  return (
    <nav aria-label="breadcrumb" className={cn("w-full", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <ALink href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </ALink>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(isLast && "font-medium text-foreground")}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
      {ld ? (
        <script type="application/ld+json">{JSON.stringify(ld)}</script>
      ) : null}
    </nav>
  );
}
