"use client";

import * as React from "react";
import { Package } from "lucide-react";
import { ALink } from "@/components/router/link";
import { SectionHeading } from "@/components/shared/section-heading";
import { Stars, formatINR } from "@/components/shared/product-card";
import type { ProductDTO } from "@/types";

/**
 * CompareStrip — "Compare before you commit" horizontal rail.
 *
 * The current product plus up to 3 related items (reuses the product
 * page's related-query data — no extra fetch) as compact cards: thumb,
 * name, price, rating stars and a one-line "Best for" callout
 * (lowest price → Tightest budget · highest rating → Top rated ·
 * else → Balanced pick). The current product gets a copper
 * "You're viewing" chip. Only renders with 2+ products. Tapping a
 * card routes in-app to that product (#/store/:slug).
 */

export interface CompareStripProps {
  current: ProductDTO;
  /** Related products already fetched by the product page. */
  related: ProductDTO[];
}

function deriveBestFor(items: ProductDTO[], slug: string): string {
  const priced = items.filter((p) => p.price != null);
  const cheapest =
    priced.length >= 2
      ? priced.reduce((min, p) => ((p.price ?? 0) < (min.price ?? 0) ? p : min)).slug
      : null;
  if (slug === cheapest) return "Tightest budget";

  const rated = items.filter((p) => p.rating > 0);
  const topRated =
    rated.length >= 2 ? rated.reduce((max, p) => (p.rating > max.rating ? p : max)).slug : null;
  if (slug === topRated) return "Top rated";

  return "Balanced pick";
}

export function CompareStrip({ current, related }: CompareStripProps) {
  const items = React.useMemo(
    () => [current, ...related.filter((p) => p.slug !== current.slug).slice(0, 3)],
    [current, related]
  );

  if (items.length < 2) return null;

  return (
    <section className="mt-14" aria-label="Compare products">
      <SectionHeading
        microLabel="Decide smart"
        title="Compare before you commit"
      />
      <div className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((item) => {
          const isCurrent = item.slug === current.slug;
          const bestFor = isCurrent ? null : deriveBestFor(items, item.slug);
          return (
            <ALink
              key={item.slug}
              href={`#/store/${item.slug}`}
              aria-label={`Compare ${item.name}`}
              className="press group flex w-40 shrink-0 snap-start flex-col rounded-xl border bg-card p-3 shadow-xs transition-shadow hover:shadow-md sm:w-44"
            >
              <div className="flex items-start gap-2.5">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="size-14 shrink-0 rounded-lg border bg-muted object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-gold/30 via-gold/10 to-primary/25"
                  >
                    <Package className="size-5 text-foreground/60" strokeWidth={1.5} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {isCurrent ? (
                    <span className="mb-1 inline-block rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
                      You&rsquo;re viewing
                    </span>
                  ) : null}
                  <p className="line-clamp-2 text-xs font-semibold leading-snug tracking-tight group-hover:text-primary">
                    {item.name}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tabular-nums text-primary">
                  {item.price != null ? formatINR(item.price) : "Price at merchant"}
                </span>
                <Stars rating={item.rating} />
              </div>

              <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {isCurrent ? "This pick" : bestFor}
              </p>
            </ALink>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground sm:hidden">
        Swipe the rail — tap a card for its full review.
      </p>
    </section>
  );
}
