"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatChip — compact "at a glance" chip (home hero): value in emerald,
 * label in muted micro type, optional icon. Extra-compact on mobile
 * (2x2 grid) via responsive prefixes.
 */

export interface StatChipProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  className?: string;
}

export function StatChip({ value, label, icon: Icon, className }: StatChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-xs sm:gap-3 sm:px-4 sm:py-3",
        className
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold sm:size-9"
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-base font-semibold leading-tight tabular-nums tracking-tight text-primary sm:text-lg">
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
