"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, MoreHorizontal, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ALink } from "@/components/router/link";
import { Icon } from "@/components/shared/lucide-icon";
import { useSession } from "@/hooks/use-session";
import { useRouter } from "@/hooks/use-router";
import { useUiStore } from "@/stores/ui-store";
import { MOBILE_TABS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * MobileNav — fixed bottom tab bar (Home / Blog / Store / Services + More)
 * with 56px touch targets and safe-area padding, plus the "More" bottom
 * sheet carrying the full navigation. Hidden on /admin and /auth routes
 * (those flows keep the full viewport).
 */

const MORE_LINKS = [
  { label: "About", href: "#/about", icon: "user" },
  { label: "Contact", href: "#/contact", icon: "mail" },
  { label: "Support & Help", href: "#/support", icon: "sparkles" },
  { label: "Legal & Policies", href: "#/legal", icon: "newspaper" },
];

function MoreSheetThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      className="h-11 w-full justify-start gap-3"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
      {resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    </Button>
  );
}

export function MobileNav() {
  const { path } = useRouter();
  const { user } = useSession();
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();

  // Close the "More" sheet whenever the route changes.
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [path, setMobileNavOpen]);

  // Hide the tab bar inside admin/auth flows.
  if (path.startsWith("/admin") || path.startsWith("/auth")) return null;

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/20 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {MOBILE_TABS.map((tab) => {
            const active = tab.href === "#/" ? path === "/" : path.startsWith(`${tab.href.replace("#", "")}/`) || path === tab.href.replace("#", "");
            return (
              <li key={tab.href} className="flex-1">
                <ALink
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-gold"
                    />
                  ) : null}
                  <Icon name={tab.icon} className={cn("size-5", active && "text-gold")} />
                  {tab.label}
                </ALink>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-label="More navigation"
              aria-controls="mobile-nav-sheet"
              onClick={() => setMobileNavOpen(true)}
              className="relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
        <div className="h-[env(safe-area-inset-bottom)]" aria-hidden="true" />
      </nav>

      {/* More sheet — full navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          id="mobile-nav-sheet"
          side="bottom"
          className="mx-auto max-h-[80vh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] scrollbar-slim"
        >
          <SheetHeader className="pb-0 text-left">
            <SheetTitle className="text-base">
              MN<span className="text-gold">.KP</span> — menu
            </SheetTitle>
            <SheetDescription className="sr-only">
              Full site navigation, account links and theme control
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-1">
            <p className="px-1 pb-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Explore
            </p>
            {MORE_LINKS.map((link) => (
              <ALink
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon name={link.icon} className="size-4 text-gold" />
                {link.label}
              </ALink>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-1">
            <p className="px-1 pb-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {user ? "Your account" : "Join MN.KP"}
            </p>
            {user ? (
              <>
                <ALink
                  href="#/account"
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon name="user" className="size-4 text-gold" /> Account
                </ALink>
                <ALink
                  href="#/account/billing"
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon name="sparkles" className="size-4 text-gold" /> Billing & subscription
                </ALink>
              </>
            ) : (
              <div className="flex gap-2 px-1 pt-1">
                <ALink href="#/auth/login" className="flex-1">
                  <Button variant="outline" className="w-full border-gold/50 text-gold hover:bg-gold/10 hover:text-gold">
                    Sign in
                  </Button>
                </ALink>
                <ALink href="#/auth/register" className="flex-1">
                  <Button className="w-full">Register</Button>
                </ALink>
              </div>
            )}
          </div>

          <Separator className="my-4" />
          <MoreSheetThemeToggle />
        </SheetContent>
      </Sheet>
    </>
  );
}
