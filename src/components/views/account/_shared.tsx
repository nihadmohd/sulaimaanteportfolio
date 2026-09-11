"use client";

import * as React from "react";
import { format } from "date-fns";
import type { SessionUser } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

/**
 * Shared helpers for the 5-a account views (dashboard / billing / settings).
 */

/**
 * The user object as /api/auth/* actually returns it: SafeUser with the
 * socials JSON column PARSED (use-session's SessionUser types socials as
 * the raw string — runtime payload is the parsed map; see worklog 5-a).
 */
export type ClientUser = Omit<SessionUser, "socials"> & {
  socials: Record<string, string>;
};

/**
 * Read the reserved onboarding keys from the parsed socials map.
 * Values are JSON-encoded string arrays ("[\"Web Development\"]") with a
 * comma-split fallback for hand-edited rows.
 */
export function parseChips(
  socials: Record<string, string> | string | null | undefined,
  key: "_interests" | "_goals"
): string[] {
  if (!socials || typeof socials !== "object") return [];
  const raw = socials[key];
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Serialize chips back into the socials-map string convention. */
export function chipsToString(values: string[]): string {
  return JSON.stringify(values);
}

/** Color-coded subscription status badge classes. */
export function subStatusBadge(status: string): string {
  switch (status) {
    case "active":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "trialing":
      return "border-gold/40 bg-gold/10 text-gold";
    case "past_due":
      return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
    case "canceled":
    case "expired":
      return "border-muted bg-muted text-muted-foreground";
    default:
      return "border-muted bg-muted text-muted-foreground";
  }
}

/** Human status label. */
export function subStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

/** "12 Sep 2026" style dates for period ends / history rows. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
}

/** Renewal copy for the subscription card. */
export function renewalNote(sub: {
  status: string;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: string;
  interval?: string;
  currentPeriodEnd?: string | null;
}): string {
  const interval = sub.billingInterval ?? sub.interval ?? "monthly";
  if (sub.cancelAtPeriodEnd) {
    return `Cancels on ${formatDate(sub.currentPeriodEnd)} — access stays until then.`;
  }
  if (sub.status === "past_due") {
    return `Payment issue — renew by ${formatDate(sub.currentPeriodEnd)} to keep access.`;
  }
  return `Renews ${interval === "yearly" ? "yearly" : "monthly"} on ${formatDate(sub.currentPeriodEnd)}.`;
}

/** RHF-friendly object-is-empty check for chips saves. */
export function chipsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Tiny container for "Email / WhatsApp" contact rows used on the dashboard. */
export function ContactRow({
  icon,
  label,
  href,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  value: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm transition-colors",
        "hover:border-gold/50 hover:bg-muted/60"
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-medium">{value}</span>
      </span>
    </a>
  );
}
