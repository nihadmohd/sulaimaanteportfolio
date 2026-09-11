"use client";

import * as React from "react";
import { Clock, ShieldAlert, Wrench, WifiOff, AlertTriangle, CheckCircle2, KeyRound, Compass, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALink } from "@/components/router/link";
import { StatePage } from "@/components/states/state-page";
import { useUiStore } from "@/stores/ui-store";
import { navigate } from "@/hooks/use-router";
import { cn } from "@/lib/utils";

/* ========================================================================== */
/* NotFoundState — 404                                                         */
/* ========================================================================== */

export interface NotFoundStateProps {
  /** The unmatched path, used in the description when provided. */
  path?: string;
  className?: string;
}

export function NotFoundState({ path, className }: NotFoundStateProps) {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  return (
    <StatePage
      icon={FileQuestion}
      tone="gold"
      microLabel="ERROR 404"
      title="This page wandered off the map"
      description={
        path
          ? `We could not find "${path}". It may have moved, or the link might be mistyped.`
          : "We could not find the page you were looking for. It may have moved, or the link might be mistyped."
      }
      className={className}
      actions={
        <>
          <Button onClick={() => setCommandOpen(true)} variant="outline" className="gap-2">
            <Compass className="size-4" aria-hidden="true" />
            Search the site
          </Button>
          <ALink href="#/" className="hover:text-primary">
            <Button variant="default">Back home</Button>
          </ALink>
          <ALink href="#/blog">
            <Button variant="ghost">Browse the blog</Button>
          </ALink>
          <ALink href="#/store">
            <Button variant="ghost">Visit the store</Button>
          </ALink>
        </>
      }
    />
  );
}

/* ========================================================================== */
/* ForbiddenState — 403                                                        */
/* ========================================================================== */

export interface ForbiddenStateProps {
  title?: string;
  description?: React.ReactNode;
  className?: string;
}

export function ForbiddenState({
  title = "Access restricted",
  description = "This area of MN.KP is reserved for team members with the right permissions.",
  className,
}: ForbiddenStateProps) {
  return (
    <StatePage
      icon={ShieldAlert}
      tone="red"
      microLabel="ERROR 403"
      title={title}
      description={description}
      className={className}
      actions={
        <>
          <ALink href="#/">
            <Button variant="default">Back home</Button>
          </ALink>
          <ALink href="#/auth/login">
            <Button variant="outline">Sign in with another account</Button>
          </ALink>
        </>
      }
    />
  );
}

/* ========================================================================== */
/* ServerErrorState — 500                                                      */
/* ========================================================================== */

export interface ServerErrorStateProps {
  onRetry?: () => void;
  className?: string;
}

export function ServerErrorState({ onRetry, className }: ServerErrorStateProps) {
  const retry = () => {
    if (onRetry) onRetry();
    else window.location.reload();
  };
  return (
    <StatePage
      icon={AlertTriangle}
      tone="red"
      microLabel="ERROR 500"
      title="Something broke on our side"
      description="An unexpected error occurred while rendering this view. Our logs are on it — you can retry now."
      className={className}
      actions={
        <Button onClick={retry} variant="default" className="gap-2">
          Try again
        </Button>
      }
    />
  );
}

/* ========================================================================== */
/* MaintenanceState                                                            */
/* ========================================================================== */

export interface MaintenanceStateProps {
  message?: string;
  estimated?: string | null;
  fullPage?: boolean;
  className?: string;
}

export function MaintenanceState({
  message,
  estimated,
  fullPage = true,
  className,
}: MaintenanceStateProps) {
  return (
    <StatePage
      icon={Wrench}
      tone="amber"
      fullPage={fullPage}
      microLabel="MAINTENANCE"
      title="MN.KP is being polished"
      description={
        message ??
        "We are performing scheduled upgrades. The platform will be back online shortly."
      }
      className={className}
      actions={
        estimated ? (
          <p className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold">
            Estimated back by {estimated}
          </p>
        ) : null
      }
    />
  );
}

/* ========================================================================== */
/* OfflineState — full page or thin bar                                        */
/* ========================================================================== */

