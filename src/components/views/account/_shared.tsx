"use client";

import * as React from "react";
import { format } from "date-fns";
import type { SessionUser } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

/**
 * Shared helpers for the account views (dashboard / settings).
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

/** "12 Sep 2026" style dates for member rows. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
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
