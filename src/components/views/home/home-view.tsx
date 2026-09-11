"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Globe,
  Mail,
  MessageCircle,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { DataState } from "@/components/states";
import { AffiliateAdSlot } from "@/components/shared/affiliate-ad-slot";
import { LiveVisitorBadge } from "@/components/shared/live-visitor-badge";
import { PostCard, type PostCardData } from "@/components/shared/post-card";
import { ProductCard, formatINR, type ProductCardData } from "@/components/shared/product-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { StatChip } from "@/components/shared/stat-chip";
import { Icon } from "@/components/shared/lucide-icon";
import { SEOHead } from "@/components/shared/seo-head";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import { ABOUT_PARAGRAPHS, BRANDS, PROJECTS, SERVICES, STATS } from "@/lib/content";
import type { Paginated, PostDTO, ProductDTO } from "@/types";

/**
 * HomeView — route key "home" (#/).
 *
 * The "at a glance" landing page: hero, scrolling brand marquee, stat chips,
 * services preview, featured blog posts + affiliate strip, featured store
 * picks, brands band, about teaser, newsletter band and a final CTA.
 */

const MARQUEE_CSS = `
@keyframes mnkp-marquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.mnkp-marquee { overflow: hidden; }
.mnkp-marquee__track { display: flex; width: max-content; animation: mnkp-marquee 48s linear infinite; }
.mnkp-marquee:hover .mnkp-marquee__track, .mnkp-marquee:focus-within .mnkp-marquee__track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .mnkp-marquee__track { animation: none; } }
`;

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
/* hero + marquee                                                      */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src="/images/brand/og-cover.png"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-950/85 via-emerald-950/75 to-emerald-950/90"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-10 sm:px-6 sm:py-16 md:py-28 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-soft">
          Calicut · Kerala · Worldwide
        </p>
        <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:mt-4 sm:text-4xl md:text-5xl">
          <span className="text-gold-gradient block">MOHAMMED NIHAD KP</span>
          <span className="mt-2 block text-xl font-semibold sm:text-2xl md:text-3xl">
            AI-Powered Web &amp; App Development in Calicut
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-emerald-50/85 sm:mt-6 md:text-lg">
          {SITE.tagline}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
          <ALink href="#/services">
            <Button size="lg" className="gap-2">
              Hire me
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </ALink>
          <ALink href="#/blog">
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-gold/60 bg-transparent text-gold-soft hover:bg-gold/10 hover:text-gold"
            >
              Explore the blog
            </Button>
          </ALink>
          <ALink
            href={SITE.whatsappUrl}
            aria-label="Chat on WhatsApp"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-white/25 text-emerald-50 transition-colors hover:border-gold-soft/60 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft/60"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
          </ALink>
        </div>

        <div className="mt-6 sm:mt-8">
          <LiveVisitorBadge className="border-gold-soft/30 bg-white/10 text-gold-soft" />
        </div>
      </div>
    </section>
  );
}

function HeroMarquee() {
  const settings = useSettings();
  const marquee = settings.data?.media?.heroMarquee;
  const images = (marquee?.images ?? []).filter((src): src is string => typeof src === "string");
  if (!marquee?.enabled || images.length === 0) return null;

  return (
    <section aria-hidden="true" className="border-y border-gold/20 bg-muted/50 py-3 sm:py-4 md:py-5">
      <style>{MARQUEE_CSS}</style>
      <div className="mnkp-marquee">
        <div className="mnkp-marquee__track">
          {[...images, ...images].map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className="mx-3 h-14 w-auto max-w-none rounded-lg border border-border/60 object-cover grayscale transition-all duration-300 hover:scale-[1.04] hover:grayscale-0 sm:h-24 md:h-36"
            />
          ))}
        </div>
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
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
      <div className="rounded-2xl border border-gold/40 bg-gold/[0.05] p-4 sm:p-6 md:p-10">
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
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm font-medium text-primary"
            >
              <Check className="size-5 shrink-0" aria-hidden="true" />
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
                  className="h-11 bg-card"
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

