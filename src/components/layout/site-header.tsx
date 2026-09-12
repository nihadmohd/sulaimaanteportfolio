"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALink } from "@/components/router/link";
import { LiveVisitorBadge } from "@/components/shared/live-visitor-badge";
import { NotificationBell } from "@/components/shared/notification-bell";
import { navigate, useRouter } from "@/hooks/use-router";
import { isStaff, useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { useUiStore } from "@/stores/ui-store";
import { NAV_MAIN, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * SiteHeader — slim sticky top bar (h-14 mobile / h-16 desktop), backdrop
 * blur, gold-underlined active nav, live badge + bell + theme toggle + auth
 * area. Below lg the nav collapses to a hamburger sheet; the mobile tab bar
 * lives in MobileNav.
 */

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle light or dark theme"
      className="size-9"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4.5 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4.5 dark:block" aria-hidden="true" />
    </Button>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function AuthArea() {
  const { user, refetch } = useSession();
  const { toast } = useToast();

  if (!user) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <ALink href="#/auth/login">
          <Button
            variant="outline"
            size="sm"
            className="border-gold/50 text-gold hover:bg-gold/10 hover:text-gold"
          >
            Sign in
          </Button>
        </ALink>
        <ALink href="#/auth/register">
          <Button size="sm">Register</Button>
        </ALink>
      </div>
    );
  }

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* network hiccup — clear client state anyway */
    }
    await refetch();
    navigate("/");
    toast({ title: "Signed out", description: "See you soon on MN.KP." });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-gold/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.fullName} /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {initials(user.fullName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="min-w-0">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/account")} className="gap-2">
          <User className="size-4" aria-hidden="true" /> Account
        </DropdownMenuItem>
        {isStaff(user) ? (
          <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-2 text-gold">
            <Shield className="size-4" aria-hidden="true" /> Admin & Developer
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="gap-2">
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setAdminNavOpen = useUiStore((s) => s.setAdminNavOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const adminNavOpen = useUiStore((s) => s.adminNavOpen);
  const { path } = useRouter();

  // On Admin & Developer routes the hamburger must open the ADMIN nav sheet
  // (the public MobileNav sheet is not mounted there) — otherwise the button
  // would do nothing, which is exactly the mobile bug we are fixing.
  const onMenuClick = () => {
    if (path.startsWith("/admin")) {
      setAdminNavOpen(true);
    } else {
      setMobileNavOpen(true);
    }
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-6">
          {/* Brand */}
          <ALink
            href="#/"
            className="flex shrink-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${SITE.name} — home`}
          >
            <img src="/logo.svg" alt="" className="h-7 w-7 md:h-8 md:w-8" width={32} height={32} />
            <span className="text-base font-semibold tracking-tight md:text-lg">
              MN<span className="text-gold">.KP</span>
            </span>
          </ALink>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden lg:flex">
            <ul className="flex items-center gap-1">
              {NAV_MAIN.map((item) => (
                <li key={item.href}>
                  <ALink
                    href={item.href}
                    activeClassName="text-primary"
                    className="relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&[data-active=true]]:after:absolute [&[data-active=true]]:after:inset-x-3 [&[data-active=true]]:after:-bottom-[5px] [&[data-active=true]]:after:h-[2px] [&[data-active=true]]:after:rounded-full [&[data-active=true]]:after:bg-gold"
                  >
                    {item.label}
                  </ALink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <LiveVisitorBadge className="hidden sm:inline-flex" />

            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 text-muted-foreground md:flex"
              onClick={() => setCommandOpen(true)}
              aria-label="Open command menu (Ctrl or Command plus K)"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium xl:inline">
                ⌘K
              </kbd>
            </Button>

            <NotificationBell />
            <ThemeToggle />
            <AuthArea />

            <Button
              variant="ghost"
              size="icon"
              className="size-10 md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen || adminNavOpen}
              onClick={onMenuClick}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
