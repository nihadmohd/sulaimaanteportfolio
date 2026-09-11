"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { forgotPasswordSchema } from "@/lib/validation";
import { AUTH_THEMES, AuthShell, DemoCredentialsCard, apiFetch } from "./_shared";

type ForgotValues = { email: string };

interface ForgotReply {
  sent: boolean;
  devResetUrl?: string;
}

/**
 * #/auth/forgot-password (route key auth-forgot) — requests a reset link.
 * The API always answers {sent:true}; the demo devResetUrl (when present)
 * acts as the "email" so the flow is testable end-to-end.
 */
export default function ForgotPasswordView() {
  const [sent, setSent] = React.useState<ForgotReply | null>(null);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const submitDisabled = form.formState.isSubmitting;

  const onSubmit = async (values: ForgotValues) => {
    try {
      const data = await apiFetch<ForgotReply>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSent(data);
      toast({ title: "Reset link sent", description: "Check your inbox for the reset instructions." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not request a reset. Please try again.";
      toast({ title: "Request failed", description: message, variant: "destructive" });
    }
  };

  const t = AUTH_THEMES.emerald;

  return (
    <>
      <SEOHead
        title="Forgot Password | MN.KP"
        description="Request a password reset link for your MN.KP account."
        canonicalPath="/auth/forgot-password"
        noindex
      />
      <AuthShell
        theme="emerald"
        microLabel="Account Recovery"
        title="Forgot your password?"
        description="Enter the email on your account and we'll send a reset link. Links expire in one hour."
        footer={
          <p className="text-center text-xs text-emerald-100/60">
            Remembered it?{" "}
            <ALink href="#/auth/login" className="text-gold underline-offset-2 hover:underline">
              Back to sign in
            </ALink>
          </p>
        }
      >
        {sent ? (
          <div className="text-center" role="status" aria-live="polite">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
              <MailCheck className="size-7 text-emerald-300" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-gold">Sent</p>
            <h2 className="mt-2 text-xl font-semibold text-emerald-50">
              If an account exists, a reset link is on its way
            </h2>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mt-4 text-sm leading-relaxed text-emerald-100/70">
              For your security we can't confirm whether the address is registered —
              but if it is, the instructions are already in your inbox.
            </p>
            {sent.devResetUrl ? (
              <div className="mt-7 space-y-3">
                <Button
                  asChild
                  className="h-11 w-full gap-2 bg-emerald-500 font-medium text-emerald-950 hover:bg-emerald-400"
                >
                  <ALink href={sent.devResetUrl}>
                    <KeyRound className="size-4" aria-hidden="true" />
                    Open reset link (demo mode)
                  </ALink>
                </Button>
                <p className="text-xs text-emerald-100/60">
                  Demo mode: the email is mocked — this button stands in for the link.
                </p>
              </div>
            ) : null}
            <div className="mt-6">
              <Button variant="ghost" asChild className={`h-11 w-full ${t.ghost}`}>
                <ALink href="#/auth/login">
                  Back to sign in
                  <ArrowRight className="size-4" aria-hidden="true" />
                </ALink>
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={t.label}>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className={t.input}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-amber-300" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={submitDisabled}
                className={`w-full gap-2 font-medium ${t.submit}`}
              >
                {submitDisabled ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                {submitDisabled ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </Form>
        )}
      </AuthShell>
    </>
  );
}
