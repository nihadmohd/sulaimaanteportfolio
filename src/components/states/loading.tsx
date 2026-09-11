"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * LoadingState — variant "skeleton" (structured skeleton block) or "spinner"
 * (centered emerald spinner). `rows` controls skeleton line count.
 */

export interface LoadingStateProps {
  variant?: "skeleton" | "spinner";
  /** Skeleton lines under the heading bar (skeleton variant only). */
  rows?: number;
  label?: string;
  className?: string;
}

export function LoadingState({
  variant = "skeleton",
  rows = 4,
  label = "Loading",
  className,
}: LoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}
      >
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  const safeRows = Math.max(1, Math.min(12, rows));
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("w-full space-y-4 py-6", className)}
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: safeRows }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-4", i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-11/12" : "w-4/5")}
          />
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}
