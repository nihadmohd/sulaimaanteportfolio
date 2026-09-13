"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  FileQuestion,
  Info,
  MousePointerClick,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AffiliateAdSlot } from "@/components/shared/affiliate-ad-slot";
import { ProductCard, Stars, formatINR, type ProductCardData } from "@/components/shared/product-card";
import { formatCompact } from "@/components/shared/post-card";
import { SocialShare } from "@/components/shared/social-share";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { DataState, StatePage } from "@/components/states";
import { MarkdownBlock, MarkdownFallback } from "@/components/views/shared/markdown";
import { CompareStrip } from "@/components/views/store/compare-strip";
import { ProductGalleryPro } from "@/components/views/store/product-gallery-pro";
import { ProductVerdict } from "@/components/views/store/product-verdict";
import { StickyBuyBar } from "@/components/views/store/sticky-buy-bar";
import { WishlistButton } from "@/components/views/store/wishlist-button";
import { useHashParams } from "@/hooks/use-hash-params";
import { navigate } from "@/hooks/use-router";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import type { Paginated, ProductDTO } from "@/types";

/**
 * ProductView — route key "store-product" (#/store/:slug).
 *
 * PRO gallery (swipe + zoom lightbox), honest-review content, key specs,
 * pros/cons + interactive "Quick verdict" widget, tracked affiliate CTA
 * (click logged BEFORE the merchant tab opens — shared by the main
 * button and the sticky mobile buy bar), save-for-later wishlist, a
 * compare-before-you-commit rail, a compact "product-inline" sponsored
 * slot under the price/CTA card, disclosure, share, related gear and
 * Product JSON-LD with INR offers.
 */

const SESSION_KEY = "mnkp_sid";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = window.localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
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

/* ------------------------------------------------------------------ */
/* product                                                             */
/* ------------------------------------------------------------------ */

