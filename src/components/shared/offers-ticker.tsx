"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgePercent, Gift, Sparkles, Ticket, Wallet } from "lucide-react";
import { ALink } from "@/components/router/link";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { OfferKind, Paginated, ProductDTO } from "@/types";

/**
 * OffersTicker (Task 14) — an ad-like auto-scrolling strip of the owner's
 * LIVE product special offers. Placed on the home page and the store, it
 * works exactly like a marquee ad: eye-catching chips, each clicking
 * through to the product page. Hidden entirely when no offers are running.
 *
 * Copy discipline: chips only ever show the buyer-facing headline the owner
 * wrote — never any commission/margin context.
 */

const KIND_ICON: Record<OfferKind, typeof BadgePercent> = {
    deal: BadgePercent,
    cashback: Wallet,
    coupon: Ticket,
    bundle: Gift,
    giveaway: Sparkles,
};

interface TickerOffer {
    slug: string;
    name: string;
    offerTitle: string | null;
    offerKind: OfferKind;
    offerCode: string | null;
    offerEndsAt: string | null;
    price: number | null;
}

/** Is the offer window live on the client right now? */
function offerLive(product: ProductDTO): boolean {
    if (!product.offerActive) return false;
    const now = Date.now();
    if (product.offerStartsAt && new Date(product.offerStartsAt).getTime() > now) return false;
    if (product.offerEndsAt && new Date(product.offerEndsAt).getTime() < now) return false;
    return true;
}

function countdownLabel(endsAt: string | null): string | null {
    if (!endsAt) return null;
    const ms = new Date(endsAt).getTime() - Date.now();
    if (Number.isNaN(ms) || ms <= 0) return null;
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `Ends in ${days}d ${hours % 24}h`;
    }
    if (hours >= 1) return `Ends in ${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
    return `Ends in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export function OffersTicker({ compact = false }: { compact?: boolean }) {
    const offersQuery = useQuery({
        queryKey: ["offers-ticker"],
        queryFn: () =>
            apiFetch<Paginated<ProductDTO>>("/api/products?offer=1&sort=popular&limit=12"),
        staleTime: 60_000,
        retry: 1,
    });

    const offers: TickerOffer[] = React.useMemo(
        () =>
            (offersQuery.data?.items ?? [])
                .filter(offerLive)
                .map((p) => ({
                    slug: p.slug,
                    name: p.name,
                    offerTitle: p.offerTitle,
                    offerKind: p.offerKind,
                    offerCode: p.offerCode,
                    offerEndsAt: p.offerEndsAt,
                    price: p.price,
                })),
        [offersQuery.data]
    );

    // No live offers → the whole strip disappears (zero layout shift risk is
    // acceptable here; the strip is async by nature).
    if (offers.length === 0) return null;

    const chips = [...offers, ...offers]; // duplicate for the seamless loop

    return (
        <section
      aria-label="Live special offers"
    className = {
        cn(
        "relative isolate overflow-hidden border-y border-gold/25 bg-gradient-to-r from-gold/[0.08] via-gold/[0.14] to-gold/[0.08]",
            compact? "py-1.5" : "py-2.5"
        )
    }
        >
        <div className="mnkp-offers-track" aria-hidden="true">
            <ul className="flex w-max items-center gap-3 pr-3" >
            {
                chips.map((offer, i) => {
                    const Icon = KIND_ICON[offer.offerKind] ?? BadgePercent;
                    const countdown = countdownLabel(offer.offerEndsAt);
                    return (
                        <li key= {`${offer.slug}-${i}`
                }>
                <ALink
                  href={`#/store/${offer.slug}`}
    className = "group flex items-center gap-2.5 rounded-full border border-gold/30 bg-background/80 py-1.5 pl-2.5 pr-3.5 shadow-xs backdrop-blur-sm transition-colors hover:border-gold hover:bg-gold/10"
        >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold/15 text-gold" >
            <Icon className="size-3.5" aria-hidden="true" />
                </span>
                < span className = "flex flex-col" >
                    <span className="max-w-[220px] truncate text-xs font-semibold leading-tight text-foreground group-hover:text-primary sm:max-w-none" >
                        { offer.offerTitle || "Special offer" }
                        </span>
                        < span className = "max-w-[220px] truncate text-[10px] leading-tight text-muted-foreground sm:max-w-none" >
                            { offer.name }
    { countdown ? ` · ${countdown}` : "" }
    </span>
        </span>
    {
        offer.offerCode ? (
            <span className= "rounded bg-gold px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-gold-foreground" >
            { offer.offerCode }
            </span>
                  ) : null
    }
    <ArrowRight
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
    aria-hidden="true"
        />
        </ALink>
        </li>
            );
})}
</ul>
    </div>
    < style > {`
        .mnkp-offers-track { overflow: hidden; }
        .mnkp-offers-track > ul { animation: mnkp-offers-scroll 36s linear infinite; }
        .mnkp-offers-track:hover > ul, .mnkp-offers-track:focus-within > ul { animation-play-state: paused; }
        @keyframes mnkp-offers-scroll { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
        @media (prefers-reduced-motion: reduce) { .mnkp-offers-track > ul { animation: none; } }
      `}</style>
    </section>
  );
}
