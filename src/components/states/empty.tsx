"use client";

import * as React from "react";
import { FileText, Inbox, SearchX, ShoppingBag, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePage } from "@/components/states/state-page";
import { ALink } from "@/components/router/link";
import { navigate, useRouter } from "@/hooks/use-router";

export type EmptyVariant = "posts" | "products" | "inbox" | "generic";

interface EmptyCopy {
  icon: LucideIcon;
  micro: string;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

const EMPTY_COPIES: Record<EmptyVariant, EmptyCopy> = {
  posts: {
    icon: FileText,
    micro: "NOTHING HERE YET",
    title: "No posts published yet",
    description: "Fresh writing is on the way — AI workflows, freelancing notes and business growth from Calicut.",
    cta: { label: "Explore services", href: "#/services" },
  },
  products: {
    icon: ShoppingBag,
    micro: "EMPTY SHELF",
    title: "No products in this aisle yet",
    description: "New gear is being curated — honestly reviewed tech and creator essentials, priced in INR.",
    cta: { label: "Browse the blog", href: "#/blog" },
  },
  inbox: {
    icon: Inbox,
    micro: "ALL CLEAR",
    title: "Inbox zero",
    description: "No messages here. New inquiries and updates will land in this list.",
  },
  generic: {
    icon: Sparkles,
    micro: "NOTHING HERE YET",
    title: "Nothing to see here yet",
    description: "This space fills up as the platform grows. Check back soon.",
  },
};

/* ========================================================================== */
/* EmptyState                                                                  */
/* ========================================================================== */

export interface EmptyStateProps {
  variant?: EmptyVariant;
  title?: string;
  description?: React.ReactNode;
  /** Custom action node; defaults to the variant CTA link when available. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  variant = "generic",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const copy = EMPTY_COPIES[variant];
  return (
    <StatePage
      icon={copy.icon}
      tone="gold"
      microLabel={copy.micro}
      title={title ?? copy.title}
      description={description ?? copy.description}
      className={className}
      actions={
        action ??
        (copy.cta ? (
          <ALink href={copy.cta.href}>
            <Button variant="outline">{copy.cta.label}</Button>
          </ALink>
        ) : null)
      }
    />
  );
}

/* ========================================================================== */
/* NoResultsState — search/filters returned nothing                            */
/* ========================================================================== */

export interface NoResultsStateProps {
  /** The search term that produced no results. */
  query?: string | null;
  /** Clear-filters callback; defaults to dropping the ?q= param on the current route. */
  onClear?: () => void;
  className?: string;
}

export function NoResultsState({ query, onClear, className }: NoResultsStateProps) {
  const { path, raw } = useRouter();
  const clear = () => {
    if (onClear) {
      onClear();
      return;
    }
    const [pathOnly] = raw.split("?");
    navigate(pathOnly || path);
  };
  return (
    <StatePage
      icon={SearchX}
      tone="neutral"
      microLabel="NO RESULTS"
      title={query ? `Nothing matched "${query}"` : "No results found"}
      description="Try a different search term, or clear the filters to see everything again."
      className={className}
      actions={
        <Button onClick={clear} variant="outline">
          Clear filters
        </Button>
      }
    />
  );
}
