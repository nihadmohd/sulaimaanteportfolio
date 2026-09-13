"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileQuestion, ListTree, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PostCard, formatCompact, type PostCardData } from "@/components/shared/post-card";
import { AffiliateAdSlot } from "@/components/shared/affiliate-ad-slot";
import { SocialShare } from "@/components/shared/social-share";
import {
  ListenCard,
  MinLeftSlot,
  MobileActionCluster,
  NextUpCard,
  QuoteSharePopover,
  ReadingProgressBar,
  ResumeReading,
  useArticleScrollTracker,
  type ScrollTracker,
} from "@/components/shared/reading-experience";
import { SEOHead } from "@/components/shared/seo-head";
import { DataState, StatePage } from "@/components/states";
import {
  MarkdownBlock,
  MarkdownFallback,
  slugText,
} from "@/components/views/shared/markdown";
import { useHashParams } from "@/hooks/use-hash-params";
import { navigate } from "@/hooks/use-router";
import { markdownToPlain, useTts } from "@/hooks/use-tts";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SITE, VIEW_DEDUPE_PREFIX } from "@/lib/constants";
import type { Paginated, PostDTO } from "@/types";

/**
 * PostView — route key "blog-post" (#/blog/:slug). The money page.
 *
 * AEO quick-answer box, lazy-loaded react-markdown + remark-gfm with custom
 * renderers, inline affiliate slot after the 3rd paragraph, sticky TOC +
 * sidebar ad rail on desktop, view dedupe via sessionStorage, related
 * reading, BlogPosting JSON-LD and DB-driven SEO overrides.
 *
 * Engagement layer (12-a): copper reading progress bar + live minutes-left,
 * "Listen to this article" SpeechSynthesis narration, resume-reading banner,
 * select-to-share quote toolbar, session-aware "Up next" card, mobile
 * floating action cluster, and desktop keyboard shortcuts (t / s / Esc).
 */

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Extract h2/h3 headings (skipping fenced code) for the table of contents. */
function extractHeadings(content: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const text = match[2].replace(/[*_`]/g, "").trim();
      out.push({ id: slugText(text), text, level: match[1].length as 2 | 3 });
    }
  }
  return out;
}

/** Drop a leading "# Title" line when it duplicates the post title. */
function stripLeadingTitle(content: string, title: string): string {
  const trimmed = content.replace(/^\s+/, "");
  const match = /^#\s+(.+?)\s*$/m.exec(trimmed);
  if (match && slugText(match[1]) === slugText(title)) {
    return trimmed.slice(match[0].length).replace(/^\s+/, "");
  }
  return content;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

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

function scrollToHeading(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------------------------------------------ */
/* TOC                                                                 */
/* ------------------------------------------------------------------ */

function TableOfContents({
  headings,
  tracker,
  readingMinutes,
}: {
  headings: Heading[];
  tracker: ScrollTracker;
  readingMinutes: number;
}) {
  if (headings.length === 0) return null;

  return (
    <nav aria-label="Table of contents">
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <ListTree className="size-3.5" aria-hidden="true" />
        On this page
      </p>
      <div className="gold-rule mt-3 mb-4 w-12" aria-hidden="true" />
      <ul className="space-y-1.5">
        {headings.map((heading) => (
          <li key={`${heading.id}-${heading.text}`} className={heading.level === 3 ? "pl-3" : undefined}>
            <button
              type="button"
              onClick={() => scrollToHeading(heading.id)}
              className={cnLike(
                "block w-full text-left text-xs leading-snug transition-colors hover:text-primary",
                heading.level === 2 ? "font-medium text-foreground/80" : "text-muted-foreground"
              )}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
      <MinLeftSlot tracker={tracker} readingMinutes={readingMinutes} />
    </nav>
  );
}

// tiny local cn replacement to avoid importing utils twice patterns
function cnLike(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* article                                                             */
/* ------------------------------------------------------------------ */

function PostArticle({ post }: { post: PostDTO }) {
  const content = React.useMemo(
    () => stripLeadingTitle(post.content, post.title),
    [post.content, post.title]
  );
  const headings = React.useMemo(() => extractHeadings(content), [content]);
  const wordCount = React.useMemo(
    () => post.content.trim().split(/\s+/).filter(Boolean).length,
    [post.content]
  );
  const segments = React.useMemo(
    () => content.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    [content]
  );

  /* ---- engagement layer (12-a) --------------------------------- */
  const articleRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const tracker = useArticleScrollTracker(articleRef);

  // Narration text: title spoken first, then the markdown-stripped body.
  const narrationText = React.useMemo(
    () => `${post.title}. ${markdownToPlain(content)}`,
    [post.title, content]
  );
  const tts = useTts(React.useMemo(() => ({ text: narrationText }), [narrationText]));

  // Desktop keyboard shortcuts: t = play/pause narration, s = focus share,
  // Esc = stop narration. Ignored while typing in form fields.
  React.useEffect(() => {
    const { toggle, stop } = tts;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "escape") {
        stop();
        return;
      }
      if (event.repeat) return;
      if (key === "t") {
        toggle();
      } else if (key === "s") {
        const shareArea = document.getElementById("post-share-area");
        const button = shareArea?.querySelector("button");
        if (shareArea && button) {
          shareArea.scrollIntoView({ block: "center", behavior: "smooth" });
          button.focus({ preventScroll: true });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tts]);

  const relatedQuery = useQuery({
    queryKey: ["posts", "related", post.category?.slug ?? "none", post.slug],
    queryFn: () =>
      apiFetch<Paginated<PostDTO>>(
        `/api/posts?category=${encodeURIComponent(post.category?.slug ?? "")}&limit=4`
      ),
    enabled: Boolean(post.category?.slug),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Stable identities so the NextUpCard effect (session visited tracking)
  // doesn't re-run on every render.
  const related = React.useMemo(
    () => (relatedQuery.data?.items ?? []).filter((item) => item.slug !== post.slug).slice(0, 3),
    [relatedQuery.data, post.slug]
  );
  const relatedCards = React.useMemo(
    () => related.map((item) => toPostCard(item)),
    [related]
  );

  const canonicalPath = `/blog/${post.slug}`;
  const ogImage = post.ogImageUrl ?? post.coverImageUrl ?? SITE.ogImage;
  const description = post.seoDescription ?? post.excerpt ?? post.title;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seoTitle ?? post.title,
    description,
    image: [ogImage.startsWith("http") ? ogImage : `${SITE.url}${ogImage}`],
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      name: post.author?.fullName ?? SITE.owner,
      url: `${SITE.url}/about`,
    },
    publisher: { "@type": "Organization", name: "MN.KP", url: SITE.url },
    keywords: post.tags.join(", "),
    wordCount,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE.url}${canonicalPath}` },
  };

  const renderSegments = () => (
    <>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          <React.Suspense fallback={<MarkdownFallback />}>
            <MarkdownBlock content={segment} />
          </React.Suspense>
          {index === 2 ? <AffiliateAdSlot placement="blog-inline" className="my-8" /> : null}
        </React.Fragment>
      ))}
    </>
  );

  return (
    <>
      <ReadingProgressBar tracker={tracker} readingMinutes={post.readingTimeMinutes} />
      <article
        ref={articleRef}
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:px-8"
      >
      <SEOHead
        title={post.seoTitle ?? post.title}
        description={description}
        canonicalPath={canonicalPath}
        ogImage={ogImage}
        ogType="article"
        jsonLd={jsonLd}
      />

      <Breadcrumbs
        items={[
          { label: "Home", href: "#/" },
          { label: "Blog", href: "#/blog" },
          { label: post.title },
        ]}
      />

      <ResumeReading slug={post.slug} articleRef={articleRef} tracker={tracker} />

      {/* header */}
      <header className="mt-6 max-w-3xl sm:mt-8">
        {post.category ? (
          <ALink href={`#/blog?category=${post.category.slug}`}>
            <Badge variant="secondary" className="border-gold/40 bg-gold/10 text-gold">
              {post.category.name}
            </Badge>
          </ALink>
        ) : null}
        <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          {post.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
          {post.author ? (
            <span className="inline-flex items-center gap-2">
              <Avatar className="size-7">
                {post.author.avatarUrl ? (
                  <AvatarImage src={post.author.avatarUrl} alt={post.author.fullName} />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {post.author.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground/90">{post.author.fullName}</span>
            </span>
          ) : null}
          {post.publishedAt ? <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time> : null}
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="size-3.5" aria-hidden="true" />
            {post.readingTimeMinutes} min read
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Eye className="size-3.5" aria-hidden="true" />
            {formatCompact(post.viewsCount)} views
          </span>
          <SocialShare title={post.title} path={canonicalPath} className="ml-auto lg:hidden" />
        </div>
      </header>

      {/* cover image — eager: it is the LCP element */}
      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt={post.title}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="mt-6 aspect-video w-full rounded-2xl border object-cover shadow-sm sm:mt-8"
        />
      ) : null}

      {/* quick answer (AEO) */}
      {post.excerpt ? (
        <aside
          aria-label="Quick answer"
          className="mt-8 max-w-3xl rounded-r-xl border-l-4 border-gold bg-gold/[0.06] p-4 md:p-5"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Quick answer</p>
          <p className="mt-2 text-pretty text-[15px] leading-7 text-foreground/90 md:text-base">
            {post.excerpt}
          </p>
        </aside>
      ) : null}

      {/* listen to this article — browser SpeechSynthesis narration */}
      <ListenCard tts={tts} readingMinutes={post.readingTimeMinutes} />

      {/* mobile TOC */}
      {headings.length > 0 ? (
        <Collapsible className="mt-8 max-w-3xl lg:hidden">
          <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <CollapsibleTrigger className="inline-flex items-center gap-2 text-sm font-medium">
              <ListTree className="size-4 text-gold" aria-hidden="true" />
              On this page ({headings.length})
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="mt-2 rounded-xl border bg-card p-4">
              <TableOfContents
                headings={headings}
                tracker={tracker}
                readingMinutes={post.readingTimeMinutes}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {/* content + sticky rail */}
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div ref={contentRef} className="min-w-0 max-w-3xl">{renderSegments()}</div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-8">
            <TableOfContents
              headings={headings}
              tracker={tracker}
              readingMinutes={post.readingTimeMinutes}
            />
            <AffiliateAdSlot placement="blog-sidebar" />
            <div id="post-share-area" className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Share this post
              </p>
              <div className="mt-3">
                <SocialShare title={post.title} path={canonicalPath} />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* tags */}
      {post.tags.length > 0 ? (
        <div className="mt-12 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Tags</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag}>
                <ALink
                  href={`#/blog?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
                >
                  #{tag}
                </ALink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* author box */}
      <div className="mt-10 max-w-3xl rounded-2xl border bg-card p-5 shadow-xs md:p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-12">
            {post.author?.avatarUrl ? (
              <AvatarImage src={post.author.avatarUrl} alt={post.author.fullName} />
            ) : null}
            <AvatarFallback>{(post.author?.fullName ?? "MN").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {post.author?.fullName ?? SITE.owner}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {post.author?.headline ?? SITE.roleLine}
            </p>
            <ALink
              href="#/about"
              className="mt-2 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Read more about me
            </ALink>
          </div>
        </div>
      </div>

      {/* related reading */}
      {post.category ? (
        <section className="mt-14" aria-label="Related reading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Keep reading
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Related reading</h2>
            </div>
            <ALink
              href={`#/blog?category=${post.category.slug}`}
              className="mb-1 text-sm font-medium text-primary hover:underline"
            >
              All {post.category.name}
            </ALink>
          </div>
          <div className="mt-6">
            <DataState query={relatedQuery} emptyVariant="posts" skeletonRows={3} empty={() => false}>
              {(data) => {
                const items = data.items.filter((item) => item.slug !== post.slug).slice(0, 3);
                if (items.length === 0) return null;
                return (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <PostCard key={item.slug} post={toPostCard(item)} />
                    ))}
                  </div>
                );
              }}
            </DataState>
          </div>
        </section>
      ) : null}

      {/* up next — session-aware auto-pick retention hook */}
      <NextUpCard currentSlug={post.slug} posts={relatedCards} />

      {/* CTA band */}
      <section className="mt-14 rounded-2xl border border-gold/40 bg-gold/[0.05] p-6 text-center md:p-10">
        <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
          Need this built for you?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
          Reading about the workflow is one thing — having it work for your project is another.
          Scoped quote within 24 hours.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ALink href="#/services">
            <Button className="gap-2">See the services</Button>
          </ALink>
          <ALink href="#/contact">
            <Button variant="outline" className="gap-2 border-gold/50 text-gold hover:bg-gold/10">
              Get a quote
            </Button>
          </ALink>
        </div>
      </section>

      {/* select-to-share quote toolbar (scoped to the article body) */}
      <QuoteSharePopover
        contentRef={contentRef}
        tracker={tracker}
        title={post.title}
        slug={post.slug}
      />

      {/* mobile floating action cluster — back to top + share */}
      <MobileActionCluster tracker={tracker} shareTitle={post.title} sharePath={canonicalPath} />
      </article>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function PostView() {
  const { slug } = useHashParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const postQuery = useQuery({
    queryKey: ["post", slug],
    queryFn: () => apiFetch<PostDTO>(`/api/posts/${encodeURIComponent(slug ?? "")}`),
    enabled: Boolean(slug),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // View tracking — deduped per session via sessionStorage.
  React.useEffect(() => {
    const post = postQuery.data;
    if (!post) return;
    const key = `${VIEW_DEDUPE_PREFIX}${post.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    apiFetch<{ views: number }>(`/api/posts/${post.id}/view`, { method: "POST" })
      .then((res) => {
        queryClient.setQueryData<PostDTO>(["post", post.slug], (old) =>
          old ? { ...old, viewsCount: res.views } : old
        );
      })
      .catch(() => {
        /* view counting is best-effort */
      });
  }, [postQuery.data, queryClient]);

  if (!slug) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SEOHead title="Blog Post | MN.KP" description="An article from the MN.KP blog." canonicalPath="/blog" noindex />
        <StatePage
          icon={FileQuestion}
          tone="gold"
          microLabel="ERROR 404"
          title="This post doesn't exist (yet)"
          description="No post slug was given. Browse the blog to find what you were looking for."
          actions={
            <Button onClick={() => navigate("/blog")}>Browse the blog</Button>
          }
        />
      </div>
    );
  }

  if (postQuery.isError) {
    const error = postQuery.error;
    const is404 = error instanceof ApiClientError && (error.status === 404 || error.code === "NOT_FOUND");
    if (is404) {
      return (
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <SEOHead
            title="Blog Post | MN.KP"
            description="An article from the MN.KP blog — practical guides on AI tools, development and business growth from Calicut, Kerala."
            canonicalPath={`/blog/${slug}`}
            noindex
          />
          <Breadcrumbs
            items={[{ label: "Home", href: "#/" }, { label: "Blog", href: "#/blog" }, { label: "Not found" }]}
          />
          <StatePage
            icon={FileQuestion}
            tone="gold"
            microLabel="ERROR 404"
            title="This post doesn't exist (yet)"
            description={`We could not find "${slug}". It may still be a draft, or the link might be mistyped.`}
            actions={
              <>
                <Button onClick={() => navigate("/blog")}>Browse the blog</Button>
                <ALink href="#/">
                  <Button variant="outline">Back home</Button>
                </ALink>
              </>
            }
          />
        </div>
      );
    }
    // Non-404 errors flow through DataState below.
  }

  return (
    <DataState query={postQuery} emptyVariant="posts" skeletonRows={6} empty={(data) => !data}>
      {(post) => <PostArticle post={post} />}
    </DataState>
  );
}