function ProductDetail({ product }: { product: ProductDTO }) {
  const { toast } = useToast();
  /** Anchors the sticky mobile buy bar's IntersectionObserver. */
  const priceCardRef = React.useRef<HTMLDivElement | null>(null);

  const discount =
    product.price != null &&
    product.compareAtPrice != null &&
    product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  const canonicalPath = `/store/${product.slug}`;
  const isInternalAffiliate = product.affiliateUrl.startsWith("#/");

  const handleCta = () => {
    toast({
      title: "Opening merchant site",
      description: "You may close this tab when you're done — thanks for supporting MN.KP.",
    });

    const track = apiFetch<{ clicks: number }>(`/api/products/${product.id}/click`, {
      method: "POST",
      body: JSON.stringify({ sessionId: getSessionId() }),
    }).catch(() => undefined);

    if (isInternalAffiliate) {
      // First-party digital product — route internally.
      void track;
      navigate(product.affiliateUrl.slice(1));
      return;
    }

    // Open the tab synchronously within the user gesture, then point it at
    // the merchant URL once the click has been logged.
    const popup = window.open("about:blank", "_blank");
    void track.then(() => {
      if (popup && !popup.closed) {
        popup.location.href = product.affiliateUrl;
        popup.opener = null;
      } else {
        window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
      }
    });
  };

  const relatedQuery = useQuery({
    queryKey: ["products", "related", product.category?.slug ?? "none", product.slug],
    queryFn: async (): Promise<ProductDTO[]> => {
      const merged: ProductDTO[] = [];
      const seen = new Set<string>([product.slug]);
      if (product.category?.slug) {
        const sameCategory = await apiFetch<Paginated<ProductDTO>>(
          `/api/products?category=${encodeURIComponent(product.category.slug)}&limit=5`
        );
        for (const item of sameCategory.items) {
          if (seen.has(item.slug)) continue;
          seen.add(item.slug);
          merged.push(item);
          if (merged.length >= 4) break;
        }
      }
      if (merged.length < 4) {
        const popular = await apiFetch<Paginated<ProductDTO>>("/api/products?sort=popular&limit=6");
        for (const item of popular.items) {
          if (seen.has(item.slug)) continue;
          seen.add(item.slug);
          merged.push(item);
          if (merged.length >= 4) break;
        }
      }
      return merged.slice(0, 4);
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const seoDescription =
    product.tagline ??
    `Honest review of ${product.name} — specs, pros, cons and the best price in INR, curated by MN.KP.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [
      (product.imageUrl ?? SITE.ogImage).startsWith("http")
        ? (product.imageUrl ?? SITE.ogImage)
        : `${SITE.url}${product.imageUrl ?? SITE.ogImage}`,
    ],
    description: seoDescription,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      price: product.price ?? 0,
      priceCurrency: product.currency || "INR",
      availability: "https://schema.org/InStock",
      url: `${SITE.url}${canonicalPath}`,
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:px-8">
      <SEOHead
        title={`${product.name} — Honest Review & Best Price | MN.KP`}
        description={`${seoDescription} Honest review, key specs, pros and cons — curated in Calicut, priced in INR.`.slice(0, 180)}
        canonicalPath={canonicalPath}
        ogImage={product.imageUrl ?? SITE.ogImage}
        ogType="product"
        jsonLd={jsonLd}
      />

      <Breadcrumbs
        items={[
          { label: "Home", href: "#/" },
          { label: "Store", href: "#/store" },
          ...(product.category
            ? [{ label: product.category.name, href: `#/store?category=${product.category.slug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-2 lg:gap-12">
        {/* gallery */}
        <div>
          <ProductGalleryPro product={product} />
        </div>

        {/* detail column */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.brand ? (
              <Badge variant="secondary" className="border-border">
                {product.brand}
              </Badge>
            ) : null}
            {product.merchant ? (
              <Badge variant="secondary" className="border-gold/40 bg-gold/10 text-gold">
                <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
                Sold on {product.merchant}
              </Badge>
            ) : null}
            {product.category ? (
              <ALink href={`#/store?category=${product.category.slug}`}>
                <Badge variant="outline" className="transition-colors hover:border-gold/50">
                  {product.category.name}
                </Badge>
              </ALink>
            ) : null}
          </div>

          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {product.name}
          </h1>
          {product.tagline ? (
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              {product.tagline}
            </p>
          ) : null}

          {/* rating + clicks */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Stars rating={product.rating} showValue size="md" />
              {product.reviewCount > 0 ? (
                <span className="tabular-nums">{formatCompact(product.reviewCount)} reviews</span>
              ) : null}
            </span>
            <span
              className="inline-flex items-center gap-1.5 tabular-nums"
              title="People who checked this out"
            >
              <MousePointerClick className="size-3.5" aria-hidden="true" />
              {formatCompact(product.clicksCount)} clicks
            </span>
          </div>

          {/* price block */}
          <div ref={priceCardRef} className="mt-6 rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-baseline gap-3">
              {product.price != null ? (
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-primary">
                  {formatINR(product.price)}
                </span>
              ) : (
                <span className="text-2xl font-semibold tracking-tight text-primary">
                  Price at merchant
                </span>
              )}
              {product.compareAtPrice != null &&
              product.price != null &&
              product.compareAtPrice > product.price ? (
                <>
                  <span className="text-base tabular-nums text-muted-foreground line-through">
                    {formatINR(product.compareAtPrice)}
                  </span>
                  <Badge className="bg-gold text-gold-foreground">Save {discount}%</Badge>
                </>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Price checked regularly — final price and availability at{" "}
              {product.merchant ?? "the merchant"}.
            </p>

            <Button
              size="lg"
              onClick={handleCta}
              className="mt-5 h-14 w-full gap-2 border border-gold/60 bg-gold text-base font-semibold text-gold-foreground shadow-md transition-all hover:bg-gold/90 hover:shadow-lg"
            >
              <ExternalLink className="size-5" aria-hidden="true" />
              {isInternalAffiliate
                ? "Get it from MN.KP"
                : `View on ${product.merchant ?? "merchant site"}`}
            </Button>

            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
              <span>
                As an affiliate, I may earn a commission at no extra cost to you. Read the{" "}
                <ALink
                  href="#/legal/affiliate-disclosure"
                  className="underline underline-offset-2 hover:text-gold"
                >
                  affiliate disclosure
                </ALink>
                .
              </span>
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">Share this pick</p>
              <div className="flex items-center gap-1.5">
                <WishlistButton slug={product.slug} />
                <SocialShare
                  title={`${product.name} — honest review on MN.KP`}
                  path={canonicalPath}
                />
              </div>
            </div>
          </div>

          {/* sponsored slot right below the purchase CTA card */}
          <AffiliateAdSlot placement="product-inline" className="mt-6" />

          {/* key specs */}
          {Object.keys(product.keySpecs).length > 0 ? (
            <section className="mt-8" aria-label="Key specifications">
              <h2 className="text-lg font-semibold tracking-tight">Key specs</h2>
              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(product.keySpecs).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <dt className="shrink-0 text-muted-foreground">{key}</dt>
                    <dd className="text-right font-medium text-foreground/90">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* pros / cons */}
          {product.pros.length > 0 || product.cons.length > 0 ? (
            <section className="mt-8" aria-label="Pros and cons">
              <h2 className="text-lg font-semibold tracking-tight">The honest verdict</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {product.pros.length > 0 ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      <ThumbsUp className="size-4" aria-hidden="true" />
                      What&rsquo;s good
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {product.pros.map((pro) => (
                        <li key={pro} className="flex items-start gap-2">
                          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {product.cons.length > 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                      <ThumbsDown className="size-4" aria-hidden="true" />
                      Watch out for
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {product.cons.map((con) => (
                        <li key={con} className="flex items-start gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500"
                          />
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* interactive verdict widget */}
          <ProductVerdict product={product} />

          {/* buying-guide cross-link (SEO) */}
          <p className="mt-8 text-sm text-muted-foreground">
            Deciding between options? The{" "}
            <ALink href="#/blog" className="font-medium text-primary hover:underline">
              buying guides on the blog
            </ALink>{" "}
            walk through how this gear fits a real creator workflow.
          </p>
        </div>
      </div>

      {/* compare rail — reuses the related query data (no extra fetch) */}
      <CompareStrip current={product} related={relatedQuery.data ?? []} />

      {/* honest review (markdown, lazy) */}
      {product.description ? (
        <section className="mt-14 max-w-3xl" aria-label="Full review">
          <SectionHeading microLabel="The review" title="Why this made the list" />
          <div className="mt-6">
            <React.Suspense fallback={<MarkdownFallback />}>
              <MarkdownBlock content={product.description} />
            </React.Suspense>
          </div>
        </section>
      ) : null}

      {/* related gear */}
      <section className="mt-14" aria-label="Related gear">
        <SectionHeading microLabel="More picks" title="Related gear" />
        <div className="mt-6">
          <DataState
            query={relatedQuery}
            emptyVariant="products"
            skeletonRows={4}
            empty={(data) => data.length === 0}
          >
            {(products) => (
              <>
                {/* mobile: compact 2-col */}
                <div className="grid grid-cols-2 gap-3 sm:hidden">
                  {products.slice(0, 4).map((item) => (
                    <ProductCard key={item.slug} product={toProductCard(item)} size="compact" />
                  ))}
                </div>
                {/* sm and up: full cards */}
                <div className="hidden grid-cols-2 gap-5 sm:grid lg:grid-cols-4">
                  {products.slice(0, 4).map((item) => (
                    <ProductCard key={item.slug} product={toProductCard(item)} />
                  ))}
                </div>
              </>
            )}
          </DataState>
        </div>
      </section>

      {/* sticky mobile buy bar — appears once the price card is scrolled past */}
      <StickyBuyBar product={product} onCta={handleCta} priceCardRef={priceCardRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function ProductView() {
  const { slug } = useHashParams<{ slug: string }>();

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiFetch<ProductDTO>(`/api/products/${encodeURIComponent(slug ?? "")}`),
    enabled: Boolean(slug),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (!slug) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SEOHead
          title="Product | MN.KP"
          description="A curated affiliate product from the MN.KP store — honestly reviewed tech and creator gear."
          canonicalPath="/store"
          noindex
        />
        <StatePage
          icon={FileQuestion}
          tone="gold"
          microLabel="ERROR 404"
          title="This product doesn't exist (yet)"
          description="No product slug was given. Browse the store to find what you were looking for."
          actions={<Button onClick={() => navigate("/store")}>Browse the store</Button>}
        />
      </div>
    );
  }

  if (productQuery.isError) {
    const error = productQuery.error;
    const is404 =
      error instanceof ApiClientError && (error.status === 404 || error.code === "NOT_FOUND");
    if (is404) {
      return (
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <SEOHead
            title="Product | MN.KP"
            description="A curated affiliate product from the MN.KP store — honestly reviewed tech and creator gear."
            canonicalPath={`/store/${slug}`}
            noindex
          />
          <Breadcrumbs
            items={[
              { label: "Home", href: "#/" },
              { label: "Store", href: "#/store" },
              { label: "Not found" },
            ]}
          />
          <StatePage
            icon={FileQuestion}
            tone="gold"
            microLabel="ERROR 404"
            title="This product doesn't exist (yet)"
            description={`We could not find "${slug}". It may be off the shelf, or the link might be mistyped.`}
            actions={
              <>
                <Button onClick={() => navigate("/store")}>Browse the store</Button>
                <ALink href="#/blog">
                  <Button variant="outline">Read the buying guides</Button>
                </ALink>
              </>
            }
          />
        </div>
      );
    }
  }

  return (
    <DataState query={productQuery} emptyVariant="products" skeletonRows={6} empty={(data) => !data}>
      {(product) => <ProductDetail product={product} />}
    </DataState>
  );
}
