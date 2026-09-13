"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { navigate, useRouter } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { loginSchema } from "@/lib/validation";
import type { SafeUser } from "@/types";
import {
  AUTH_THEMES,
  AuthShell,
  PasswordInput,
  apiFetch,
  loginDestination,
  safeNextPath,
} from "./_shared";

type LoginValues = z.infer<typeof loginSchema>;

interface LoginReply {
  user: SafeUser;
}

/**
 * #/auth/login (route key auth-login) — graphite glass sign-in.
 * Reads ?expired=1 (session-expired banner) and ?next= (return path);
 * staff land in #/admin, fresh accounts in #/onboarding — never a loop.
 */
export default function LoginView() {
  const { query } = useRouter();
  const { refetch } = useSession();
  const expired = query.get("expired") === "1";
  const next = safeNextPath(query.get("next"));

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const submitDisabled = form.formState.isSubmitting;

  const onSubmit = async (values: LoginValues) => {
    try {
      const data = await apiFetch<LoginReply>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast({
        title: "Welcome back",
        description: `Signed in as ${data.user.fullName || data.user.email}.`,
      });
      await refetch();
      navigate(loginDestination(data.user, next));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      toast({ title: "Sign-in failed", description: message, variant: "destructive" });
    }
  };

  const t = AUTH_THEMES.graphite;

  return (
    <>
      <SEOHead
        title="Sign In | MN.KP"
        description="Sign in to your MN.KP account to manage inquiries, newsletters and content."
        canonicalPath="/auth/login"
        noindex
      />
      <AuthShell
        theme="graphite"
        microLabel="MN.KP Member Access"
        title="Sign in to continue"
        description={
          next
            ? "Sign in to pick up right where you left off."
            : "Your account, inquiries and saved work — one sign-in away."
        }
        footer={
          <p className="text-center text-xs text-stone-500">
            Protected by MN.KP · <ALink href="#/legal/privacy-policy" className="underline-offset-2 hover:underline">Privacy Policy</ALink>
          </p>
        }
      >
        {expired ? (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
            <p>Your session expired — sign in to continue.</p>
          </div>
        ) : null}

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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className={t.label}>Password</FormLabel>
                    <ALink
                      href="#/auth/forgot-password"
                      className="text-xs text-stone-400 underline-offset-2 hover:text-stone-200 hover:underline"
                    >
                      Forgot password?
                    </ALink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      theme="graphite"
                      autoComplete="current-password"
                      placeholder="Your password"
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
                <LogIn className="size-4" aria-hidden="true" />
              )}
              {submitDisabled ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>

        <div
          role="note"
          className="mt-6 rounded-xl border border-gold/25 bg-stone-900/60 px-4 py-3 text-center text-sm"
        >
          <p className="text-stone-300">
            Admin &amp; Developer?{" "}
            <ALink
              href="#/admin/login"
              className="font-medium text-gold underline-offset-2 hover:underline"
            >
              Use the Admin &amp; Developer login
            </ALink>
          </p>
        </div>

        <div className="mt-6 space-y-2 text-center text-sm">
          <p className={t.sub}>
            New to MN.KP?{" "}
            <ALink
              href="#/auth/register"
              className="font-medium text-gold underline-offset-2 hover:underline"
            >
              Create a free account
            </ALink>
          </p>
          <p className={t.sub}>
            Need a hand?{" "}
            <ALink
              href="#/support"
              className="font-medium text-stone-200 underline-offset-2 hover:underline"
            >
              Visit Support
            </ALink>
          </p>
        </div>
      </AuthShell>
    </>
  );
}
