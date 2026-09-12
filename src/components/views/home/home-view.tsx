"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { DataState } from "@/components/states";
import { AffiliateAdSlot } from "@/components/shared/affiliate-ad-slot";
import { LiveVisitorBadge } from "@/components/shared/live-visitor-badge";
import { PostCard, type PostCardData } from "@/components/shared/post-card";
import { ProductCard, formatINR, type ProductCardData } from "@/components/shared/product-card";
import { SectionHeading } from "@/components/shared/section-heading";
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
 * Professional editorial landing page: typographic hero, hairline stat band,
 * services, featured writing, affiliate strip, store picks, brands, about
 * teaser, newsletter and a final CTA. Calm hierarchy, generous whitespace,
 * one restrained copper accent on a graphite-and-stone system.
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

function HeroMarquee() {
  const settings = useSettings();
  const marquee = settings.data?.media?.heroMarquee;
  const images = (marquee?.images ?? []).filter((src): src is string => typeof src === "string");
  if (!marquee?.enabled || images.length === 0) return null;

  return (
    <section aria-hidden="true" className="border-b bg-muted/40 py-3 sm:py-4 md:py-5">
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
              className="mx-3 h-14 w-auto max-w-none rounded-md border object-cover grayscale transition-all duration-300 hover:scale-[1.04] hover:grayscale-0 sm:h-24 md:h-32"
            />
          ))}
        </div>
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
        ogImage="/images/brand/og-cover.png"
      />

      <HeroSection />
      <HeroMarquee />
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
            src="/images/brand/portrait.png"
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
