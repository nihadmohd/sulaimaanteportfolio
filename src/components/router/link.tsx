"use client";

import * as React from "react";
import { navigate, isPathActive, useRouter } from "@/hooks/use-router";
import { cn } from "@/lib/utils";

/**
 * ALink — anchor that plays well with the hash router.
 *
 * - "#/blog" or "/blog" → internal hash route: left/middle-click and
 *   "open in new tab" keep working (real href), normal clicks are
 *   intercepted and routed through navigate() without a page reload.
 * - "http(s)://..." → external link: opens in a new tab with
 *   rel="noopener noreferrer".
 * - "mailto:" / "tel:" / other schemes → passed through untouched.
 *
 * Active state: `data-active="true"` attribute + `activeClassName` merge.
 * Section roots stay active on child routes ("/blog" is active on
 * "/blog/my-slug"); pass `exact` to match only the exact path.
 */

export interface ALinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Only mark active on an exact path match. */
  exact?: boolean;
  /** Classes merged in when the link is active (internal links only). */
  activeClassName?: string;
}

const INTERNAL_PREFIXES = ["#", "/"];

function isInternalHref(href: string): boolean {
  return INTERNAL_PREFIXES.some((prefix) => href.startsWith(prefix));
}

export function ALink({
  href: rawHref,
  exact,
  activeClassName,
  className,
  onClick,
  ...props
}: ALinkProps) {
  const { path } = useRouter();
  const href = rawHref.startsWith("#") ? rawHref.slice(1) : rawHref;
  const internal = isInternalHref(href);
  const external = href.startsWith("http://") || href.startsWith("https://");
  const active = internal ? isPathActive(href, path, exact) : false;

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!internal) return;
    // Let modified clicks (new tab / new window) behave natively.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <a
      href={href}
      data-active={active ? "true" : undefined}
      className={cn(className, active && activeClassName)}
      onClick={handleClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
}
