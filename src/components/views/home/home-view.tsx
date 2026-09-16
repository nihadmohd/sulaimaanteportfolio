"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { DataState } from "@/components/states";
import {
  AffiliateAdSlot,
  adHref,
  adRel,
  adTarget,
  runAdAnchorClick,
  useAdsForPlacement,
} from "@/components/shared/affiliate-ad-slot";
import { LiveVisitorBadge } from "@/components/shared/live-visitor-badge";
import { OffersTicker } from "@/components/shared/offers-ticker";
import { PostCard, type PostCardData } from "@/components/shared/post-card";
import { ProductCard, formatINR, type ProductCardData } from "@/components/shared/product-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { navigate } from "@/hooks/use-router";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import { ABOUT_PARAGRAPHS, BRANDS, PROJECTS, SERVICES, STATS } from "@/lib/content";
import { cn } from "@/lib/utils";
import type { AdDTO, MarqueeSpeed, Paginated, PostDTO, ProductDTO } from "@/types";

/**
 * HomeView — route key "home" (#/).
 *
 * Professional editorial landing page: typographic hero, hairline stat band,
 * services, featured writing, affiliate strip, store picks, brands, about
 * teaser, newsletter and a final CTA. Calm hierarchy, generous whitespace,
 * one restrained copper accent on a graphite-and-stone system.
 */

const MARQUEE_CSS = `
@keyframes mnkp-marquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.mnkp-marquee { overflow: hidden; }
.mnkp-marquee__track { display: flex; width: max-content; animation: mnkp-marquee 42s linear infinite; }
.mnkp-marquee__track--reverse { animation-direction: reverse; }
.mnkp-marquee:hover .mnkp-marquee__track, .mnkp-marquee:focus-within .mnkp-marquee__track { animation-play-state: paused; }
.mnkp-marquee--fade {
  -webkit-mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
}
@media (prefers-reduced-motion: reduce) { .mnkp-marquee__track { animation: none; } }
`;

/** Hero marquee lane durations per speed preset (Task 12-d). */
const MARQUEE_DURATION: Record<MarqueeSpeed, string> = {
  slow: "60s",
  normal: "42s",
  fast: "28s",
};

function toPostCard(p: PostDTO): PostCardData {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImageUrl,
    category: p.category?.name ?? null,
    readingMinutes: p.readingTimeMinutes,
    views: p.viewsCount,
    author: p.author ? { name: p.author.fullName, avatarUrl: p.author.avatarUrl } : null,
    publishedAt: p.publishedAt,
  };
}

function toProductCard(p: ProductDTO): ProductCardData {
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    image: p.imageUrl,
    price: p.price ?? 0,
    compareAtPrice: p.compareAtPrice,
    rating: p.rating,
    clicks: p.clicksCount,
    merchant: p.merchant,
  };
}

