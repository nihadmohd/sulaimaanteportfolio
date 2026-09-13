"use client";

import * as React from "react";
import { Wrench } from "lucide-react";
import { AppProviders } from "@/providers/app-providers";
import { RouterProvider } from "@/hooks/use-router";
import { AppRouter } from "@/components/router/app-router";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { CommandMenu } from "@/components/layout/command-menu";
import { MaintenanceState, OfflineState } from "@/components/states/http-states";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { SiteAnalytics } from "@/components/shared/site-analytics";
import {
  AdFooterBanner,
  AdHeaderBanner,
  AdMarqueeStrip,
  AdSticker,
} from "@/components/shared/ad-banner";
import { SiteStickers } from "@/components/shared/site-stickers";
import { maintenanceInfo, useSettings } from "@/hooks/use-settings";
import { useOnline } from "@/hooks/use-online";
import { isStaff, useSession } from "@/hooks/use-session";
import { useUiStore } from "@/stores/ui-store";

/**
 * AppShell — the root of the client application (rendered by src/app/page.tsx).
 *
 *   AppProviders › RouterProvider › [MaintenanceGate, OfflineBanner,
 *   flex-column(header / ad-header-banner / ad-marquee / main#main ›
 *   AppRouter / ad-footer-banner / footer), MobileNav, CommandMenu,
 *   AdSticker, SiteAnalytics, CookieConsent]
 *
 * The site-wide DB ad units (Task 9-e) null-render when ads are disabled
 * or no live ad exists, so the shell never shifts. SiteAnalytics (Task 13-e)
 * renders nothing — it injects GA4 / Plausible / Meta Pixel scripts from the
 * analytics settings group, gated on the visitor's cookie consent.
 *
 * The footer sticks to the bottom of short viewports via the flex column +
 * mt-auto semantics; long content pushes it down naturally.
 */

/** Full-page maintenance for guests; thin gold banner for staff. */
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const { user, isLoading } = useSession();
  const maintenance = maintenanceInfo(settings.data);

  if (maintenance.enabled && !isLoading && !isStaff(user)) {
    return (
      <MaintenanceState message={maintenance.message} estimated={maintenance.estimatedEnd} />
    );
  }

  return (
    <>
      {maintenance.enabled ? (
        <div
          role="status"
          className="flex w-full items-center justify-center gap-2 border-b border-gold/40 bg-gold/10 px-4 py-1.5 text-center text-xs font-medium text-gold"
        >
          <Wrench className="size-3.5" aria-hidden="true" />
          Maintenance mode is active — you are seeing the live site because you are staff.
        </div>
      ) : null}
      {children}
    </>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return <OfflineState variant="bar" />;
}

function CommandKeyListener() {
  const commandOpen = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, setCommandOpen]);

  return null;
}

function ShellInner() {
  return (
    <MaintenanceGate>
      <OfflineBanner />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <AdHeaderBanner />
        <AdMarqueeStrip />
        <main id="main" className="flex-1">
          <AppRouter />
        </main>
        <AdFooterBanner />
        <SiteFooter />
      </div>
      <MobileNav />
      <PullToRefresh />
      <CommandMenu />
      <CommandKeyListener />
      <AdSticker />
      <SiteStickers />
      <SiteAnalytics />
      <CookieConsent />
    </MaintenanceGate>
  );
}

export function AppShell() {
  return (
    <AppProviders>
      <RouterProvider>
        <ShellInner />
      </RouterProvider>
    </AppProviders>
  );
}
