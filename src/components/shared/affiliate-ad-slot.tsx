"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ALink } from "@/components/router/link";
import { Stars, formatINR, type ProductCardData } from "@/components/shared/product-card";
import { adsEnabled, useSettings } from "@/hooks/use-settings";
import { navigate } from "@/hooks/use-router";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AdDTO, AdPlacement } from "@/types";

/**
 * AffiliateAdSlot — contract §11, upgraded in Task 9-e to be DB-first.
 *
 * Serves admin-managed ads (GET /api/ads?placement=X → {items}, query key
 * ["ads", placement], staleTime 60s) and renders the FIRST renderable ad
 * (the API already sorts active+in-schedule ads by priority):
 *
 *   text        → compact gold-dashed promo card: "Sponsored" micro-label +
 *                 title (font-semibold) + body (text-sm muted, line-clamp-2)
 *                 + linkLabel CTA. ~py-3.
 *   image / gif → rounded aspect-[7/2] banner inside a gold-dashed frame +
 *                 "Sponsored" micro-label row; alt = imageAlt || title.
 *   marquee     → auto-scrolling strip of ad.images (duplicated for a
 *                 seamless loop, pauses on hover) + caption title.
 *   sticker     → never rendered here — the site-wide <AdSticker/> owns it.
 *
 * FALLBACK: when the placement has no DB ad, the slot serves the legacy
 * featured-products behavior (GET /api/products?featured=1&limit=3, rotated
 * per placement). Renders nothing while loading, when ads are disabled via
 * settings, or when empty/failed.
 *
 * Click flow: POST /api/ads/:id/click → data.url — "#/…" routes navigate
 * in-app (hash router), anything else opens via window.open(...,
 * "noopener,noreferrer"). External anchors carry rel="sponsored noopener
 * noreferrer". Impressions fire once per mount per ad id (useRef guard,
 * fire-and-forget).
 *
 * Shared plumbing (useAdsForPlacement / useAdInteraction / anchor helpers /
 * AD_MARQUEE_CSS / TextAdCard / ImageAdBanner / MarqueeAdStrip) is exported
 * for the site-wide units in ad-banner.tsx.
 */

export type { AdPlacement };

/* ------------------------------------------------------------------ */
/* shared ad plumbing (reused by ad-banner.tsx site-wide units)        */
/* ------------------------------------------------------------------ */

/** Scoped keyframes for ad marquees (dedup-safe when rendered twice). */
export const AD_MARQUEE_CSS = `
@keyframes mnkp-ad-marquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.mnkp-ad-marquee { overflow: hidden; }
.mnkp-ad-marquee__track { display: flex; width: max-content; animation: mnkp-ad-marquee 36s linear infinite; }
.mnkp-ad-marquee:hover .mnkp-ad-marquee__track,
.mnkp-ad-marquee:focus-within .mnkp-ad-marquee__track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .mnkp-ad-marquee__track { animation: none; } }
`;

export interface AdsForPlacementResult {
  /** Priority-sorted live ads for the placement (empty while disabled/loading). */
  ads: AdDTO[];
  /** True once the query settled (success or error) or ads are disabled. */
  isResolved: boolean;
}

