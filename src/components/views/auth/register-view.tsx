"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BadgeCheck, Loader2, MailCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ALink } from "@/components/router/link";
import { navigate } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { registerSchema } from "@/lib/validation";
import type { SafeUser } from "@/types";
import { AUTH_THEMES, AuthShell, PasswordInput, apiFetch } from "./_shared";

const registerFormSchema = registerSchema.extend({
  terms: z.boolean().refine((v) => v === true, {
    message: "Please accept the Terms of Service to continue.",
  }),
});

type RegisterValues = z.infer<typeof registerFormSchema>;

interface RegisterReply {
  user: SafeUser;
  devVerifyUrl: string;
}

/** Cheap password strength hint — advisory only, no hard gate. */
function passwordStrength(pw: string): { label: string; bars: number; tone: string } {
  if (!pw) return { label: "", bars: 0, tone: "" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: "Weak — add length, mixed case or digits", bars: 1, tone: "bg-red-400" };
  if (score === 3) return { label: "Fair — a few more characters helps", bars: 2, tone: "bg-amber-400" };
  return { label: "Strong — nice work", bars: 3, tone: "bg-emerald-400" };
}

/**
 * #/auth/register (route key auth-register) — warm gold/amber account
 * creation. On success the session cookie is already set; the view shows
 * the mock "check your email" card with a demo verify-now shortcut.
 */
export default function RegisterView() {
  const { refetch } = useSession();
  const [registered, setRegistered] = React.useState<RegisterReply | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { fullName: "", email: "", password: "", terms: false },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const strength = passwordStrength(password ?? "");
  const submitDisabled = form.formState.isSubmitting;

  const onSubmit = async (values: RegisterValues) => {
    try {
      const data = await apiFetch<RegisterReply>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
        }),
      });
      toast({
        title: "Account created",
        description: "Welcome to MN.KP — one quick email check and you're set.",
      });
      await refetch();
      setRegistered(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Registration failed. Please try again.";
      toast({ title: "Could not create account", description: message, variant: "destructive" });
    }
  };

  const t = AUTH_THEMES.amber;

  return (
    <>
      <SEOHead
        title="Create Account | MN.KP"
        description="Create a free MN.KP account — newsletters, subscriptions and premium content."
        canonicalPath="/auth/register"
        noindex
      />
      <AuthShell
        theme="amber"
        microLabel="Join MN.KP — Free"
        title="Create your account"
        description="Free forever. Premium guides and deals when you want them."
        footer={
          <p className="text-center text-xs text-amber-100/60">
            Already registered?{" "}
            <ALink href="#/auth/login" className="text-gold underline-offset-2 hover:underline">
              Sign in instead
            </ALink>
          </p>
        }
      >
        {registered ? (
          <div className="text-center" role="status" aria-live="polite">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <MailCheck className="size-7 text-gold" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-gold">Check your email</p>
            <h2 className="mt-2 text-xl font-semibold text-amber-50">
              Verify {registered.user.email}
            </h2>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mt-4 text-sm leading-relaxed text-amber-100/70">
              We sent a verification link to your inbox. Verifying unlocks account recovery
              and important notices.
            </p>
            <div className="mt-7 space-y-3">
              <Button
                asChild
                className="h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90"
              >
                <ALink href={registered.devVerifyUrl}>
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Verify now (demo mode)
                </ALink>
              </Button>
              <Button
                variant="ghost"
                className={`h-11 w-full gap-2 ${t.ghost}`}
                onClick={() => navigate("/onboarding")}
              >
                Skip for now — continue to onboarding
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-5 text-xs text-amber-100/60">
              Tip: in this demo the email is mocked — the button above acts as the
              link from your inbox.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={t.label}>Full name</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder="e.g. Arjun Menon"
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
                    <FormLabel className={t.label}>Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        theme="amber"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        {...field}
                      />
                    </FormControl>
                    {strength.label ? (
                      <div className="flex items-center gap-2 pt-1" aria-live="polite">
                        <div className="flex gap-1" aria-hidden="true">
                          {[1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={`h-1 w-8 rounded-full ${i <= strength.bars ? strength.tone : "bg-white/15"}`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-amber-100/60">{strength.label}</p>
                      </div>
                    ) : null}
                    <FormMessage className="text-amber-300" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2.5">
                      <FormControl>
                        <Checkbox
                          id="register-terms"
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                          className="mt-0.5 size-5 border-amber-300/50 data-[state=checked]:border-gold data-[state=checked]:bg-gold data-[state=checked]:text-gold-foreground"
                        />
                      </FormControl>
                      <div className="text-sm leading-relaxed text-amber-100/80">
                        <label htmlFor="register-terms" className="cursor-pointer select-none">
                          I agree to the{" "}
                          <ALink
                            href="#/legal/terms-of-service"
                            className="font-medium text-gold underline-offset-2 hover:underline"
                          >
                            Terms of Service
                          </ALink>{" "}
                          and{" "}
                          <ALink
                            href="#/legal/privacy-policy"
                            className="font-medium text-gold underline-offset-2 hover:underline"
                          >
                            Privacy Policy
                          </ALink>
                          .
                        </label>
                      </div>
                    </div>
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
                  <UserPlus className="size-4" aria-hidden="true" />
                )}
                {submitDisabled ? "Creating account…" : "Create free account"}
              </Button>
            </form>
          </Form>
        )}

      </AuthShell>
    </>
  );
}
