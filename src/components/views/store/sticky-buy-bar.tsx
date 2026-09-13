"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/product-card";
import { cn } from "@/lib/utils";
import type { ProductDTO } from "@/types";

/**
 * StickyBuyBar — mobile-only fixed purchase bar (Amazon-app pattern).
 *
 * Appears with a slide-up transition once the user has scrolled PAST the
 * in-page price/buy card (IntersectionObserver on that card — not merely
 * below the fold), and hides again when the card scrolls back into view.
 * Sits directly above the bottom tab bar (3.5rem + safe-area) with the
 * same glass treatment. The CTA calls the SAME tracked affiliate handler
 * as the main buy button — click logging first, merchant tab after.
 */

export interface StickyBuyBarProps {
  product: ProductDTO;
  /** Tracked affiliate CTA handler shared with the main buy button. */
  onCta: () => void;
  /** Ref attached to the in-page price/buy card. */
  priceCardRef: React.RefObject<HTMLDivElement | null>;
}

export function StickyBuyBar({ product, onCta, priceCardRef }: StickyBuyBarProps) {
  const [past, setPast] = React.useState(false);

  React.useEffect(() => {
    const target = priceCardRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        // "Past" = the card has left the viewport through the TOP
        // (not simply sitting below the fold, un-reached).
        const scrolledPast = entry.boundingClientRect.top < 0;
        setPast(!entry.isIntersecting && scrolledPast);
      },
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [priceCardRef]);

  const price =
    product.price != null ? formatINR(product.price) : "Price at merchant";

  // Portal to document.body: the view wrapper's content-visibility
  // ("cv-auto") forms a containing block for fixed descendants, so a
  // portal is required for true viewport-anchored positioning.
  return createPortal(
    <div
      role="region"
      aria-label="Quick buy"
      aria-hidden={!past}
      inert={!past}
      className={cn(
        "fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-gold/25",
        "bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75",
        "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        "md:hidden",
        past ? "translate-y-0" : "pointer-events-none translate-y-[135%]"
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="size-10 shrink-0 rounded-lg border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted"
          >
            <Package className="size-4 text-foreground/60" strokeWidth={1.5} />
          </span>
        )}

        <div className="min-w-0 max-w-[45%] flex-1">
          <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-gold">{price}</p>
        </div>

        <Button
          size="sm"
          onClick={onCta}
          className="press-sm h-10 shrink-0 gap-1.5 border border-gold/60 bg-gold px-4 font-semibold text-gold-foreground shadow-md transition-colors hover:bg-gold/90"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          View deal
        </Button>
      </div>
    </div>,
    document.body
  );
}
