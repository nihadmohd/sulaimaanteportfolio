"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SectionHeading — luxury section header: uppercase micro-label, tracking-tight
 * title, thin gold rule and optional description.
 */

export interface SectionHeadingProps {
  microLabel?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  id?: string;
  className?: string;
}

export function SectionHeading({
  microLabel,
  title,
  description,
  align = "left",
  id,
  className,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div
      id={id}
      className={cn("w-full", centered && "flex flex-col items-center text-center", className)}
    >
      {microLabel ? (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {microLabel}
        </p>
      ) : null}
      <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h2>
      <div
        aria-hidden="true"
        className={cn("gold-rule mt-4 w-24", centered && "gold-rule-center")}
      />
      {description ? (
        <p
          className={cn(
            "mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base",
            centered && "mx-auto"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
