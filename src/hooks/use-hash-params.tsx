"use client";

import * as React from "react";
import { useRouter } from "@/hooks/use-router";
import { matchRoute } from "@/router/routes";

/**
 * Route params (:slug etc.) for the currently matched route.
 * AppRouter provides matched params via context; outside the router view
 * tree this falls back to matching the current path against the registry.
 */

export type RouteParams = Record<string, string>;

const RouteParamsContext = React.createContext<RouteParams>({});

export function RouteParamsProvider({
  params,
  children,
}: {
  params: RouteParams;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => params, [params]);
  return <RouteParamsContext.Provider value={value}>{children}</RouteParamsContext.Provider>;
}

/**
 * Read route params for the current view, e.g. slug for /blog/:slug.
 * Usage: const { slug } = useHashParams<{ slug: string }>();
 */
export function useHashParams<T extends RouteParams = RouteParams>(): T {
  const contextParams = React.useContext(RouteParamsContext);
  const { path } = useRouter();
  return React.useMemo(() => {
    if (Object.keys(contextParams).length > 0) return contextParams;
    return matchRoute(path)?.params ?? {};
  }, [contextParams, path]) as T;
}
