"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ApiEnvelope } from "@/types";
import { cn } from "@/lib/utils";

/* ========================================================================== */
/* client fetch helper — envelope-aware, always relative                       */
/* ========================================================================== */

/**
 * Fetch an MN.KP API endpoint and unwrap the {ok,data} envelope.
 * Throws an Error carrying the server's message on any failure —
 * exactly what form catch blocks and toasts expect.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // fallthrough to generic error below
  }
  if (!json || !json.ok) {
    throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  }
  return json.data;
}

/* ========================================================================== */
/* auth themes — graphite+copper (user) · amber (register) · obsidian+gold (admin)     */
/* ========================================================================== */

export type AuthTheme = "graphite" | "amber" | "obsidian";

export interface AuthThemeTokens {
  /** Full-bleed page gradient. */
  page: string;
  /** Glass panel on the gradient. */
  panel: string;
  /** Panel body text. */
  text: string;
  /** Muted / secondary text on the panel. */
  sub: string;
  /** Themed <Input> classes. */
  input: string;
  /** Themed <label> classes. */
  label: string;
  /** Primary submit button. */
  submit: string;
  /** Secondary/ghost action on dark glass. */
  ghost: string;
  /** Micro-label color. */
  micro: string;
  /** Ring color for focus visibility on dark glass. */
  ring: string;
}

export const AUTH_THEMES: Record<AuthTheme, AuthThemeTokens> = {
  graphite: {
    page: "bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950",
    panel: "border-gold/20 bg-white/[0.05] backdrop-blur-xl shadow-2xl",
    text: "text-stone-100",
    sub: "text-stone-400",
    input:
      "h-11 border-stone-700/70 bg-stone-900/70 text-stone-100 placeholder:text-stone-500 focus-visible:ring-gold/40 dark:border-stone-700/70 dark:bg-stone-900/70",
    label: "text-stone-300",
    submit: "h-11 bg-gold text-gold-foreground hover:bg-gold/90",
    ghost: "text-stone-400 hover:bg-white/10 hover:text-stone-100",
    micro: "text-gold",
    ring: "focus-visible:ring-gold/40",
  },
  amber: {
    page: "bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950",
    panel: "border-gold/30 bg-white/[0.06] backdrop-blur-xl shadow-2xl",
    text: "text-amber-50",
    sub: "text-amber-100/70",
    input:
      "h-11 border-amber-800/60 bg-amber-950/60 text-amber-50 placeholder:text-amber-100/40 focus-visible:ring-amber-400/40 dark:border-amber-800/60 dark:bg-amber-950/60",
    label: "text-amber-100/80",
    submit: "h-11 bg-gold text-gold-foreground hover:bg-gold/90",
    ghost: "text-amber-100/80 hover:bg-white/10 hover:text-amber-50",
    micro: "text-gold",
    ring: "focus-visible:ring-amber-400/40",
  },
  obsidian: {
    page: "bg-gradient-to-b from-zinc-950 via-black to-zinc-950",
    panel: "border-gold/30 bg-white/[0.04] backdrop-blur-xl shadow-2xl",
    text: "text-zinc-100",
    sub: "text-zinc-400",
    input:
      "h-11 border-zinc-700/80 bg-zinc-900/70 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-gold/40 dark:border-zinc-700/80 dark:bg-zinc-900/70",
    label: "text-zinc-300",
    submit: "h-11 bg-gold text-gold-foreground hover:bg-gold/90",
    ghost: "text-zinc-400 hover:bg-white/10 hover:text-zinc-100",
    micro: "text-gold",
    ring: "focus-visible:ring-gold/40",
  },
};

/* ========================================================================== */
/* AuthShell — full-bleed gradient + centered glass card                       */
/* ========================================================================== */

export interface AuthShellProps {
  theme: AuthTheme;
  /** Uppercase micro-label above the title. */
  microLabel: string;
  title: string;
  description?: React.ReactNode;
  /** Crest height class (admin console uses a larger crest). */
  crestClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  theme,
  microLabel,
  title,
  description,
  crestClass = "h-12 w-12",
  children,
  footer,
}: AuthShellProps) {
  const t = AUTH_THEMES[theme];
  return (
    <section
      aria-labelledby="auth-panel-title"
      className={cn(
        "relative flex w-full items-center justify-center px-4 py-12 sm:px-6",
        "min-h-[calc(100vh-4rem)]",
        t.page
      )}
    >
      <div className="w-full max-w-md">
        <div className={cn("rounded-2xl border px-6 py-8 sm:px-8", t.panel)}>
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo.svg"
              alt="MN.KP monogram crest"
              className={crestClass}
              width={56}
              height={56}
            />
            <p className={cn("mt-4 text-xs font-medium uppercase tracking-[0.2em]", t.micro)}>
              {microLabel}
            </p>
            <h1 id="auth-panel-title" className={cn("mt-2 text-2xl font-semibold tracking-tight", t.text)}>
              {title}
            </h1>
            <div aria-hidden="true" className="gold-rule-center mt-4 w-24" />
            {description ? (
              <p className={cn("mt-4 text-sm leading-relaxed", t.sub)}>{description}</p>
            ) : null}
          </div>
          <div className="mt-8">{children}</div>
        </div>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </section>
  );
}

/* ========================================================================== */
/* PasswordInput — show/hide toggle, themed                                    */
/* ========================================================================== */

export interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  theme: AuthTheme;
}

export function PasswordInput({ theme, className, ...props }: PasswordInputProps) {
  const t = AUTH_THEMES[theme];
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", t.input, className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className={cn(
          "absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-md outline-none transition-colors",
          t.ghost
        )}
        tabIndex={0}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/* ========================================================================== */
/* helpers shared by 5-a views                                                 */
/* ========================================================================== */

/** Sanitize a ?next= path: only internal, single-slash routes pass. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.startsWith("/") ? raw : `/${raw}`;
  if (clean.startsWith("//") || clean.startsWith("/\\") || clean.includes("://")) return null;
  return clean;
}

/** Where a successful login should land, per the no-loop contract. */
export function loginDestination(user: {
  role: string;
  onboardingCompleted: boolean;
}, next: string | null): string {
  const staff = user.role === "editor" || user.role === "admin";
  if (staff) return next ?? "/admin";
  if (next) return next;
  return user.onboardingCompleted ? "/account" : "/onboarding";
}
