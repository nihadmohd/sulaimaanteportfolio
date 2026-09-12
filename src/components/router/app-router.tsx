"use client";

import * as React from "react";
import { matchRoute } from "@/router/routes";
import { viewRegistry } from "@/router/view-registry";
import { SEOHead } from "@/components/shared/seo-head";
import { RouteParamsProvider } from "@/hooks/use-hash-params";
import { navigate, useRouter } from "@/hooks/use-router";
import { isStaff, useSession } from "@/hooks/use-session";
import { LoadingState } from "@/components/states/loading";
import {
  ForbiddenState,
  NotFoundState,
  ServerErrorState,
  SessionExpiredState,
} from "@/components/states/http-states";

/**
 * AppRouter — sits inside <RouterProvider>; matches the current hash path
 * against src/router/routes.ts, applies guards, renders the lazily-loaded
 * view from src/router/view-registry.ts and fires route-default SEO.
 *
 * Guard behaviour (BUILD CONTRACT §7 / §0):
 * - guard "auth" without a user → redirect ONCE to the login route with
 *   ?expired=0&next=<path> (admin routes use #/admin/login).
 * - guard "staff" without a user → same one-shot login redirect.
 * - guard "staff" with a signed-in non-staff user → ForbiddenState (403).
 * - ?expired=1 on the login route → SessionExpiredState (never a loop:
 *   auth routes themselves never trigger redirects).
 * - Unknown paths and missing registry entries → NotFoundState.
 *
 * Views receive :params via RouteParamsProvider (useHashParams) and may
 * override SEO by rendering their own <SEOHead> (last mounted wins).
 */

interface BoundaryState {
  error: Error | null;
}

/**
 * Detail/"pushed" routes get the horizontal slide-in transition (native app
 * push navigation); everything else rises softly. Admin deep links count as
 * pushed too (editing screens feel like drilling into a stack).
 */
function isDetailRoute(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  if (segments[0] === "admin") return segments.length >= 2;
  return ["blog", "store", "ventures", "legal"].includes(segments[0]) && segments.length >= 2;
}

class ViewErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[mnkp-view-error]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ServerErrorState
          onRetry={() => {
            this.setState({ error: null });
            if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          }}
        />
      );
    }
    return this.props.children;
  }
}

export function AppRouter() {
  const { path, query } = useRouter();
  const { user, isLoading } = useSession();
  const redirectedFor = React.useRef<string | null>(null);

  const match = React.useMemo(() => matchRoute(path), [path]);
  const route = match?.route;

  // Scroll restoration: back to top whenever the route changes.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  // Auth routes never trigger the auth redirect → no loops possible.
  const isAuthRoute = path === "/auth/login" || path === "/admin/login" || path.startsWith("/auth/");

  React.useEffect(() => {
    if (!route?.guard || isLoading || user || isAuthRoute) return;
    if (redirectedFor.current === path) return;
    redirectedFor.current = path;
    const loginPath = path.startsWith("/admin") ? "/admin/login" : "/auth/login";
    navigate(`${loginPath}?expired=0&next=${encodeURIComponent(path)}`);
  }, [route, isLoading, user, isAuthRoute, path]);

  // ---- Render ------------------------------------------------------------

  // 404 — unknown route.
  if (!route || !match) {
    return (
      <>
        <SEOHead
          title="Page not found"
          description="The page you were looking for could not be found on MN.KP."
          canonicalPath={path}
          noindex
        />
        <NotFoundState path={path} />
      </>
    );
  }

  // Session-expired notice on the login route (?expired=1).
  if (query.get("expired") === "1" && route.key === "auth-login") {
    const next = query.get("next") ?? undefined;
    return <SessionExpiredState next={next} />;
  }

  // Guarded routes: hold while the session is resolving.
  if (route.guard && isLoading) {
    return <LoadingState variant="spinner" label="Checking your session" />;
  }

  // Staff guard: signed in but not staff → 403.
  if (route.guard === "staff" && user && !isStaff(user)) {
    return (
      <>
        <SEOHead
          title={route.title}
          description={route.description}
          canonicalPath={path}
          noindex
        />
        <ForbiddenState
          description={`The ${
            route.title.replace(/\s*\|\s*MN\.KP.*$/i, "") || "admin"
          } console is reserved for MN.KP staff (editor/admin) accounts.`}
        />
      </>
    );
  }

  // Auth guard without a user: the one-shot redirect effect is in flight.
  if (route.guard && !user) {
    return <LoadingState variant="spinner" label="Redirecting to sign in" />;
  }

  const View = viewRegistry[route.key];
  if (!View) {
    // Registry entry missing (views land in waves 4-a → 6-a; orchestrator
    // wires them at Task 8). Spec: fall back to NotFoundState.
    return (
      <>
        <SEOHead
          title={route.title}
          description={route.description}
          canonicalPath={path}
          noindex={route.noindex}
        />
        <NotFoundState path={path} />
      </>
    );
  }

  return (
    <>
      {/* Route-default SEO — any view-rendered <SEOHead> mounts later and wins. */}
      <SEOHead
        title={route.title}
        description={route.description}
        canonicalPath={path}
        noindex={route.noindex}
      />
      <ViewErrorBoundary>
        <React.Suspense
          key={path}
          fallback={<LoadingState variant="skeleton" rows={5} label="Loading view" />}
        >
          <RouteParamsProvider params={match.params}>
            {/*
              NO wrapper element here. The previous `cv-auto` wrapper
              (content-visibility: auto → contain: paint) formed a CONTAINING
              BLOCK for position:fixed descendants, which silently broke every
              fixed-position reading/purchase UI inside views (reading
              progress bar, mobile action cluster, sticky buy bar — they all
              had to portal to document.body as a workaround). Rendering the
              view directly keeps fixed = viewport. Long-list scroll perf is
              handled per-section inside views where it is safe (legal index
              items still use cv-auto on non-fixed <li>s).

              The keyed transition div gives every route change the native-app
              "screen slides in" feel: detail pages push in from the right
              (.view-enter-push), everything else rises softly (.view-enter).
              A plain div with no transform/filter/contain is NOT a containing
              block — the animation transform only exists for ~300ms at mount
              when no fixed UI is visible yet, so fixed children stay safe.
            */}
            <div
              key={path}
              className={
                isDetailRoute(path) ? "view-enter-push" : "view-enter"
              }
            >
              <View />
            </div>
          </RouteParamsProvider>
        </React.Suspense>
      </ViewErrorBoundary>
    </>
  );
}
