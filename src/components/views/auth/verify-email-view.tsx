"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALink } from "@/components/router/link";
import { navigate, useRouter } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { SEOHead } from "@/components/shared/seo-head";
import { AUTH_THEMES, AuthShell, apiFetch } from "./_shared";

type VerifyStatus = "verifying" | "verified" | "invalid";

/**
 * #/auth/verify?token= (route key auth-verify) — auto-POSTs the email
 * verification token on mount and renders verifying / verified / invalid.
 * The session refetch afterwards so the header and banners pick up the
 * verified flag immediately.
 */
export default function VerifyEmailView() {
  const { query } = useRouter();
  const { user, refetch } = useSession();
  const [status, setStatus] = React.useState<VerifyStatus>("verifying");
  const [message, setMessage] = React.useState<string | null>(null);

  const token = query.get("token") ?? "";

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token || token.length < 10) {
        setStatus("invalid");
        setMessage("The verification link is missing its token.");
        return;
      }
      try {
        await apiFetch<{ verified: boolean }>("/api/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        setStatus("verified");
        await refetch();
      } catch (e) {
        if (cancelled) return;
        setStatus("invalid");
        setMessage(e instanceof Error ? e.message : "This verification link is invalid.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const t = AUTH_THEMES.graphite;
  const onboarded = user?.onboardingCompleted ?? false;

  return (
    <>
      <SEOHead
        title="Verify Email | MN.KP"
        description="Confirm your email address to activate your MN.KP account."
        canonicalPath="/auth/verify"
        noindex
      />
      <AuthShell
        theme="graphite"
        microLabel="Email Verification"
        title={status === "verified" ? "Email verified" : status === "invalid" ? "Link problem" : "Verifying…"}
        description={
          status === "verifying"
            ? "Checking your verification link — this only takes a moment."
            : undefined
        }
        footer={
          <p className="text-center text-xs text-stone-500">
            Stuck?{" "}
            <ALink href="/support" className="underline-offset-2 hover:underline">
              Contact support
            </ALink>{" "}
            ·{" "}
            <ALink href="/auth/login" className="underline-offset-2 hover:underline">
              Back to sign in
            </ALink>
          </p>
        }
      >
        {status === "verifying" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
            <Loader2 className="size-10 animate-spin text-gold" aria-hidden="true" />
            <p className={t.sub}>Confirming your token…</p>
          </div>
        ) : status === "verified" ? (
          <div className="text-center" role="status">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <BadgeCheck className="size-7 text-gold" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-gold">Done</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-100">Your email is verified</h2>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              Your MN.KP account is fully active. Receipts, recovery and important
              notices will now reach your inbox.
            </p>
            <div className="mt-7 space-y-3">
              {onboarded ? (
                <Button
                  asChild
                  className="h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90"
                >
                  <ALink href="/account">
                    Go to my account
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </ALink>
                </Button>
              ) : (
                <>
                  <Button
                    className="h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90"
                    onClick={() => navigate("/onboarding")}
                  >
                    Continue to onboarding
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    className={`h-11 w-full ${t.ghost}`}
                    onClick={() => navigate("/account")}
                  >
                    Skip — go to my account
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center" role="alert">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-red-400/40 bg-red-400/10">
              <AlertTriangle className="size-7 text-red-300" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-red-300">Invalid link</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-100">This verification link is invalid</h2>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              {message ??
                "The link may have expired or was already used. Verification links are single-use."}
            </p>
            <div className="mt-7 space-y-3">
              <Button
                asChild
                className="h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90"
              >
                <ALink href="/auth/login">Back to sign in</ALink>
              </Button>
              <Button variant="ghost" asChild className={`h-11 w-full ${t.ghost}`}>
                <ALink href="/support">Get help verifying your email</ALink>
              </Button>
            </div>
            <p className="mt-5 text-xs text-stone-500">
              Already signed in? You can keep using MN.KP and verify later from
              your account dashboard.
            </p>
          </div>
        )}
      </AuthShell>
    </>
  );
}
