"use client";

import * as React from "react";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CreditCard,
  Mail,
  MessageCircle,
  Newspaper,
  Settings,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ALink } from "@/components/router/link";
import { useSession } from "@/hooks/use-session";
import { SEOHead } from "@/components/shared/seo-head";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SITE } from "@/lib/constants";
import { apiFetch } from "@/components/views/auth/_shared";
import {
  ContactRow,
  renewalNote,
  subStatusBadge,
  subStatusLabel,
  formatDate,
  type ClientUser,
} from "./_shared";
import type { PlanDTO } from "@/types";

/** The /api/auth/me subscription payload (full DTO + planCode/interval aliases). */
interface DashboardSubscription {
  id: string;
  planCode: string;
  status: string;
  interval: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: string;
  plan?: PlanDTO;
}

const ROLE_LABELS: Record<string, string> = {
  reader: "Reader",
  author: "Author",
  editor: "Editor",
  admin: "Admin & Developer",
};

const QUICK_LINKS = [
  {
    href: "#/blog",
    icon: Newspaper,
    title: "Blog",
    blurb: "AI workflows, freelancing and growth notes.",
  },
  {
    href: "#/store",
    icon: ShoppingBag,
    title: "Affiliate Store",
    blurb: "Honestly reviewed tech and creator gear.",
  },
  {
    href: "#/support",
    icon: MessageCircle,
    title: "Support",
    blurb: "FAQs plus fast ways to reach the team.",
  },
  {
    href: "#/account/settings",
    icon: Settings,
    title: "Settings",
    blurb: "Profile, interests and privacy controls.",
  },
];

/**
 * #/account (route key account, guard auth) — the member dashboard:
 * greeting, verify banner, profile + subscription cards, quick links.
 */
export default function DashboardView() {
  const { user: rawUser, subscription: rawSub } = useSession();
  const user = rawUser as ClientUser | null;
  const sub = rawSub as DashboardSubscription | null;

  const [verifyUrl, setVerifyUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user || user.emailVerified) return;
    let cancelled = false;
    apiFetch<{ devVerifyUrl?: string }>("/api/auth/me")
      .then((data) => {
        if (!cancelled && data.devVerifyUrl) setVerifyUrl(data.devVerifyUrl);
      })
      .catch(() => {
        // banner simply hides the direct verify button
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null; // guard guarantees a session

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      <SEOHead
        title="My Account | MN.KP"
        description="Your MN.KP profile, activity and subscription overview."
        canonicalPath="/account"
        noindex
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Account" }]} />

        {/* greeting */}
        <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border border-gold/30">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.fullName || "Account avatar"} />
              ) : null}
              <AvatarFallback className="bg-gold/10 text-lg font-semibold text-gold">
                {initials || "MN"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                My Account
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                Hello, {user.fullName?.split(" ")[0] || "there"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Member since {formatDate(user.createdAt)}
                </span>
                {user.emailVerified ? (
                  <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    Verified
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <Button asChild variant="outline" className="h-11 gap-2">
            <ALink href="#/account/settings">
              <Settings className="size-4" aria-hidden="true" />
              Edit profile
            </ALink>
          </Button>
        </header>

        {/* unverified banner */}
        {!user.emailVerified ? (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3 text-sm text-amber-700 dark:text-amber-400">
              <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-medium">Your email isn't verified yet.</span>{" "}
                Verify {user.email} to secure recovery and receive billing receipts.
              </p>
            </div>
            {verifyUrl ? (
              <Button
                asChild
                size="sm"
                className="h-10 gap-1.5 border border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
              >
                <ALink href={verifyUrl}>Verify now (demo mode)</ALink>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="h-10">
                <ALink href="#/support">Need help? Contact support</ALink>
              </Button>
            )}
          </div>
        ) : null}

        {/* grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* profile card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-gold" aria-hidden="true" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{user.fullName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="truncate font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Headline</p>
                <p className="font-medium">{user.headline || "No headline yet"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{user.location || "—"}</p>
              </div>
              {user.websiteUrl ? (
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <a
                    href={user.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {user.websiteUrl}
                  </a>
                </div>
              ) : null}
              <Button asChild variant="outline" className="mt-2 h-11 w-full gap-2">
                <ALink href="#/account/settings">
                  Edit profile
                  <ArrowRight className="size-4" aria-hidden="true" />
                </ALink>
              </Button>
            </CardContent>
          </Card>

          {/* subscription card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4 text-gold" aria-hidden="true" />
                  Subscription
                </span>
                {sub ? (
                  <Badge variant="outline" className={subStatusBadge(sub.status)}>
                    {subStatusLabel(sub.status)}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sub ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-lg font-semibold">{sub.plan?.name ?? sub.planCode}</p>
                    <span className="text-sm text-muted-foreground">
                      {sub.interval ?? sub.billingInterval} billing
                    </span>
                  </div>
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-xs text-muted-foreground">Current period ends</dt>
                      <dd className="font-medium">{formatDate(sub.currentPeriodEnd)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-xs text-muted-foreground">Payment method</dt>
                      <dd className="font-medium">Visa ·· 4242 (demo)</dd>
                    </div>
                  </dl>
                  <p className="rounded-lg border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                    {renewalNote(sub)}
                  </p>
                  <Button asChild className="h-11 w-full gap-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    <ALink href="#/account/billing">
                      Manage billing
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </ALink>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You're on the Free Reader plan — every published post and store
                    listing, no card needed.
                  </p>
                  <Button asChild className="h-11 w-full gap-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    <ALink href="#/account/billing">
                      Explore plans
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </ALink>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* quick links */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_LINKS.map((link) => (
                <ALink
                  key={link.href}
                  href={link.href}
                  className="group flex min-h-11 flex-col gap-2 rounded-xl border bg-muted/30 p-4 transition-all hover:border-gold/50 hover:bg-muted/60 hover:shadow-sm"
                >
                  <span className="flex size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                    <link.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    {link.title}
                    <ArrowRight
                      className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{link.blurb}</span>
                </ALink>
              ))}
            </CardContent>
          </Card>

          {/* contact rows */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Reach MN.KP</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ContactRow
                icon={<Mail className="size-4" aria-hidden="true" />}
                label="Email"
                href={`mailto:${SITE.email}`}
                value={SITE.email}
              />
              <ContactRow
                icon={<MessageCircle className="size-4" aria-hidden="true" />}
                label="WhatsApp"
                href={SITE.whatsappUrl}
                value="+91 98467 50898"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
