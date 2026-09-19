"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Info, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ProductCard, type ProductCardData } from "@/components/shared/product-card";
import { AffiliateAdSlot } from "@/components/shared/affiliate-ad-slot";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { OffersTicker } from "@/components/shared/offers-ticker";
import { DataState, EmptyState, NoResultsState } from "@/components/states";
import { navigate, useRouter } from "@/hooks/use-router";
import { apiFetch } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import { cn, isOfferLive } from "@/lib/utils";
import type { Paginated, ProductDTO } from "@/types";

/**
 * StoreView — route key "store" (#/store).
 *
 * Honest-curation affiliate storefront: debounced search, category chips,
 * price range + rating filters, four sort modes. Mobile renders a tight
 * 2-col grid of compact cards (aspect-square, p-2, text-xs); sm+ keeps the
 * 2/3/4-col full-card grid. A "between-cards" sponsored slot appears as a
 * full-row item after the 6th product. Sticky "store-side" ad rail on lg.
 * JSON-LD: CollectionPage + ItemList of the first page of products.
 */

type CategoryChip = { id: string; name: string; slug: string; productCount: number };

type StoreSort = "recent" | "popular" | "price-asc" | "price-desc";

const SORT_OPTIONS: Array<{ value: StoreSort; label: string }> = [
  { value: "recent", label: "Newest first" },
  { value: "popular", label: "Most clicked" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

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
    offerLabel: isOfferLive(p) ? p.offerTitle || "Special offer" : null,
  };
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <>
      {/* mobile: tight 2-col grid of compact cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {products.map((product, index) => (
          <React.Fragment key={product.slug}>
            <ProductCard product={product} size="compact" />
            {index === 5 ? (
              <AffiliateAdSlot placement="between-cards" className="col-span-2" />
            ) : null}
          </React.Fragment>
        ))}
      </div>
      {/* sm and up: full cards, sponsored slot as a full-row item */}
      <div className="hidden grid-cols-2 gap-5 sm:grid lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <React.Fragment key={product.slug}>
            <ProductCard product={product} />
            {index === 5 ? (
              <AffiliateAdSlot
                placement="between-cards"
                className="self-start sm:col-span-2 lg:col-span-3 xl:col-span-4"
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

export default function StoreView() {
  const { path, query } = useRouter();

  // URL-driven filters
  const category = query.get("category");
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);

  // local controls
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search.trim(), 300).slice(0, 100);
  const [sort, setSort] = React.useState<StoreSort>("recent");
  const [rating, setRating] = React.useState<string>("any");
  const [minText, setMinText] = React.useState("");
  const [maxText, setMaxText] = React.useState("");
  const [appliedPrice, setAppliedPrice] = React.useState<{ min: string; max: string }>({
    min: "",
    max: "",
  });

  const productsQuery = useQuery({
    queryKey: ["products", "store", { q, category, sort, rating, ...appliedPrice, page }],
    queryFn: () => {
      const params = new URLSearchParams({ sort, page: String(page), limit: "12" });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (rating !== "any") params.set("rating", rating);
      if (appliedPrice.min) params.set("min", appliedPrice.min);
      if (appliedPrice.max) params.set("max", appliedPrice.max);
      return apiFetch<Paginated<ProductDTO>>(`/api/products?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", "store"],
    queryFn: () => apiFetch<CategoryChip[]>("/api/categories?scope=store"),
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Live special offers rail (Task 14) — hidden when nothing is running.
  const offersQuery = useQuery({
    queryKey: ["store-offers"],
    queryFn: () => apiFetch<Paginated<ProductDTO>>("/api/products?offer=1&limit=8"),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const liveOffers = React.useMemo(
    () => (offersQuery.data?.items ?? []).filter(isOfferLive),
    [offersQuery.data]
  );

  const withParam = (overrides: Record<string, string | null>): string => {
    const merged: Record<string, string> = {};
    for (const [key, value] of query.entries()) merged[key] = value;
    for (const [key, value] of Object.entries(overrides)) {
      if (value == null) delete merged[key];
      else merged[key] = value;
    }
    delete merged.q;
    const params = new URLSearchParams(merged);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const setCategory = (slug: string | null) => {
    navigate(withParam({ category: slug, page: null }));
  };
  const goToPage = (next: number) => {
    navigate(withParam({ page: next > 1 ? String(next) : null }));
  };

  const applyPrice = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedPrice({ min: minText.trim(), max: maxText.trim() });
    navigate(withParam({ page: null }));
  };

  const clearFilters = () => {
    setSearch("");
    setRating("any");
    setMinText("");
    setMaxText("");
    setAppliedPrice({ min: "", max: "" });
    navigate(path);
  };

  const categories = categoriesQuery.data ?? [];
  const total = productsQuery.data?.total ?? 0;
  const limit = productsQuery.data?.limit ?? 12;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const hasFilters = Boolean(q || category || rating !== "any" || appliedPrice.min || appliedPrice.max);

  const pageNumbers: Array<number | "ellipsis"> = [];
  for (let p = 1; p <= pageCount; p += 1) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pageNumbers.push(p);
    else if (pageNumbers[pageNumbers.length - 1] !== "ellipsis") pageNumbers.push("ellipsis");
  }

  const jsonLd = React.useMemo(() => {
    const items = (productsQuery.data?.items ?? []).slice(0, 12);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "The MN.KP Affiliate Store",
      url: `${SITE.url}/store`,
      description:
        "Honestly reviewed tech and creator gear — cameras, audio, accessories and digital tools — curated in Calicut for creators everywhere.",
      isPartOf: { "@type": "WebSite", name: "MN.KP", url: SITE.url },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.name,
          url: `${SITE.url}/store/${product.slug}`,
        })),
      },
    };
  }, [productsQuery.data]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:px-8">
      <SEOHead
        title="Affiliate Store — Curated Tech & Creator Gear | MN.KP"
        description="Honestly reviewed tech and creator gear — cameras, audio, accessories and digital tools — curated in Calicut for creators everywhere."
        canonicalPath="/store"
        jsonLd={jsonLd}
      />

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Store" }]} />

      <header className="mt-6 sm:mt-8">
        <SectionHeading
          as="h1"
          microLabel="The MN.KP affiliate store"
          title="Gear I actually use"
          description="Every product here is honestly reviewed and used on real client work before it earns a link. Prices in INR, curated in Calicut for creators everywhere."
        />
        <p className="mt-4 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
          <span>
            Affiliate disclosure: purchases through these links may earn MN.KP a commission at no
            extra cost to you —{" "}
            <ALink href="/legal/affiliate-disclosure" className="underline underline-offset-2 hover:text-gold">
              read the full disclosure
            </ALink>
            .
          </span>
        </p>
      </header>

      {/* ad-like scrolling offers strip (Task 14) */}
      <div className="mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
        <OffersTicker compact />
      </div>

      {/* Live offers rail */}
      {liveOffers.length > 0 ? (
        <section aria-label="Live special offers" className="mt-10">
          <SectionHeading
            microLabel="Limited-time"
            title="Live special offers"
            description="Exclusive offers for MN.KP readers — running right now, while they last."
          />
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {liveOffers.slice(0, 8).map((p) => (
              <ProductCard key={p.slug} product={toProductCard(p)} size="compact" className="sm:aspect-auto" />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-10 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* main column */}
        <div className="min-w-0">
          {/* controls */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <label htmlFor="store-search" className="sr-only">
                  Search products
                </label>
                <Input
                  id="store-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search gear — try 'headphones' or 'camera'"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="store-sort" className="sr-only">
                  Sort products
                </label>
                <Select value={sort} onValueChange={(value) => setSort(value as StoreSort)}>
                  <SelectTrigger id="store-sort" className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* category chips — full-bleed horizontal scroll on mobile */}
            <div
              className="scrollbar-slim -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
              role="group"
              aria-label="Filter by category"
            >
              <button
                type="button"
                onClick={() => setCategory(null)}
                aria-pressed={!category}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors sm:py-1.5",
                  !category
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : "bg-card text-muted-foreground hover:border-gold/40 hover:text-foreground"
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setCategory(cat.slug)}
                  aria-pressed={category === cat.slug}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors sm:py-1.5",
                    category === cat.slug
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "bg-card text-muted-foreground hover:border-gold/40 hover:text-foreground"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* price + rating */}
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <form onSubmit={applyPrice} className="flex items-end gap-2" aria-label="Price range">
                <div>
                  <label
                    htmlFor="store-price-min"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Min (INR)
                  </label>
                  <Input
                    id="store-price-min"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={minText}
                    onChange={(event) => setMinText(event.target.value)}
                    placeholder="0"
                    className="h-9 w-24"
                  />
                </div>
                <div>
                  <label
                    htmlFor="store-price-max"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Max (INR)
                  </label>
                  <Input
                    id="store-price-max"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={maxText}
                    onChange={(event) => setMaxText(event.target.value)}
                    placeholder="99999"
                    className="h-9 w-24"
                  />
                </div>
                <Button type="submit" variant="secondary" className="h-9">
                  Apply
                </Button>
              </form>

              <div className="ml-auto">
                <label
                  htmlFor="store-rating"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Rating
                </label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger id="store-rating" className="h-9 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any rating</SelectItem>
                    <SelectItem value="4">4.0 and up</SelectItem>
                    <SelectItem value="4.5">4.5 and up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* grid */}
          <div className="mt-6">
            <DataState
              query={productsQuery}
              emptyVariant="products"
              skeletonRows={8}
              empty={() => false}
            >
              {(data) =>
                data.items.length === 0 ? (
                  hasFilters ? (
                    <NoResultsState query={q || undefined} onClear={clearFilters} />
                  ) : (
                    <EmptyState variant="products" />
                  )
                ) : (
                  <ProductGrid products={data.items.map(toProductCard)} />
                )
              }
            </DataState>
          </div>

          {/* pagination */}
          {pageCount > 1 ? (
            <Pagination className="mt-10">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) goToPage(page - 1);
                    }}
                  />
                </PaginationItem>
                {pageNumbers.map((pageNumber, index) =>
                  pageNumber === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <span className="flex size-9 items-center justify-center text-muted-foreground">
                        …
                      </span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href={withParam({ page: pageNumber > 1 ? String(pageNumber) : null })}
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault();
                          goToPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= pageCount}
                    className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < pageCount) goToPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}

          {/* cross-link (SEO) */}
          <p className="mt-12 text-sm text-muted-foreground">
            <span>
              Want the reasoning behind these picks? Read the{" "}
              <ALink href="/blog" className="font-medium text-primary hover:underline">
                buying guides on the blog
              </ALink>{" "}
              — every review links back to real usage.
            </span>
          </p>
        </div>

        {/* sidebar rail (lg+) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <AffiliateAdSlot placement="store-side" />
            <div className="rounded-xl border border-gold/30 bg-gold/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Honest curation
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Nothing lands in this store without surviving real client work first. If a pick
                stops being the best option, it gets removed — quietly.
              </p>
              <ALink
                href="/legal/affiliate-disclosure"
                className="mt-3 inline-block text-xs font-medium text-primary underline underline-offset-2 hover:text-gold"
              >
                How affiliate links work
              </ALink>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
