"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Loader2, ShieldAlert, Terminal } from "lucide-react";
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
  DemoCredentialsCard,
  PasswordInput,
  apiFetch,
  safeNextPath,
} from "./_shared";

type LoginValues = z.infer<typeof loginSchema>;

interface LoginReply {
  user: SafeUser;
}

/**
 * #/admin/login (route key admin-login) — obsidian + gold Admin &
 * Developer console sign-in. Same credentials API, but only editor/admin
 * roles may pass; everyone else gets an inline 403-style notice.
 */
export default function AdminLoginView() {
  const { query } = useRouter();
  const { refetch } = useSession();
  const next = safeNextPath(query.get("next"));
  const [forbidden, setForbidden] = React.useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const submitDisabled = form.formState.isSubmitting;

  const onSubmit = async (values: LoginValues) => {
    setForbidden(null);
    try {
      const data = await apiFetch<LoginReply>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      const role = data.user.role;
      if (role !== "editor" && role !== "admin") {
        setForbidden(data.user.email);
        toast({
          title: "Access restricted",
          description: "This console is for Admin & Developer accounts only.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Console unlocked",
        description: `Signed in as ${data.user.fullName || data.user.email}.`,
      });
      await refetch();
      navigate(next ?? "/admin");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      toast({ title: "Sign-in failed", description: message, variant: "destructive" });
    }
  };

  const t = AUTH_THEMES.obsidian;

  return (
    <>
      <SEOHead
        title="Admin Sign In | MN.KP"
        description="Sign in to the MN.KP Admin & Developer console."
        canonicalPath="/admin/login"
        noindex
      />
      <AuthShell
        theme="obsidian"
        crestClass="h-14 w-14"
        microLabel="Admin & Developer Console"
        title="Restricted access"
        description="Obsidian door, gold key. This console manages content, users, plans and platform settings."
        footer={
          <p className="text-center text-xs text-zinc-500">
            Not staff?{" "}
            <ALink href="#/auth/login" className="text-gold underline-offset-2 hover:underline">
              Use the member sign-in
            </ALink>
          </p>
        }
      >
        <div className="mb-6 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          <Terminal className="size-3.5 text-gold" aria-hidden="true" />
          MN.KP · Calicut · Staff only
        </div>

        {forbidden ? (
          <div
            role="alert"
            className="mb-5 flex flex-col gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-200"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-300" aria-hidden="true" />
              <div>
                <p className="font-medium">This console is for Admin &amp; Developer accounts only.</p>
                <p className="mt-1 text-red-200/80">
                  {forbidden} is signed in with a standard account. Use the member area instead,
                  or sign in with a staff account.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild className="h-10 border-red-400/40 bg-transparent text-red-200 hover:bg-red-500/10 hover:text-red-100">
                <ALink href="#/account">Go to my account</ALink>
              </Button>
              <Button variant="ghost" asChild className="h-10 text-zinc-400 hover:bg-white/10 hover:text-zinc-100">
                <ALink href="#/auth/login">Member sign-in</ALink>
              </Button>
            </div>
          </div>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={t.label}>Staff email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="admin@mnkp.dev"
                      className={t.input}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-amber-400" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={t.label}>Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      theme="obsidian"
                      autoComplete="current-password"
                      placeholder="Your password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-amber-400" />
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
              {submitDisabled ? "Unlocking…" : "Unlock console"}
            </Button>
          </form>
        </Form>

        <DemoCredentialsCard
          theme="obsidian"
          account="admin"
          note="The seeded Admin & Developer account — full console access."
        />
      </AuthShell>
    </>
  );
}
