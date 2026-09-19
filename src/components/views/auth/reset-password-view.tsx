"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ALink } from "@/components/router/link";
import { navigate, useRouter } from "@/hooks/use-router";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { AUTH_THEMES, AuthShell, PasswordInput, apiFetch } from "./_shared";

const resetFormSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long"),
    confirm: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type ResetValues = z.infer<typeof resetFormSchema>;

/**
 * #/auth/reset-password?token= (route key auth-reset) — choose a new
 * password with a single-use token. Success auto-navigates to sign-in
 * after two seconds with a toast.
 */
export default function ResetPasswordView() {
  const { query } = useRouter();
  const token = query.get("token") ?? "";
  const hasToken = token.length >= 10;
  const [done, setDone] = React.useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const submitDisabled = form.formState.isSubmitting;

  React.useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      toast({
        title: "Password updated",
        description: "Sign in with your new password to continue.",
      });
      navigate("/auth/login");
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [done]);

  const onSubmit = async (values: ResetValues) => {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: values.password }),
      });
      setDone(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not reset your password.";
      toast({ title: "Reset failed", description: message, variant: "destructive" });
    }
  };

  const t = AUTH_THEMES.graphite;

  return (
    <>
      <SEOHead
        title="Reset Password | MN.KP"
        description="Choose a new password for your MN.KP account."
        canonicalPath="/auth/reset-password"
        noindex
      />
      <AuthShell
        theme="graphite"
        microLabel="New Password"
        title={done ? "Password reset" : "Choose a new password"}
        description={
          hasToken && !done
            ? "Pick something you haven't used before — at least 8 characters."
            : undefined
        }
        footer={
          <p className="text-center text-xs text-stone-500">
            <ALink href="/auth/login" className="underline-offset-2 hover:underline">
              Back to sign in
            </ALink>{" "}
            ·{" "}
            <ALink href="/auth/forgot-password" className="underline-offset-2 hover:underline">
              Request a new link
            </ALink>
          </p>
        }
      >
        {!hasToken ? (
          <div className="text-center" role="alert">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-red-400/40 bg-red-400/10">
              <AlertTriangle className="size-7 text-red-300" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-red-300">Missing token</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-100">This reset link looks incomplete</h2>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              Reset links come from the "forgot password" flow and carry a token.
              Request a fresh link to continue.
            </p>
            <Button
              asChild
              className="mt-7 h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90"
            >
              <ALink href="/auth/forgot-password">Request a reset link</ALink>
            </Button>
          </div>
        ) : done ? (
          <div className="text-center" role="status" aria-live="polite">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <ShieldCheck className="size-7 text-gold" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-gold">Done</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-100">Your password has been updated</h2>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              Taking you to the sign-in page — use your new password there.
            </p>
            <div className="mt-7 flex items-center justify-center gap-2 text-sm text-stone-400">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Redirecting in a moment…
            </div>
            <Button
              variant="ghost"
              asChild
              className={`mt-4 h-11 w-full ${t.ghost}`}
            >
              <ALink href="/auth/login">
                Go to sign in now
                <ArrowRight className="size-4" aria-hidden="true" />
              </ALink>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={t.label}>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        theme="graphite"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-amber-300" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={t.label}>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        theme="graphite"
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
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
                  <ShieldCheck className="size-4" aria-hidden="true" />
                )}
                {submitDisabled ? "Updating…" : "Set new password"}
              </Button>
            </form>
          </Form>
        )}
      </AuthShell>
    </>
  );
}