/** Featured first, topped up with the newest posts so grids stay full. */
function useHomePosts(limit: number) {
  return useQuery({
    queryKey: ["posts", "home-featured", limit],
    queryFn: async (): Promise<PostCardData[]> => {
      const [featured, recent] = await Promise.all([
        apiFetch<Paginated<PostDTO>>(`/api/posts?featured=1&limit=${limit}`),
        apiFetch<Paginated<PostDTO>>(`/api/posts?limit=${limit}&sort=recent`),
      ]);
      const merged: PostDTO[] = [];
      const seen = new Set<string>();
      for (const p of [...featured.items, ...recent.items]) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        merged.push(p);
        if (merged.length >= limit) break;
      }
      return merged.map(toPostCard);
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

function useHomeProducts(limit: number) {
  return useQuery({
    queryKey: ["products", "home-featured", limit],
    queryFn: async (): Promise<ProductCardData[]> => {
      const [featured, recent] = await Promise.all([
        apiFetch<Paginated<ProductDTO>>(`/api/products?featured=1&limit=${limit}`),
        apiFetch<Paginated<ProductDTO>>(`/api/products?limit=${limit}&sort=recent`),
      ]);
      const merged: ProductDTO[] = [];
      const seen = new Set<string>();
      for (const p of [...featured.items, ...recent.items]) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        merged.push(p);
        if (merged.length >= limit) break;
      }
      return merged.map(toProductCard);
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/* ------------------------------------------------------------------ */
/* hero                                                                */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b">
      {/* quiet warm glow — depth without decoration */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px circle at 88% -12%, color-mix(in oklab, var(--gold) 9%, transparent), transparent 62%)",
        }}
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20 md:py-24 lg:px-8">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true" className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex size-full rounded-full bg-gold" />
          </span>
          Available for new projects
          <span aria-hidden="true" className="text-border">|</span>
          Calicut · Kerala
        </p>

        <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:mt-8 sm:text-5xl md:text-6xl">
          Mohammed Nihad KP
          <span className="mt-3 block text-lg font-medium leading-snug text-muted-foreground sm:mt-4 sm:text-xl md:text-2xl">
            AI-powered web &amp; app development, media and growth
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:mt-6 md:text-lg">
          {SITE.tagline}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-9">
          <ALink href="#/contact">
            <Button size="lg" className="gap-2">
              Start a project
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </ALink>
          <ALink href="#/services">
            <Button size="lg" variant="outline" className="gap-2">
              Explore services
            </Button>
          </ALink>
          <ALink
            href={SITE.whatsappUrl}
            aria-label="Chat on WhatsApp"
            className="inline-flex size-11 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
          </ALink>
        </div>

        <div className="mt-6 sm:mt-8">
          <LiveVisitorBadge />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* hero marquee — premium dual-lane marketing band (Task 12-d)          */
/* ------------------------------------------------------------------ */

/** Client-side guard for the resolver-produced marketing chips. */
interface HeroMessage {
  text: string;
  href: string | null;
}

/** Client-side guard for one marquee image row (string or {src,href}). */
interface HeroImage {
  src: string;
  href: string | null;
  alt: string;
}

/** Friendly alt for a marquee image derived from its destination. */
function marqueeImageAlt(href: string | null): string {
  if (!href) return "MN.KP highlight";
  if (href.startsWith("#/")) {
    const route = href.slice(2).split("/")[0] ?? "";
    const labels: Record<string, string> = {
      store: "Curated gear from the MN.KP store",
      blog: "Latest writing on the MN.KP blog",
      services: "MN.KP services",
      ventures: "MN.KP ventures",
      about: "About MOHAMMED NIHAD KP",
      contact: "Contact MN.KP",
      support: "MN.KP support",
    };
    return labels[route] ?? `MN.KP highlight — ${route}`;
  }
  try {
    return `MN.KP highlight — ${new URL(href).hostname.replace(/^www\./, "")}`;
  } catch {
    return "MN.KP highlight";
  }
}

/** Normalize settings rows: legacy plain strings + {src,href} objects. */
function parseHeroImages(raw: unknown): HeroImage[] {
  if (!Array.isArray(raw)) return [];
  const out: HeroImage[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ src: item, href: null, alt: marqueeImageAlt(null) });
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const m = item as { src?: unknown; href?: unknown };
    if (typeof m.src !== "string" || !m.src.trim()) continue;
    const href =
      typeof m.href === "string" && (m.href.startsWith("#/") || m.href.startsWith("https://"))
        ? m.href
        : typeof m.href === "string" && m.href.startsWith("http://")
          ? m.href
          : null;
    out.push({ src: m.src.trim(), href, alt: marqueeImageAlt(href) });
  }
  return out;
}

function parseHeroMessages(raw: unknown): HeroMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HeroMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const m = item as { text?: unknown; href?: unknown };
    if (typeof m.text !== "string" || !m.text.trim()) continue;
    const href =
      typeof m.href === "string" && (m.href.startsWith("#/") || m.href.startsWith("https://"))
        ? m.href
        : null;
    out.push({ text: m.text.trim(), href });
  }
  return out;
}

