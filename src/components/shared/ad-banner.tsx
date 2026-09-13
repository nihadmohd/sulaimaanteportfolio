"use client";

import * as React from "react";
import { ArrowRight, X } from "lucide-react";
import {
  AD_MARQUEE_CSS,
  ImageAdBanner,
  SponsoredLabel,
  adHref,
  adRel,
  adTarget,
  isRenderableAd,
  runAdAnchorClick,
  useAdInteraction,
  useAdsForPlacement,
} from "@/components/shared/affiliate-ad-slot";
import { cn } from "@/lib/utils";
import type { AdDTO } from "@/types";

/**
 * AdBanner family — site-wide DB ad units rendered once from AppShell
 * (Task 9-e). All fetch via useAdsForPlacement and null-render when ads
 * are disabled or no live ad exists, so the shell layout never shifts:
 *
 *   AdHeaderBanner → slim promo band directly below the site header
 *                    (text ads → one-line band; image ads → framed banner)
 *   AdMarqueeStrip → full-width auto-scrolling store-picks strip with a
 *                    "Fresh in the store" title chip (pauses on hover)
 *   AdFooterBanner → compact promo band above the site footer
 *   AdSticker      → floating circular sticker ad (bottom-right, gold ring
 *                    + pulse, dismissible per session)
 *
 * Clicks/impressions go through the shared useAdInteraction flow.
 */

const STICKER_DISMISS_KEY = "mnkp_sticker_dismissed_";

/** Header/footer bands only make sense for text + image ads. */
function findBandAd(ads: AdDTO[]): AdDTO | null {
  return ads.find((ad) => isRenderableAd(ad) && ad.type !== "marquee") ?? null;
}

/* ------------------------------------------------------------------ */
/* slim text band (shared by header + footer banners)                  */
/* ------------------------------------------------------------------ */

function TextAdBand({ ad, borders }: { ad: AdDTO; borders: "bottom" | "top" }) {
  const { handleClick } = useAdInteraction(ad);

  return (
    <aside
      role="complementary"
      aria-label="Sponsored banner"
      className={cn(
        "w-full bg-gold/[0.05]",
        borders === "bottom" ? "border-b border-dashed border-gold/40" : "border-t border-dashed border-gold/40"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 md:px-6">
        <SponsoredLabel className="shrink-0" />
        <a
          href={adHref(ad)}
          rel={adRel(ad)}
          target={adTarget(ad)}
          onClick={(event) => runAdAnchorClick(event, handleClick)}
          className="group flex min-w-0 flex-1 items-center gap-x-3 gap-y-1 rounded-lg py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-primary">
            {ad.title ?? ad.name}
          </span>
          {ad.body ? (
            <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground lg:inline">
              {ad.body}
            </span>
          ) : null}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gold underline-offset-4 group-hover:underline">
            {ad.linkLabel}
            <ArrowRight className="size-3" aria-hidden="true" />
          </span>
        </a>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* header banner                                                       */
/* ------------------------------------------------------------------ */

export function AdHeaderBanner() {
  const { ads } = useAdsForPlacement("header-banner");
  const ad = findBandAd(ads);

  if (!ad) return null;

  if (ad.type === "image" || ad.type === "gif") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:px-6">
        <ImageAdBanner ad={ad} />
      </div>
    );
  }

  return <TextAdBand ad={ad} borders="bottom" />;
}

/* ------------------------------------------------------------------ */
/* scrolling store-picks strip                                         */
/* ------------------------------------------------------------------ */

export function AdMarqueeStrip() {
  const { ads } = useAdsForPlacement("marquee");
  const ad =
    ads.find((a) => a.type === "marquee" && a.images.filter(Boolean).length > 0) ?? null;
  const { handleClick } = useAdInteraction(ad);

  if (!ad) return null;
  const images = ad.images.filter((src): src is string => Boolean(src));

  return (
    <section
      aria-label="Sponsored store picks"
      className="w-full border-b border-dashed border-gold/40 bg-gold/[0.04]"
    >
      <style>{AD_MARQUEE_CSS}</style>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 md:px-6">
        <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-gold">
          {ad.title ?? "Fresh in the store"}
        </span>
        <div className="mnkp-ad-marquee min-w-0 flex-1">
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
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* footer banner                                                       */
/* ------------------------------------------------------------------ */

export function AdFooterBanner() {
  const { ads } = useAdsForPlacement("footer-banner");
  const ad = findBandAd(ads);

  if (!ad) return null;

  if (ad.type === "image" || ad.type === "gif") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-6 sm:px-6 md:px-8">
        <ImageAdBanner ad={ad} />
      </div>
    );
  }

  return <TextAdBand ad={ad} borders="top" />;
}

/* ------------------------------------------------------------------ */
/* floating sticker ad                                                 */
/* ------------------------------------------------------------------ */

export function AdSticker() {
  const { ads } = useAdsForPlacement("sticker");
  const ad =
    ads.find((a) => a.type === "sticker" && (Boolean(a.imageUrl) || Boolean(a.title))) ?? null;
  const [dismissed, setDismissed] = React.useState(true);
  const { handleClick } = useAdInteraction(ad);

  React.useEffect(() => {
    if (!ad) return;
    try {
      if (window.sessionStorage.getItem(STICKER_DISMISS_KEY + ad.id) === null) {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [ad]);

  if (!ad || dismissed) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(STICKER_DISMISS_KEY + ad.id, "1");
    } catch {
      /* storage unavailable — hide for this render only */
    }
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-40 right-4 z-30 print:hidden md:bottom-24">
      {/* gold ring + soft pulse (stacked above the decorative br sticker) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 animate-pulse rounded-full ring-2 ring-gold/50"
      />
      <a
        href={adHref(ad)}
        rel={adRel(ad)}
        target={adTarget(ad)}
        onClick={(event) => runAdAnchorClick(event, handleClick)}
        aria-label={`Sponsored sticker — ${ad.title ?? ad.name}`}
        className="relative flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-gold/60 bg-gold/10 shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-16"
      >
        {ad.imageUrl ? (
          <img
            src={ad.imageUrl}
            alt={ad.imageAlt ?? ad.title ?? ad.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="px-2 text-center text-xs font-semibold leading-tight text-gold">
            {ad.title ?? ad.name}
          </span>
        )}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss sponsored sticker"
        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
