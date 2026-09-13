"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
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
import { PostCard, type PostCardData } from "@/components/shared/post-card";
import { AffiliateAdSlot } from "@/components/shared/affiliate-ad-slot";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { DataState, EmptyState, NoResultsState } from "@/components/states";
import { navigate, useRouter } from "@/hooks/use-router";
import { apiFetch } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Paginated, PostDTO } from "@/types";

/**
 * BlogView — route key "blog" (#/blog).
 *
 * Debounced search + sort + category chips (?category=) + tag filter (?tag=)
 * + pagination (?page=). Mobile (<sm) renders posts as a single-column
 * list of horizontal row cards (fixes the old 2-col overflow); sm+ keeps
 * the 1/2/3-col card grid. A "between-cards" sponsored slot appears after
 * the 6th post. JSON-LD: Blog.
 */

type CategoryChip = { id: string; name: string; slug: string; postCount: number };

interface BlogQuery {
  q: string;
  category: string | null;
  tag: string | null;
  sort: "recent" | "popular";
  page: number;
}

const BLOG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "The MN.KP Blog",
  url: `${SITE.url}/blog`,
  description:
    "Practical guides on AI tools, rapid development workflows, freelancing and business growth — written from Calicut, useful everywhere.",
  publisher: { "@type": "Organization", name: "MN.KP", url: SITE.url },
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

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PostGrid({ posts }: { posts: PostCardData[] }) {
  return (
    <>
      {/* mobile: single-column LIST — thumbnail left, text right (no overflow) */}
      <ul className="space-y-3 sm:hidden">
        {posts.map((post, index) => (
          <React.Fragment key={post.slug}>
            <li>
              <PostCard post={post} size="row" />
            </li>
            {/* between-cards sponsored slot flows after the 6th post */}
            {index === 5 ? (
              <li>
                <AffiliateAdSlot placement="between-cards" />
              </li>
            ) : null}
          </React.Fragment>
        ))}
      </ul>
      {/* sm and up: full cards grid, sponsored slot as a full-row item */}
      <div className="hidden grid-cols-1 gap-5 sm:grid md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => (
          <React.Fragment key={post.slug}>
            <PostCard post={post} />
            {index === 5 ? (
              <AffiliateAdSlot
                placement="between-cards"
                className="self-start md:col-span-2 lg:col-span-3"
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

export default function BlogView() {
  const { path, query } = useRouter();

  // URL-driven filters (shareable): category / tag / page
  const category = query.get("category");
  const tag = query.get("tag");
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);

  // local controls: search + sort
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"recent" | "popular">("recent");
  const q = useDebounced(search.trim(), 300).slice(0, 100);

  const blogQuery: BlogQuery = { q, category, tag, sort, page };

  const postsQuery = useQuery({
    queryKey: ["posts", "blog", blogQuery],
    queryFn: () => {
      const params = new URLSearchParams({ sort, page: String(page), limit: "12" });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (tag) params.set("tag", tag);
      return apiFetch<Paginated<PostDTO>>(`/api/posts?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", "blog"],
    queryFn: () => apiFetch<CategoryChip[]>("/api/categories?scope=blog"),
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  /** Rebuild the current URL with one param changed (null removes it). */
  const withParam = (overrides: Record<string, string | null>): string => {
    const merged: Record<string, string> = {};
    for (const [key, value] of query.entries()) merged[key] = value;
    for (const [key, value] of Object.entries(overrides)) {
      if (value == null) delete merged[key];
      else merged[key] = value;
    }
    delete merged.q; // search stays client-side
    const params = new URLSearchParams(merged);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const setCategory = (slug: string | null) => {
    navigate(withParam({ category: slug, page: null, tag }));
  };
  const clearTag = () => {
    navigate(withParam({ tag: null, page: null }));
  };
  const goToPage = (next: number) => {
    navigate(withParam({ page: next > 1 ? String(next) : null }));
  };

  const categories = categoriesQuery.data ?? [];
  const total = postsQuery.data?.total ?? 0;
  const limit = postsQuery.data?.limit ?? 12;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  // window of page numbers around the current page
  const pageNumbers: Array<number | "ellipsis"> = [];
  for (let p = 1; p <= pageCount; p += 1) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pageNumbers.push(p);
    else if (pageNumbers[pageNumbers.length - 1] !== "ellipsis") pageNumbers.push("ellipsis");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:px-8">
      <SEOHead
        title="Blog — AI Tools, Development & Business Growth | MN.KP"
        description="Practical guides on AI tools, rapid development workflows, freelancing and business growth — written from Calicut, useful everywhere."
        canonicalPath="/blog"
        jsonLd={BLOG_JSON_LD}
      />

      <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Blog" }]} />

      <header className="mt-6 sm:mt-8">
        <SectionHeading
          as="h1"
          microLabel="The MN.KP blog"
          title="Guides worth your screen time"
          description="AI workflows, rapid development and freelancing from Calicut — written to be used, not just read. Every post answers a real question."
        />
      </header>

      {/* controls */}
      <div className="mt-6 space-y-4 sm:mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="blog-search" className="sr-only">
              Search posts
            </label>
            <Input
              id="blog-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts — try 'AI workflow' or 'freelancing'"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="blog-sort" className="sr-only">
              Sort posts
            </label>
            <Select value={sort} onValueChange={(value) => setSort(value as "recent" | "popular")}>
              <SelectTrigger id="blog-sort" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="popular">Most viewed</SelectItem>
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

        {/* active tag chip */}
        {tag ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tagged</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              #{tag}
              <button
                type="button"
                onClick={clearTag}
                aria-label={`Clear tag ${tag}`}
                className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          </div>
        ) : null}
      </div>

      {/* inline affiliate slot above the grid */}
      <div className="mt-6 sm:mt-8">
        <AffiliateAdSlot placement="blog-inline" />
      </div>

      {/* grid */}
      <div className="mt-6">
        <DataState
          query={postsQuery}
          emptyVariant="posts"
          skeletonRows={6}
          empty={() => false}
        >
          {(data) =>
            data.items.length === 0 ? (
              q ? (
                <NoResultsState query={q} onClear={() => setSearch("")} />
              ) : (
                <EmptyState variant="posts" />
              )
            ) : (
              <PostGrid posts={data.items.map(toPostCard)} />
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

      {/* reading next links (internal linking SEO) */}
      <p className="mt-12 text-center text-sm text-muted-foreground">
        Looking for something specific?{" "}
        <ALink href="#/contact" className="font-medium text-primary hover:underline">
          Ask me to write about it
        </ALink>{" "}
        — or browse the{" "}
        <ALink href="#/services" className="font-medium text-primary hover:underline">
          services
        </ALink>{" "}
        these posts come from.
      </p>
    </div>
  );
}
