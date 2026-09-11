"use client";

import * as React from "react";
import { Eye, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ALink } from "@/components/router/link";
import { cn } from "@/lib/utils";

/**
 * PostCard — blog card for grids (default) and compact 2-col mobile grids.
 * Data contract is intentionally loose so list endpoints can feed it directly.
 */

export interface PostCardAuthor {
  name: string;
  avatarUrl?: string | null;
}

export interface PostCardData {
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  category?: string | null;
  readingMinutes?: number | null;
  views?: number | null;
  author?: PostCardAuthor | null;
  publishedAt?: string | Date | null;
}

/** Compact count formatting: 1200 → "1.2k", 950 → "950". */
export function formatCompact(value: number | null | undefined): string {
  if (value == null) return "0";
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k >= 10 ? Math.round(k) : Number(k.toFixed(1))}k`;
  }
  return `${(value / 1_000_000).toFixed(1)}M`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export interface PostCardProps {
  post: PostCardData;
  /** compact = mini card for 2-col mobile grids. */
  size?: "default" | "compact";
  className?: string;
}

export function PostCard({ post, size = "default", className }: PostCardProps) {
  const href = `#/blog/${post.slug}`;

  if (size === "compact") {
    return (
      <ALink
        href={href}
        className={cn(
          "group flex gap-3 rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md focus-visible:shadow-md",
          className
        )}
        aria-label={post.title}
      >
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-16 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-gold/30 via-primary/20 to-primary/10"
          >
            <Clock className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight group-hover:text-primary">
            {post.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            {post.category ? <span className="uppercase tracking-wide">{post.category}</span> : null}
            {post.views != null ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Eye className="size-3" aria-hidden="true" />
                {formatCompact(post.views)}
              </span>
            ) : null}
          </div>
        </div>
      </ALink>
    );
  }

  return (
    <ALink
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:shadow-md",
        className
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-full items-center justify-center bg-gradient-to-br from-gold/30 via-primary/20 to-primary/10"
          >
            <Clock className="size-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
        )}
        {post.category ? (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 border-gold/30 bg-background/85 text-foreground backdrop-blur-sm"
          >
            {post.category}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        <h3 className="text-balance font-semibold leading-snug tracking-tight group-hover:text-primary md:text-lg">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            {post.author ? (
              <>
                <Avatar className="size-6">
                  {post.author.avatarUrl ? (
                    <AvatarImage src={post.author.avatarUrl} alt={post.author.name} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">{initials(post.author.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-muted-foreground">
                  {post.author.name}
                </span>
              </>
            ) : (
              <span className="truncate text-xs text-muted-foreground">
                {formatDate(post.publishedAt)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            {post.readingMinutes ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="size-3" aria-hidden="true" />
                {post.readingMinutes}m
              </span>
            ) : null}
            {post.views != null ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Eye className="size-3" aria-hidden="true" />
                {formatCompact(post.views)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </ALink>
  );
}