const STAT_ICONS = [Globe, Building2, Briefcase, Rocket];

export default function HomeView() {
  const postsQuery = useHomePosts(3);
  const productsQuery = useHomeProducts(4);

  return (
    <div className="w-full">
      <SEOHead
        title="MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP"
        description="Hire MOHAMMED NIHAD KP — Calicut-based AI-first developer & freelancer delivering fast websites, apps, photo & video services, and an honestly curated affiliate store."
        canonicalPath="/"
        ogImage="/images/brand/og-cover.png"
      />

      <HeroSection />
      <HeroMarquee />

      {/* at a glance — 2x2 grid on mobile, 4-up from md */}
      <section aria-label="MN.KP at a glance" className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          At a glance
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((stat, index) => (
            <StatChip
              key={stat.label}
              value={stat.value}
              label={stat.label}
              icon={STAT_ICONS[index % STAT_ICONS.length]}
            />
          ))}
        </div>
      </section>

      {/* services preview */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
        <SectionHeading
          microLabel="Services"
          title="What I do"
          description="Five focused services, one operating system: AI-first execution for the web, for media and for business growth."
        />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.slug}
              className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"
              >
                <Icon name={service.icon} className="size-5" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-base font-semibold leading-snug tracking-tight">
                <ALink href="#/services" className="transition-colors hover:text-primary">
                  {service.name}
                </ALink>
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {service.blurb}
              </p>
              <p className="mt-3 text-sm font-semibold text-gold">
                from {formatINR(service.priceFrom)}
              </p>
              <div className="mt-auto flex items-center gap-4 pt-4 text-sm">
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
          <article className="flex h-full flex-col justify-center rounded-xl border border-dashed border-gold/40 bg-gold/[0.04] p-5">
            <Sparkles className="size-5 text-gold" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium leading-relaxed">
              Not sure which one fits? One conversation sorts it out.
            </p>
            <ALink
              href="#/contact"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ask me anything
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </ALink>
          </article>
        </div>
      </section>

      {/* featured posts */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 sm:pb-14 lg:px-8">
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
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 sm:pb-14 lg:px-8">
        <AffiliateAdSlot placement="home-strip" />
      </div>

      {/* featured products */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 sm:pb-14 lg:px-8">
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
      <section className="border-y bg-muted/40 py-8 sm:py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            microLabel="The ecosystem"
            title="Three brands, one foundation"
            description="KP Foundation is the parent platform — services, commerce and community under one roof, built from Calicut."
          />
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {BRANDS.map((brand) => (
              <article key={brand.name} className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs">
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
                  <Globe className="size-3" aria-hidden="true" />
                  {project.name}
                </ALink>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* about teaser */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 sm:py-14 lg:grid-cols-[280px_1fr] lg:px-8">
        <div className="mx-auto w-full max-w-[280px]">
          <img
            src="/images/brand/portrait.png"
            alt="Portrait of MOHAMMED NIHAD KP — AI-first developer and freelancer from Calicut"
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full rounded-2xl border border-gold/30 object-cover shadow-md ring-1 ring-gold/40"
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
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold">
            <Globe className="size-3.5" aria-hidden="true" />
            The 195-country mission
          </span>
          <div className="mt-5">
            <ALink href="#/about">
              <Button variant="outline" className="gap-2 border-gold/50 text-gold hover:bg-gold/10">
                Read my story
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </ALink>
          </div>
        </div>
      </section>

      <NewsletterBand />

      {/* final CTA band */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 sm:pb-16 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-2xl bg-primary px-4 py-8 text-center sm:px-6 sm:py-12 md:px-12 md:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/90 via-transparent to-gold/20"
          />
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-primary-foreground md:text-4xl">
            Have an idea? Let&rsquo;s ship it.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-primary-foreground/85 md:text-base">
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
