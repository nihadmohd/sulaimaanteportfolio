"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatePage — the shared luxury base for every UX state (404, 403, 500,
 * maintenance, offline, empty, error, success...). Gold micro-label,
 * icon medallion, gold rule, calm copy and optional action row.
 */

export type StateTone = "neutral" | "gold" | "emerald" | "amber" | "red";

export interface StatePageProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: StateTone;
  /** Full-page centers vertically in a tall container (e.g. maintenance). */
  fullPage?: boolean;
  /** Uppercase micro label above the title, e.g. "ERROR 404". */
  microLabel?: string;
  className?: string;
}

const toneStyles: Record<StateTone, { medallion: string; icon: string; micro: string }> = {
  neutral: {
    medallion: "border-border bg-muted text-muted-foreground",
    icon: "text-muted-foreground",
    micro: "text-muted-foreground",
  },
  gold: {
    medallion: "border-gold/40 bg-gold/10 text-gold",
    icon: "text-gold",
    micro: "text-gold",
  },
  emerald: {
    medallion: "border-primary/30 bg-primary/10 text-primary",
    icon: "text-primary",
    micro: "text-primary",
  },
  amber: {
    medallion: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    micro: "text-amber-600 dark:text-amber-400",
  },
  red: {
    medallion: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: "text-destructive",
    micro: "text-destructive",
  },
};

export function StatePage({
  icon: Icon,
  title,
  description,
  actions,
  tone = "neutral",
  fullPage = false,
  microLabel,
  className,
}: StatePageProps) {
  const tone_ = toneStyles[tone];
  return (
    <div
      role="status"
      className={cn(
        "flex w-full flex-col items-center justify-center px-6 py-14 text-center",
        fullPage && "min-h-[70vh] py-20",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex size-16 items-center justify-center rounded-full border",
          tone_.medallion
        )}
      >
        <Icon className="size-7" strokeWidth={1.75} />
      </div>

      {microLabel ? (
        <p className={cn("mt-6 text-xs font-medium uppercase tracking-[0.2em]", tone_.micro)}>
          {microLabel}
        </p>
      ) : null}

      <h2 className="mt-3 max-w-md text-balance text-xl font-semibold tracking-tight md:text-2xl">
        {title}
      </h2>

      <div aria-hidden="true" className="gold-rule mt-4 w-24" />

      {description ? (
        <p className="mt-4 max-w-md text-balance text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}

      {actions ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
