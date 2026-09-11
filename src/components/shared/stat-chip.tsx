"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatChip — compact "at a glance" chip (home hero): value in emerald,
 * label in muted micro type, optional icon.
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
        "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-xs",
        className
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold"
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight tabular-nums tracking-tight text-primary">
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
