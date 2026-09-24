"use client";

import * as React from "react";

/**
 * MN.KP path router core.
 *
 * All user-facing navigation lives on a single page via Catch-all route `[[...slug]]/page.tsx`
 *   /blog/my-slug  →  path "/blog/my-slug"
 *
 * This module owns:
 *   - parsePath()        — pure location parser
 *   - navigate()         — imperative navigation (history.pushState)
 *   - RouterProvider     — context provider wired to popstate
 *   - useRouter()        — { path, segments, query, raw, navigate }
 *   - isPathActive()     — active-link detection helper
 */

export interface RouteLocation {
  /** Normalized path, always leading-slash, no trailing slash. e.g. "/blog/my-slug" */
  path: string;
  /** Path segments. e.g. ["blog", "my-slug"] */
  segments: string[];
  /** Parsed query params of the URL. */
  query: URLSearchParams;
  /** Raw pathname + search. e.g. "/blog/my-slug?q=ai" */
  raw: string;
}

export interface RouterContextValue extends RouteLocation {
  navigate: (href: string) => void;
}

const RouterContext = React.createContext<RouterContextValue | null>(null);

/** Parse a raw URL string into a normalized location. */
export function parsePath(url: string): RouteLocation {
  const [pathPart = "", queryPart = ""] = url.split("?");
  let path = pathPart || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(queryPart || "");
  const segments = path.split("/").filter(Boolean);
  return { path, segments, query, raw: url };
}

/**
 * Navigate to a route. Accepts "/blog", "blog".
 * Uses history.pushState and scrolls to top.
 */
export function navigate(href: string): void {
  if (typeof window === "undefined") return;
  let target = href;
  // If it still has a hash prefix, strip it (for backward compatibility during migration)
  if (target.startsWith("#")) target = target.slice(1);
  if (!target.startsWith("/")) target = `/${target}`;
  
  const current = window.location.pathname + window.location.search;
  if (target === current) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  
  window.history.pushState({}, "", target);
  window.dispatchEvent(new Event("popstate"));
  
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
  };
}

function getSnapshot(): string {
  return window.location.pathname + window.location.search;
}

export function RouterProvider({ initialPath = "/", children }: { initialPath?: string, children: React.ReactNode }) {
  const url = React.useSyncExternalStore(subscribe, getSnapshot, () => initialPath);
  const location = React.useMemo(() => parsePath(url || "/"), [url]);
  
  const value = React.useMemo<RouterContextValue>(
    () => ({ ...location, navigate }),
    [location]
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

/** Current router state. Must be rendered inside <RouterProvider>. */
export function useRouter(): RouterContextValue {
  const ctx = React.useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used inside <RouterProvider> (src/hooks/use-router.ts).");
  }
  return ctx;
}

/**
 * Active-link detection. Section roots stay active for their children
 * ("/blog" is active on "/blog/my-slug"); "/" only matches exactly.
 */
export function isPathActive(href: string, currentPath: string, exact = false): boolean {
  let rawTarget = href;
  if (rawTarget.startsWith("#")) rawTarget = rawTarget.slice(1);
  if (!rawTarget.startsWith("/")) rawTarget = `/${rawTarget}`;
  
  const target = parsePath(rawTarget).path;
  if (exact || target === "/") return currentPath === target;
  if (currentPath === target) return true;
  return currentPath.startsWith(`${target}/`);
}
