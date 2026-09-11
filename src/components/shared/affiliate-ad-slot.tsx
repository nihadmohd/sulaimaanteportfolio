"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ALink } from "@/components/router/link";
import { Stars, formatINR, type ProductCardData } from "@/components/shared/product-card";
import { adsEnabled, useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

/**
 * AffiliateAdSlot — contract §11.
 * Fetches featured products (GET /api/products?featured=1&limit=3), rotates the
 * selection per placement so slots differ, and renders compact horizontal cards
 * inside a gold DASHED border with a "Sponsored — affiliate links" disclosure.
 * Renders nothing while loading, when ads are disabled, or when empty/failed
 * (all graceful — the /api endpoints land in later waves).
 */

export type AdPlacement = "blog-inline" | "blog-sidebar" | "home-strip" | "store-side";

export interface AffiliateAdSlotProps {
  placement: AdPlacement;
  className?: string;
}

/** Stable string hash → rotate featured products per placement. */
function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function fetchFeaturedAds(): Promise<ProductCardData[]> {
  try {
    const res = await fetch("/api/products?featured=1&limit=3");
    if (!res.ok) return [];
    const json = (await res.json()) as {
      ok: boolean;
      data?: { items?: Array<Record<string, unknown>> };
    };
    if (!json.ok || !Array.isArray(json.data?.items)) return [];
    return json.data.items.map((raw) => ({
      slug: String(raw.slug ?? ""),
      name: String(raw.name ?? "Featured pick"),
      tagline: raw.tagline != null ? String(raw.tagline) : null,
      image: raw.image != null ? String(raw.image) : null,
      price: Number(raw.price ?? 0),
      compareAtPrice: raw.compareAtPrice != null ? Number(raw.compareAtPrice) : null,
      rating: raw.rating != null ? Number(raw.rating) : null,
      clicks: raw.clicks != null ? Number(raw.clicks) : null,
      merchant: raw.merchant != null ? String(raw.merchant) : null,
    }));
  } catch {
    return [];
  }
}

export function AffiliateAdSlot({ placement, className }: AffiliateAdSlotProps) {
  const settings = useSettings();
  const productsQuery = useQuery({
    queryKey: ["ads", "featured"],
    queryFn: fetchFeaturedAds,
    enabled: adsEnabled(settings.data),
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Silent while loading; hidden when disabled, failed or empty.
  if (!adsEnabled(settings.data)) return null;
  if (productsQuery.isPending) return null;
  const products = productsQuery.data ?? [];
  if (products.length === 0) return null;

  const offset = hashString(placement) % products.length;
  const rotated = [...products.slice(offset), ...products.slice(0, offset)];

  return (
    <aside
      role="complementary"
      aria-label="Sponsored affiliate products"
      className={cn("rounded-xl border border-dashed border-gold/50 bg-gold/[0.04] p-4", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Sponsored — affiliate links
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About affiliate links"
              className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-56 text-xs">
            MN.KP may earn a commission when you buy through these links — at no extra cost to you.
            Every pick is honestly reviewed. See the affiliate disclosure.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="gold-rule mt-3 mb-4 w-full" aria-hidden="true" />

      <ul className="space-y-3">
        {rotated.map((product) => (
          <li key={product.slug}>
            <ALink
              href={`#/store/${product.slug}`}
              className="group flex items-center gap-3 rounded-lg border border-transparent bg-card/60 p-2 transition-colors hover:border-gold/40"
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-gold/30 to-primary/25"
                >
                  <span className="text-xs font-semibold text-gold-foreground">MN.KP</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight group-hover:text-primary">
                  {product.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {formatINR(product.price)}
                  </span>
                  <Stars rating={product.rating} />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-gold underline-offset-2 group-hover:underline">
                View deal
              </span>
            </ALink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