export interface OfflineStateProps {
  variant?: "full" | "bar";
  className?: string;
}

export function OfflineState({ variant = "full", className }: OfflineStateProps) {
  if (variant === "bar") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex w-full items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400",
          className
        )}
      >
        <WifiOff className="size-3.5" aria-hidden="true" />
        You are offline — reconnecting automatically. Content may be cached.
      </div>
    );
  }
  return (
    <StatePage
      icon={WifiOff}
      tone="amber"
      microLabel="OFFLINE"
      title="You are offline"
      description="It looks like your internet connection dropped. Reconnect and this page will pick up right where it left off."
      className={className}
      actions={
        <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
          <WifiOff className="size-4" aria-hidden="true" />
          Retry connection
        </Button>
      }
    />
  );
}

/* ========================================================================== */
/* ErrorState — inline API/UX error with retry                                 */
/* ========================================================================== */

export interface ErrorStateProps {
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <StatePage
      icon={AlertTriangle}
      tone="red"
      microLabel="SOMETHING WENT WRONG"
      title="That did not work"
      description={message ?? "We hit an unexpected error. Please try again in a moment."}
      className={className}
      actions={
        onRetry ? (
          <Button onClick={() => onRetry()} variant="default">
            Try again
          </Button>
        ) : null
      }
    />
  );
}

/* ========================================================================== */
/* SuccessState — tasteful, confetti-free                                      */
/* ========================================================================== */

export interface SuccessStateProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SuccessState({ title, description, action, className }: SuccessStateProps) {
  return (
    <StatePage
      icon={CheckCircle2}
      tone="emerald"
      microLabel="DONE"
      title={title}
      description={description}
      className={className}
      actions={action}
    />
  );
}

/* ========================================================================== */
/* SessionExpiredState — shown when ?expired=1 (login route)                   */
/* ========================================================================== */

export interface SessionExpiredStateProps {
  /** Path to return to after signing in again. */
  next?: string;
  className?: string;
}

export function SessionExpiredState({ next, className }: SessionExpiredStateProps) {
  const signIn = () => {
    const target = next ? `/auth/login?expired=0&next=${encodeURIComponent(next)}` : "/auth/login?expired=0";
    navigate(target);
  };
  return (
    <StatePage
      icon={KeyRound}
      tone="gold"
      microLabel="SESSION EXPIRED"
      title="Please sign in again"
      description="For your security, your session ended after a period of inactivity. Sign in again and you will return right where you left off."
      className={className}
      actions={
        <>
          <Button onClick={signIn} variant="default" className="gap-2">
            Sign in again
          </Button>
          <ALink href="#/">
            <Button variant="ghost">Back home</Button>
          </ALink>
        </>
      }
    />
  );
}

/* ========================================================================== */
/* PaymentState — success | failed | pending                                   */
/* ========================================================================== */

export interface PaymentStateProps {
  status: "success" | "failed" | "pending";
  message?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function PaymentState({ status, message, onRetry, action, className }: PaymentStateProps) {
  if (status === "success") {
    return (
      <SuccessState
        title="Payment successful"
        description={message ?? "Your subscription is active. A receipt is on its way to your inbox."}
        action={action}
        className={className}
      />
    );
  }
  if (status === "pending") {
    return (
      <StatePage
        icon={Clock}
        tone="amber"
        microLabel="PAYMENT PENDING"
        title="Payment is processing"
        description={message ?? "Your payment is still being confirmed. This usually takes a few moments — refresh or check billing later."}
        className={className}
        actions={action}
      />
    );
  }
  return (
    <StatePage
      icon={AlertTriangle}
      tone="red"
      microLabel="PAYMENT FAILED"
      title="Payment could not be completed"
      description={message ?? "The transaction was declined or interrupted. No money was taken — you can retry with another method."}
      className={className}
      actions={
        <>
          {onRetry ? (
            <Button onClick={onRetry} variant="default">
              Retry payment
            </Button>
          ) : null}
          {action}
          <ALink href="#/support">
            <Button variant="ghost">Get help</Button>
          </ALink>
        </>
      }
    />
  );
}
