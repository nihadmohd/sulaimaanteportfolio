"use client";

import * as React from "react";
import { ArrowRight, MousePointerClick, Package, Percent, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ALink } from "@/components/router/link";
import { cn } from "@/lib/utils";

/**
 * ProductCard — affiliate store card. INR formatting + star rating helpers
 * are exported here for reuse (AffiliateAdSlot uses the same primitives).
 */

export interface ProductCardData {
  slug: string;
  name: string;
  tagline?: string | null;
  image?: string | null;
  price: number;
  compareAtPrice?: number | null;
  rating?: number | null;
  clicks?: number | null;
  merchant?: string | null;
  /** Live special-offer label (Task 14) — renders a gold badge on the card. */
  offerLabel?: string | null;
}

/** INR currency formatting: 29990 → "₹29,990". */
export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export interface StarsProps {
  rating?: number | null;
  className?: string;
  showValue?: boolean;
  size?: "sm" | "md";
}

/** Five-star rating row (amber fill) with optional numeric value. */
export function Stars({ rating, className, showValue = false, size = "sm" }: StarsProps) {
  if (rating == null || rating <= 0) return null;
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  const dim = size === "sm" ? "size-3" : "size-4";
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={`Rated ${rating.toFixed(1)} out of 5`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(dim, i < full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
            strokeWidth={1.5}
          />
        ))}
      </span>
      {showValue ? (
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

export interface ProductCardProps {
  product: ProductCardData;
  /** compact = mini card for 2-col mobile grids. */
  size?: "default" | "compact";
  className?: string;
}

export function ProductCard({ product, size = "default", className }: ProductCardProps) {
  const href = `#/store/${product.slug}`;
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  const imageBlock = (imageClasses: string) =>
    product.image ? (
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        decoding="async"
        className={cn(imageClasses, "object-cover")}
      />
    ) : (
      <div
        aria-hidden="true"
        className={cn(
          imageClasses,
          "flex items-center justify-center bg-gradient-to-br from-gold/30 via-gold/10 to-primary/25"
        )}
      >
        <Package className="size-10 text-foreground/60" strokeWidth={1.5} />
      </div>
    );

  if (size === "compact") {
    return (
      <ALink
        href={href}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md",
          className
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {imageBlock("size-full transition-transform duration-300 group-hover:scale-[1.04]")}
          {product.offerLabel ? (
            <Badge className="absolute left-2 top-2 gap-1 bg-gold text-gold-foreground">
              <Percent className="size-3" aria-hidden="true" />
              Offer
            </Badge>
          ) : null}
          {discount > 0 ? (
            <Badge className="absolute right-2 top-2 bg-gold text-gold-foreground">
              -{discount}%
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug tracking-tight group-hover:text-primary">
            {product.name}
          </h3>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-semibold tabular-nums text-primary">
              {formatINR(product.price)}
            </span>
            <Stars rating={product.rating} />
          </div>
        </div>
      </ALink>
    );
  }

  return (
    <ALink
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:shadow-md",
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {imageBlock("size-full transition-transform duration-300 group-hover:scale-[1.03]")}
        {product.offerLabel ? (
          <Badge className="absolute left-3 top-3 gap-1 bg-gold text-gold-foreground">
            <Percent className="size-3" aria-hidden="true" />
            {product.offerLabel}
          </Badge>
        ) : null}
        {discount > 0 ? (
          <Badge className="absolute right-3 top-3 bg-gold text-gold-foreground">
            -{discount}% off
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        {product.tagline ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{product.tagline}</p>
        ) : null}
        <h3 className="mt-1 text-balance font-semibold leading-snug tracking-tight group-hover:text-primary md:text-lg">
          {product.name}
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums text-primary">
            {formatINR(product.price)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="text-sm tabular-nums text-muted-foreground line-through">
              {formatINR(product.compareAtPrice)}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Stars rating={product.rating} showValue />
          {product.clicks != null ? (
            <span
              className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
              title="People who checked this out"
            >
              <MousePointerClick className="size-3.5" aria-hidden="true" />
              {product.clicks}
            </span>
          ) : null}
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          View details
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </ALink>
  );
}
