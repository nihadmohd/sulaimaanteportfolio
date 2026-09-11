"use client";

import * as React from "react";
import {
  CreditCard,
  ExternalLink,
  FileText,
  FolderTree,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  PanelLeft,
  Settings,
  ShoppingBag,
  Terminal,
  TrendingUp,
  Upload,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ALink } from "@/components/router/link";
import { isPathActive } from "@/hooks/use-router";
import { useRouter } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch, RoleBadge } from "./_shared";

/**
 * AdminShell — shared chrome for every Admin & Developer view (Task 6-a).
 *
 * Desktop: fixed left sidebar (w-64) under the site header, grouped nav
 * with micro-labels, active item = gold left border + primary text,
 * admin identity card + View site + Sign out at the bottom.
 * Mobile: slim sticky top bar with a Sheet menu carrying the same nav.
 * Content: p-4 md:p-6 lg:p-8, max-w-7xl.
 */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "CONTENT",
    items: [
      { label: "Posts", href: "/admin/posts", icon: FileText },
      { label: "Categories", href: "/admin/categories", icon: FolderTree },
    ],
  },
  {
    label: "COMMERCE",
    items: [
      { label: "Products", href: "/admin/products", icon: ShoppingBag },
      { label: "Plans", href: "/admin/plans", icon: CreditCard },
    ],
  },
  {
    label: "INBOX",
    items: [
      { label: "Inquiries", href: "/admin/inquiries", icon: Inbox },
      { label: "Subscribers", href: "/admin/subscribers", icon: Users },
    ],
  },
  {
    label: "PEOPLE",
    items: [{ label: "Users", href: "/admin/users", icon: UserCog }],
  },
  {
    label: "GROWTH",
    items: [
      { label: "Ad Manager", href: "/admin/ads", icon: Megaphone },
      { label: "Marketing", href: "/admin/marketing", icon: TrendingUp },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Activity & Undo", href: "/admin/activity", icon: History },
      { label: "Import", href: "/admin/import", icon: Upload },
    ],
  },
];

export interface AdminShellProps {
  title: string;
  description?: string;
  /** Action buttons rendered at the right of the page header. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";
}

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const { path } = useRouter();
  const { user, refetch } = useSession();

  const signOut = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* proceed to local sign-out regardless */
    }
    await refetch();
    toast({ title: "Signed out", description: "You have left the Admin & Developer console." });
    window.location.hash = "#/";
  };

  const navList = (
    <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 scrollbar-slim">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isPathActive(item.href, path, item.exact ?? false);
              return (
                <li key={item.href}>
                  <ALink
                    href={`#${item.href}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm outline-none transition-colors",
                      active
                        ? "border-gold bg-primary/10 font-medium text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </ALink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const adminCard = (
    <div className="mt-auto border-t p-3">
      <div className="flex items-center gap-3 rounded-lg p-2">
        <Avatar className="size-9 border">
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.fullName || "Admin"} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(user?.fullName ?? "A")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {user?.fullName || "Admin"}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {user ? <RoleBadge role={user.role} /> : null}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ALink href="#/" className="flex-1">
          <Button variant="outline" size="sm" className="h-9 w-full gap-2">
            <ExternalLink className="size-3.5" aria-hidden="true" />
            View site
          </Button>
        </ALink>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="h-9 gap-2 text-muted-foreground hover:text-destructive"
          aria-label="Sign out"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {/* Desktop sidebar (fixed, below the sticky site header) */}
      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          { }
          <img
            src="/logo.svg"
            alt="MN.KP crest"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg border border-gold/40"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-gold">
              Admin &amp; Developer
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              MN.KP Console
            </p>
          </div>
          <Terminal className="ml-auto size-4 shrink-0 text-gold/80" aria-hidden="true" />
        </div>
        <Separator />
        {navList}
        {adminCard}
      </aside>

      {/* Mobile slim top bar + Sheet menu */}
      <div className="sticky top-16 z-30 flex h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="size-9" aria-label="Open admin menu">
              <PanelLeft className="size-4" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-sm">
                { }
                <img
                  src="/logo.svg"
                  alt="MN.KP crest"
                  width={20}
                  height={20}
                  className="size-5 shrink-0 rounded border border-gold/40"
                />
                <span className="text-gold">Admin &amp; Developer</span>
                <Terminal className="ml-auto size-4 shrink-0 text-gold/80" aria-hidden="true" />
              </SheetTitle>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                MN.KP Console
              </p>
            </SheetHeader>
            <SheetClose asChild>
              <div className="flex h-[calc(100%-8rem)] flex-col">{navList}</div>
            </SheetClose>
            <div className="border-t">{adminCard}</div>
          </SheetContent>
        </Sheet>
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          <Mail className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
          {title}
        </p>
        <Badge variant="outline" className="ml-auto shrink-0 border-gold/40 text-gold">
          Staff
        </Badge>
      </div>

      {/* Content column */}
      <div className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                Admin &amp; Developer
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