/** Public ad delivery for one placement (gated behind adsEnabled settings). */
export function useAdsForPlacement(placement: AdPlacement): AdsForPlacementResult {
  const settings = useSettings();
  const enabled = adsEnabled(settings.data);
  const query = useQuery({
    queryKey: ["ads", placement],
    queryFn: () =>
      apiFetch<{ items: AdDTO[] }>(`/api/ads?placement=${encodeURIComponent(placement)}`),
    enabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (!enabled) return { ads: [], isResolved: true };
  if (query.isPending) return { ads: [], isResolved: false };
  return { ads: query.data?.items ?? [], isResolved: true };
}

/** Can this ad render in a slot? Sticker ads never do (AdSticker owns them). */
export function isRenderableAd(ad: AdDTO): boolean {
  switch (ad.type) {
    case "text":
      return Boolean(ad.title || ad.body);
    case "image":
    case "gif":
      return Boolean(ad.imageUrl);
    case "marquee":
      return ad.images.filter(Boolean).length > 0;
    case "sticker":
      return false;
    default:
      return false;
  }
}

function openAdUrl(url: string): void {
  if (url.startsWith("#/")) {
    navigate(url.slice(1));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** href for the rendered anchor (in-app "#/..." kept as-is, external URL). */
export function adHref(ad: AdDTO): string {
  return ad.linkUrl || "#";
}

/** rel semantics for external ad links ("sponsored" per SEO guidelines). */
export function adRel(ad: AdDTO): "sponsored noopener noreferrer" | undefined {
  const url = ad.linkUrl;
  if (!url || url.startsWith("#/")) return undefined;
  return "sponsored noopener noreferrer";
}

/** External ad links open in a new tab; in-app routes stay in the SPA. */
export function adTarget(ad: AdDTO): "_blank" | undefined {
  const url = ad.linkUrl;
  if (!url || url.startsWith("#/")) return undefined;
  return "_blank";
}

/**
 * Click + impression tracking for one ad.
 * Impression: POST /api/ads/:id/impression — once per mount per ad id.
 * Click: POST /api/ads/:id/click → open data.url in-app or in a new tab.
 */
export function useAdInteraction(ad: AdDTO | null | undefined) {
  const seen = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!ad || seen.current === ad.id) return;
    seen.current = ad.id;
    apiFetch(`/api/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {
      /* fire-and-forget */
    });
  }, [ad]);

  const handleClick = React.useCallback(() => {
    if (!ad) return;
    apiFetch<{ id: string; url: string | null }>(`/api/ads/${ad.id}/click`, { method: "POST" })
      .then((data) => {
        if (data.url) openAdUrl(data.url);
      })
      .catch(() => {
        /* tracking failed — still honor the destination */
        if (ad.linkUrl) openAdUrl(ad.linkUrl);
      });
  }, [ad]);

  return { handleClick };
}

/**
 * Anchor onClick wrapper: plain left clicks are prevented so the tracked
 * click flow runs; modified clicks (cmd/ctrl/shift/alt) keep native behavior.
 */
export function runAdAnchorClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  handleClick: () => void
): void {
  if (event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (event.button !== 0) return;
  event.preventDefault();
  handleClick();
}

/** Tiny uppercase "Sponsored" micro-label (gold, tracked). */
export function SponsoredLabel({ className }: { className?: string }) {
  return (
    <p className={cn("text-[10px] font-medium uppercase tracking-[0.2em] text-gold", className)}>
      Sponsored
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* DB ad renderers by type                                             */
/* ------------------------------------------------------------------ */

export function TextAdCard({ ad, className }: { ad: AdDTO; className?: string }) {
  const { handleClick } = useAdInteraction(ad);

  return (
    <aside
      role="complementary"
      aria-label="Sponsored promotion"
      className={cn(
        "rounded-xl border border-dashed border-gold/50 bg-gold/[0.04] px-4 py-3",
        className
      )}
    >
      <SponsoredLabel />
      <a
        href={adHref(ad)}
        rel={adRel(ad)}
        target={adTarget(ad)}
        onClick={(event) => runAdAnchorClick(event, handleClick)}
        className="group mt-1.5 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-sm font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
          {ad.title ?? ad.name}
        </p>
        {ad.body ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {ad.body}
          </p>
        ) : null}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold underline-offset-4 group-hover:underline">
          {ad.linkLabel}
          <ArrowRight
            className="size-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </a>
    </aside>
  );
}

export function ImageAdBanner({ ad, className }: { ad: AdDTO; className?: string }) {
  const { handleClick } = useAdInteraction(ad);

  return (
    <aside
      role="complementary"
      aria-label="Sponsored banner"
      className={cn(
        "overflow-hidden rounded-xl border border-dashed border-gold/50 bg-gold/[0.04]",
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <SponsoredLabel />
      </div>
      <a
        href={adHref(ad)}
        rel={adRel(ad)}
        target={adTarget(ad)}
        onClick={(event) => runAdAnchorClick(event, handleClick)}
        className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={ad.imageUrl ?? ""}
          alt={ad.imageAlt ?? ad.title ?? ad.name}
          loading="lazy"
          decoding="async"
          className="aspect-[7/2] w-full object-cover"
        />
      </a>
    </aside>
  );
}

export function MarqueeAdStrip({ ad, className }: { ad: AdDTO; className?: string }) {
  const { handleClick } = useAdInteraction(ad);
  const images = ad.images.filter((src): src is string => Boolean(src));
  if (images.length === 0) return null;

  return (
    <aside
      role="complementary"
      aria-label="Sponsored product strip"
      className={cn(
        "rounded-xl border border-dashed border-gold/50 bg-gold/[0.04] p-3",
        className
      )}
    >
      <style>{AD_MARQUEE_CSS}</style>
      {ad.title ? (
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
          Sponsored · {ad.title}
        </p>
      ) : (
        <SponsoredLabel className="mb-2" />
      )}
      <div className="mnkp-ad-marquee">
        <a
          href={adHref(ad)}
          rel={adRel(ad)}
          target={adTarget(ad)}
          onClick={(event) => runAdAnchorClick(event, handleClick)}
          className="mnkp-ad-marquee__track"
        >
          {[...images, ...images].map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className="mx-1.5 h-16 w-auto shrink-0 rounded-lg border border-border/60 object-cover sm:h-20"
            />
          ))}
        </a>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* featured-products fallback (legacy behavior)                        */
/* ------------------------------------------------------------------ */

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

function FeaturedProductsFallback({
  placement,
  products,
  className,
}: {
  placement: AdPlacement;
  products: ProductCardData[];
  className?: string;
}) {
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
                  alt={product.name}
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

/* ------------------------------------------------------------------ */
/* the slot                                                            */
/* ------------------------------------------------------------------ */

export interface AffiliateAdSlotProps {
  placement: AdPlacement;
  className?: string;
}

export function AffiliateAdSlot({ placement, className }: AffiliateAdSlotProps) {
  const settings = useSettings();
  const { ads, isResolved } = useAdsForPlacement(placement);

  // Featured-products fallback only loads when the placement has no DB ads.
  const productsQuery = useQuery({
    queryKey: ["ads", "featured"],
    queryFn: fetchFeaturedAds,
    enabled: adsEnabled(settings.data) && isResolved && ads.length === 0,
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Silent while ads are disabled or DB ads are still loading.
  if (!adsEnabled(settings.data)) return null;

  const ad = ads.find(isRenderableAd) ?? null;
  if (ad) {
    if (ad.type === "text") return <TextAdCard ad={ad} className={className} />;
    if (ad.type === "image" || ad.type === "gif") {
      return <ImageAdBanner ad={ad} className={className} />;
    }
    if (ad.type === "marquee") return <MarqueeAdStrip ad={ad} className={className} />;
    return null;
  }

  // No DB ad for this placement → legacy featured-products behavior.
  if (productsQuery.isPending) return null;
  const products = productsQuery.data ?? [];
  if (products.length === 0) return null;

  return <FeaturedProductsFallback placement={placement} products={products} className={className} />;
}
