"use client";

import * as React from "react";

/**
 * MN.KP hash router core.
 *
 * All user-facing navigation lives on a single page and is hash-based:
 *   #/blog/my-slug  →  path "/blog/my-slug"
 *
 * This module owns:
 *   - parseHash()        — pure location parser
 *   - navigate()         — imperative navigation (sets location.hash, scrolls to top)
 *   - RouterProvider     — context provider wired to hashchange + popstate
 *   - useRouter()        — { path, segments, query, raw, navigate }
 *   - isPathActive()     — active-link detection helper (exact or section-prefix)
 */

export interface RouteLocation {
  /** Normalized path, always leading-slash, no trailing slash. e.g. "/blog/my-slug" */
  path: string;
  /** Path segments. e.g. ["blog", "my-slug"] */
  segments: string[];
  /** Parsed query params of the hash URL. */
  query: URLSearchParams;
  /** Raw hash contents without the leading "#". e.g. "/blog/my-slug?q=ai" */
  raw: string;
}

export interface RouterContextValue extends RouteLocation {
  navigate: (href: string) => void;
}

const RouterContext = React.createContext<RouterContextValue | null>(null);

/** Parse a raw hash string (with or without "#") into a normalized location. */
export function parseHash(hash: string): RouteLocation {
  const raw = hash.replace(/^#/, "");
  const [pathPart = "", queryPart = ""] = raw.split("?");
  let path = pathPart || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(queryPart || "");
  const segments = path.split("/").filter(Boolean);
  return { path, segments, query, raw };
}

/**
 * Navigate to a hash route. Accepts "#/blog", "/blog" or "blog".
 * Sets location.hash (which fires hashchange) and scrolls the window to top.
 */
export function navigate(href: string): void {
  if (typeof window === "undefined") return;
  let target = href.startsWith("#") ? href.slice(1) : href;
  if (!target.startsWith("/")) target = `/${target}`;
  const current = window.location.hash.replace(/^#/, "") || "/";
  if (target === current) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  window.location.hash = target;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

function getSnapshot(): string {
  return window.location.hash;
}

function getServerSnapshot(): string {
  return "";
}

/** Raw hash string subscription — re-renders on every hashchange/popstate. */
export function useHashLocation(): RouteLocation {
  const hash = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return React.useMemo(() => parseHash(hash || "#/"), [hash]);
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const location = useHashLocation();
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
  const target = parseHash(href.startsWith("#") ? href : `#${href}`).path;
  if (exact || target === "/") return currentPath === target;
  if (currentPath === target) return true;
  return currentPath.startsWith(`${target}/`);
}