/** In-app ad destinations route through the hash router; others open new. */
function openTrackedAdUrl(url: string): void {
  if (url.startsWith("#/")) {
    navigate(url.slice(1));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Click + impression tracking for one hero ad chip. Mirrors useAdInteraction
 * (affiliate-ad-slot.tsx) but impressions can be suppressed for loop
 * duplicates, so each ad counts exactly ONE impression per page mount while
 * every visible copy stays clickable.
 */
function useHeroAdInteraction(ad: AdDTO, trackImpression: boolean) {
  const seen = React.useRef(false);

  React.useEffect(() => {
    if (!trackImpression || seen.current) return;
    seen.current = true;
    apiFetch(`/api/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {
      /* fire-and-forget */
    });
  }, [ad, trackImpression]);

  const handleClick = React.useCallback(() => {
    apiFetch<{ id: string; url: string | null }>(`/api/ads/${ad.id}/click`, { method: "POST" })
      .then((data) => {
        if (data.url) openTrackedAdUrl(data.url);
      })
      .catch(() => {
        /* tracking failed — still honor the destination */
        if (ad.linkUrl) openTrackedAdUrl(ad.linkUrl);
      });
  }, [ad]);

  return { handleClick };
}

/** Marketing chip — copper dot + short line, linked when the owner set one. */
function HeroMessageChip({ message }: { message: HeroMessage }) {
  const content = (
    <>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold" />
      <span>{message.text}</span>
    </>
  );
  const base =
    "press-sm mx-1.5 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border bg-card px-4 py-1.5 text-xs font-medium sm:mx-2";
  if (message.href) {
    return (
      <ALink
        href={message.href}
        className={cn(
          base,
          "transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {content}
      </ALink>
    );
  }
  return <span className={base}>{content}</span>;
}

/** Tracked sponsored chip — gold-dashed pill, distinct from message chips. */
function HeroAdChip({ ad, trackImpression }: { ad: AdDTO; trackImpression: boolean }) {
  const { handleClick } = useHeroAdInteraction(ad, trackImpression);

  return (
    <a
      href={adHref(ad)}
      rel={adRel(ad)}
      target={adTarget(ad)}
      onClick={(event) => runAdAnchorClick(event, handleClick)}
      className="press-sm group mx-1.5 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-gold/50 bg-gold/[0.05] px-4 py-1.5 text-xs transition-colors hover:border-gold/70 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-2"
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gold">
        Sponsored
      </span>
      <span className="font-semibold tracking-tight">{ad.title ?? ad.name}</span>
      <span className="inline-flex items-center gap-1 font-medium text-gold underline-offset-4 group-hover:underline">
        {ad.linkLabel}
        <ArrowRight
          className="size-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </a>
  );
}

/**
 * HeroMarquee — dual-lane marketing band below the hero.
 *
 * Lane A scrolls the curated image track — FULL COLOUR since Task 13-c (the
 * greyscale treatment was retired) and every image clicks through to the
 * URL the owner set per-image in Settings → Media (in-app routes navigate
 * natively; external ads open in a new tab with rel="sponsored noopener").
 * Lane B scrolls the opposite way mixing tracked "hero-marquee" ads with the
 * owner's marketing chips. Both pause on hover/focus, respect reduced motion
 * and fade at the viewport edges. Renders nothing when disabled or empty.
 */
function HeroMarquee() {
  const settings = useSettings();
  const marquee = settings.data?.media?.heroMarquee;
  const { ads } = useAdsForPlacement("hero-marquee");

  const images = parseHeroImages(marquee?.images);
  const messages = parseHeroMessages(marquee?.messages);
  const speed: MarqueeSpeed =
    marquee?.speed === "slow" || marquee?.speed === "fast" ? marquee.speed : "normal";
  const heroAds = ads.filter((ad) => ad.type !== "sticker");

  if (!marquee?.enabled) return null;
  if (images.length === 0 && messages.length === 0 && heroAds.length === 0) return null;

  const duration = MARQUEE_DURATION[speed];

  // Lane B content: tracked ad chips first, then marketing chips. The loop
  // duplicate keeps identical widths (seamless -50% translate) but suppresses
  // its impression so each ad is counted once per page mount.
  const laneItems: Array<
    | { kind: "ad"; ad: AdDTO; track: boolean }
    | { kind: "message"; message: HeroMessage }
  > = [
      ...heroAds.map((ad) => ({ kind: "ad" as const, ad, track: true })),
      ...messages.map((message) => ({ kind: "message" as const, message })),
    ];
  const laneLoop = [
    ...laneItems,
    ...laneItems.map((item) => (item.kind === "ad" ? { ...item, track: false } : item)),
  ];

  return (
    <section
      aria-label="MN.KP highlights and sponsored picks"
      className="border-y border-t-gold/30 bg-gradient-to-b from-muted/40 to-muted/10"
    >
      <style>{MARQUEE_CSS}</style>
      <div className="py-3.5 sm:py-4">
        <p className="mb-2.5 px-4 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:mb-3">
          Trusted stack · live deals · what&rsquo;s shipping
        </p>

        {images.length > 0 ? (
          <div className="mnkp-marquee mnkp-marquee--fade">
            <div className="mnkp-marquee__track" style={{ animationDuration: duration }}>
              {[...images, ...images].map((image, index) => {
                const img = (
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-auto max-w-none shrink-0 rounded-lg border object-cover transition-all duration-300 hover:border-gold/50 hover:shadow-md hover:shadow-gold/10 sm:h-20 md:h-24"
                  />
                );
                return image.href ? (
                  <ALink
                    key={`hero-img-${index}-${image.src}`}
                    href={image.href}
                    aria-label={image.alt}
                    className="press mx-2 inline-flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-2.5"
                    rel="sponsored noopener"
                  >
                    {img}
                  </ALink>
                ) : (
                  <span
                    key={`hero-img-${index}-${image.src}`}
                    className="mx-2 inline-flex shrink-0 sm:mx-2.5"
                  >
                    {img}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {laneLoop.length > 0 ? (
          <div className={cn(images.length > 0 && "mt-2.5 sm:mt-3")}>
            <div className="mnkp-marquee mnkp-marquee--fade">
              <div
                className="mnkp-marquee__track mnkp-marquee__track--reverse"
                style={{ animationDuration: duration }}
              >
                {laneLoop.map((item, index) =>
                  item.kind === "ad" ? (
                    <HeroAdChip
                      key={`hero-ad-${index}-${item.ad.id}`}
                      ad={item.ad}
                      trackImpression={item.track}
                    />
                  ) : (
                    <HeroMessageChip
                      key={`hero-msg-${index}-${item.message.text}`}
                      message={item.message}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* stat band                                                           */
/* ------------------------------------------------------------------ */

function StatBand() {
  return (
    <section aria-label="MN.KP at a glance" className="border-b bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-0 md:divide-x md:divide-border">
          {STATS.map((stat, index) => (
            <div key={stat.label} className={index === 0 ? "md:pr-6" : "md:px-6"}>
              <dd className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                {stat.value}
              </dd>
              <dt className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* newsletter band                                                     */
/* ------------------------------------------------------------------ */

function NewsletterBand() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setError(null);
    try {
      await apiFetch("/api/newsletter", {
        method: "POST",
        body: JSON.stringify({ email, source: "footer" }),
      });
      setState("done");
      toast({
        title: "You're on the list",
        description: "One good email, once in a while — no spam, unsubscribe anytime.",
      });
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Could not subscribe right now.");
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="rounded-2xl border border-border border-t-2 border-t-gold/70 bg-card p-6 sm:p-8 md:p-10">
        <div className="grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Newsletter</p>
            <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              Practical AI, freelancing and business notes — once in a while
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Written from Calicut, useful anywhere. New guides, honest gear picks and the
              occasional lesson from the 195-country mission. No spam, ever.
            </p>
          </div>

          {state === "done" ? (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm font-medium text-foreground"
            >
              <Check className="size-5 shrink-0 text-gold" aria-hidden="true" />
              <span>You&rsquo;re in — watch your inbox for the next issue.</span>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" noValidate>
              <div className="flex-1">
                <label htmlFor="home-newsletter-email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="home-newsletter-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={state === "loading"} className="h-11 gap-2">
                {state === "loading" ? "Subscribing..." : "Subscribe"}
                <Mail className="size-4" aria-hidden="true" />
              </Button>
            </form>
          )}
        </div>

        {state === "error" && error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">
          By subscribing you agree to the{" "}
          <ALink href="#/legal/privacy-policy" className="underline-offset-2 hover:underline">
            privacy policy
          </ALink>
          . Unsubscribe in one click, any time.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function HomeView() {
  const postsQuery = useHomePosts(3);
  const productsQuery = useHomeProducts(4);

  return (
    <div className="w-full">
      <SEOHead
        title="MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP"
        description="Hire MOHAMMED NIHAD KP — Calicut-based AI-first developer & freelancer delivering fast websites, apps, photo & video services, and an honestly curated affiliate store."
        canonicalPath="/"
        ogImage="/images/brand/og-cover.webp"
      />

      <HeroSection />
      <HeroMarquee />
      {/* ad-like scrolling offers strip (Task 14) — auto-hides when no offers run */}
      <OffersTicker />
      <StatBand />

      {/* services */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          microLabel="Services"
          title="What I do"
          description="Five focused services, one operating system: AI-first execution for the web, for media and for business growth."
        />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.slug}
              className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-all hover:border-foreground/25 hover:shadow-sm sm:p-6"
            >
              <h3 className="text-base font-semibold leading-snug tracking-tight">
                <ALink
                  href="#/services"
                  className="transition-colors group-hover:text-primary"
                >
                  {service.name}
                </ALink>
              </h3>
              <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {service.blurb}
              </p>
              <p className="mt-4 text-sm font-semibold tabular-nums text-gold">
                from {formatINR(service.priceFrom)}
              </p>
              <div className="mt-auto flex items-center gap-4 pt-5 text-sm">
                <ALink
                  href="#/services"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Details
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </ALink>
                <ALink
                  href={`#/contact?service=${service.slug}`}
                  className="font-medium text-muted-foreground transition-colors hover:text-gold"
                >
                  Get a quote
                </ALink>
              </div>
            </article>
          ))}

          {/* fill card — keeps the 3-col grid balanced with 5 services */}
          <article className="flex h-full flex-col justify-center rounded-xl border bg-muted/30 p-5 sm:p-6">
            <p className="text-sm font-semibold leading-snug tracking-tight">
              Not sure which one fits?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              One conversation sorts it out — tell me the goal and you will have a scoped
              quote within 24 hours.
            </p>
            <ALink
              href="#/contact"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ask me anything
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </ALink>
          </article>
        </div>
      </section>

      {/* featured posts */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            microLabel="Fresh writing"
            title="From the blog"
            description="AI workflows, freelancing from Kerala and business growth — the posts people actually read twice."
            className="md:max-w-2xl"
          />
          <ALink
            href="#/blog"
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all posts
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </ALink>
        </div>
        <div className="mt-8">
          <DataState query={postsQuery} emptyVariant="posts" skeletonRows={3} empty={(data) => data.length === 0}>
            {(posts) => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </DataState>
        </div>
      </section>

      {/* affiliate strip */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <AffiliateAdSlot placement="home-strip" />
      </div>

      {/* featured products */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            microLabel="Affiliate picks"
            title="Curated in the store"
            description="Honestly reviewed tech and creator gear — every link tested on real work first."
            className="md:max-w-2xl"
          />
          <ALink
            href="#/store"
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Browse the store
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </ALink>
        </div>
        <div className="mt-8">
          <DataState query={productsQuery} emptyVariant="products" skeletonRows={4} empty={(data) => data.length === 0}>
            {(products) => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.slug} product={product} />
                ))}
              </div>
            )}
          </DataState>
        </div>
      </section>

      {/* brands + projects band */}
      <section className="border-y bg-muted/40 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            microLabel="The ecosystem"
            title="Three brands, one foundation"
            description="KP Foundation is the parent platform — services, commerce and community under one roof, built from Calicut."
          />
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {BRANDS.map((brand) => (
              <article
                key={brand.name}
                className="flex h-full flex-col rounded-xl border bg-card p-5 transition-all hover:border-foreground/25 sm:p-6"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">{brand.role}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{brand.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
                <div className="mt-auto pt-4">
                  <ALink
                    href={brand.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {brand.href.startsWith("#/") ? "Read the vision" : "Visit site"}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </ALink>
                </div>
              </article>
            ))}
          </div>
          <ul className="mt-6 flex flex-wrap items-center gap-2">
            {PROJECTS.map((project) => (
              <li key={project.name}>
                <ALink
                  href={project.href}
                  title={project.description}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
                >
                  {project.name}
                </ALink>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* about teaser */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[280px_1fr] lg:px-8">
        <div className="mx-auto w-full max-w-[280px]">
          <img
            src="/images/brand/portrait.webp"
            alt="Portrait of MOHAMMED NIHAD KP — AI-first developer and freelancer from Calicut"
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full rounded-xl border object-cover shadow-sm"
          />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            The person behind the platform
          </p>
          <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Diploma engineer. AI-first operator. Calicut to the world.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            {ABOUT_PARAGRAPHS[0]}
          </p>
          <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            {ABOUT_PARAGRAPHS[1]}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-4 py-1.5 text-xs font-medium text-gold">
            The 195-country mission
          </span>
          <div className="mt-5">
            <ALink href="#/about">
              <Button variant="outline" className="gap-2">
                Read my story
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </ALink>
          </div>
        </div>
      </section>

      <NewsletterBand />

      {/* final CTA band */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="rounded-2xl bg-primary px-4 py-10 text-center sm:px-8 sm:py-14 md:px-12 md:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Let&rsquo;s build together
          </p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-primary-foreground md:text-4xl">
            Have an idea? Let&rsquo;s ship it.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-primary-foreground/80 md:text-base">
            Websites, apps, photos, videos or a growth plan — tell me the goal and you will have
            a scoped quote within 24 hours. No jargon, no delay.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ALink href="#/contact">
              <Button size="lg" variant="secondary" className="gap-2">
                Start a project
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </ALink>
            <ALink href={SITE.whatsappUrl}>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp me
              </Button>
            </ALink>
          </div>
        </div>
      </section>
    </div>
  );
}
