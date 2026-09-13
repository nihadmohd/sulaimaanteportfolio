"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePresence } from "@/hooks/use-presence";

/**
 * LiveVisitorBadge — realtime "N online" indicator (Task 7-a).
 *
 * Backed by usePresence() (socket.io first, REST fallback once reconnection
 * is exhausted). Renders nothing until the first datapoint arrives, so a
 * down presence service degrades to silence instead of a broken chip.
 *
 * Variants:
 * - "header" (default): compact pill for the site header.
 * - "hero": larger pill with a "LIVE NOW" micro-label for the home hero.
 *
 * The emerald pulse dot is pinned (not themed) so it stays emerald even when
 * a consumer overrides text/border colors via className (e.g. the gold hero).
 */

export interface LiveVisitorBadgeProps {
  className?: string;
  variant?: "header" | "hero";
}

export function LiveVisitorBadge({ className, variant = "header" }: LiveVisitorBadgeProps) {
  const { online } = usePresence();

  // Graceful degradation: no data yet (service down / first paint) — hide.
  if (online === null) return null;

  const isHero = variant === "hero";
  const count = `${online} online`;
  const dotClass = "bg-emerald-500 dark:bg-emerald-400";

  return (
    <span
      role="status"
      aria-label={`${online} visitors online now`}
      title="Live visitors on MN.KP right now"
      className={cn(
        "inline-flex items-center rounded-full border border-primary/25 bg-primary/5 font-medium tabular-nums text-primary",
        isHero ? "gap-2 px-4 py-2 text-sm" : "gap-1.5 px-2.5 py-1 text-xs",
        className
      )}
    >
      <span aria-hidden="true" className={cn("relative flex", isHero ? "size-2.5" : "size-2")}>
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            dotClass
          )}
        />
        <span className={cn("relative inline-flex size-full rounded-full", dotClass)} />
      </span>
      <Users className={isHero ? "size-4" : "size-3"} aria-hidden="true" />
      {isHero ? (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
            Live now
          </span>
          <span className="font-semibold">{count}</span>
        </>
      ) : (
        <span>{count}</span>
      )}
    </span>
  );
}
