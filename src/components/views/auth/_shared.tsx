"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { toast } from "@/hooks/use-toast";
import { DEMO_CREDENTIALS } from "@/lib/constants";
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
/* auth themes — emerald (user) · amber (register) · obsidian+gold (admin)     */
/* ========================================================================== */

export type AuthTheme = "emerald" | "amber" | "obsidian";

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
  emerald: {
    page: "bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950",
    panel: "border-gold/25 bg-white/[0.06] backdrop-blur-xl shadow-2xl",
    text: "text-emerald-50",
    sub: "text-emerald-100/70",
    input:
      "h-11 border-emerald-800/60 bg-emerald-950/60 text-emerald-50 placeholder:text-emerald-100/40 focus-visible:ring-emerald-400/40 dark:border-emerald-800/60 dark:bg-emerald-950/60",
    label: "text-emerald-100/80",
    submit: "h-11 bg-emerald-500 text-emerald-950 hover:bg-emerald-400",
    ghost: "text-emerald-100/80 hover:bg-white/10 hover:text-emerald-50",
    micro: "text-gold",
    ring: "focus-visible:ring-emerald-400/40",
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
/* DemoCredentialsCard — copyable demo hints (BUILD CONTRACT §12)              */
/* ========================================================================== */

function CopyValue({ value, theme, label }: { value: string; theme: AuthTheme; label: string }) {
  const t = AUTH_THEMES[theme];
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Could not copy", description: `${label}: ${value}`, variant: "destructive" });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}: ${value}`}
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left font-mono text-xs outline-none transition-colors",
        t.ghost
      )}
    >
      <span className="break-all">{value}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
      )}
    </button>
  );
}

export interface DemoCredentialsCardProps {
  theme: AuthTheme;
  /** Which seeded account to surface. */
  account: "user" | "admin";
  /** Extra note under the credentials. */
  note?: React.ReactNode;
}

export function DemoCredentialsCard({ theme, account, note }: DemoCredentialsCardProps) {
  const t = AUTH_THEMES[theme];
  const cred =
    account === "admin" ? DEMO_CREDENTIALS.admin : DEMO_CREDENTIALS.user;
  return (
    <div
      className={cn(
        "mt-6 rounded-xl border border-dashed px-4 py-3",
        theme === "emerald" && "border-emerald-400/30 bg-emerald-950/40",
        theme === "amber" && "border-amber-400/30 bg-amber-950/40",
        theme === "obsidian" && "border-gold/30 bg-zinc-900/60"
      )}
    >
      <p className={cn("flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em]", t.sub)}>
        <Info className="size-3.5" aria-hidden="true" />
        Demo credentials — {cred.hint}
      </p>
      <div className="mt-2 grid gap-1">
        <CopyValue theme={theme} label="Email" value={cred.email} />
        <CopyValue theme={theme} label="Password" value={cred.password} />
      </div>
      {note ? <p className={cn("mt-2 text-xs leading-relaxed", t.sub)}>{note}</p> : null}
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
