"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEOHead } from "@/components/shared/seo-head";
import { ALink } from "@/components/router/link";
import { navigate } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/components/views/auth/_shared";
import { cn } from "@/lib/utils";

/**
 * SetupView — first-run "claim your website" flow (#/setup).
 *
 * Shown only while the platform has no owner account. Creates the first
 * admin, auto-signs-in and lands straight in the Admin & Developer console.
 * The endpoint self-disables the moment an owner exists.
 */

const setupSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

type SetupForm = z.infer<typeof setupSchema>;

function passwordStrength(pw: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const tones = [
    "bg-muted",
    "bg-red-500/70",
    "bg-amber-500/70",
    "bg-amber-400/80",
    "bg-emerald-500/70",
    "bg-emerald-400",
  ];
  return { score, label: labels[score], tone: tones[score] };
}

export function SetupView() {
  const { refetch } = useSession();
  const [showPassword, setShowPassword] = React.useState(false);

  const status = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => apiFetch<{ needsSetup: boolean }>("/api/auth/setup"),
    staleTime: 15_000,
  });

  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });
  const password = form.watch("password");
  const strength = passwordStrength(password);

  const submit = useMutation({
    mutationFn: async (values: SetupForm) => {
      return apiFetch<{ user: { fullName: string } }>("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify(values),
      });
    },
    onSuccess: async (data) => {
      toast({
        title: "Welcome aboard",
        description: `Your website is ready, ${data.user.fullName.split(" ")[0]}. Taking you to the console…`,
      });
      await refetch();
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const alreadyClaimed = status.isSuccess && !status.data.needsSetup;

  return (
    <>
      <SEOHead
        title="Set Up Your Website | MN.KP"
        description="First-run setup — create the owner account for this MN.KP website."
        canonicalPath="/setup"
        noindex
      />
      <section
        aria-labelledby="setup-title"
        className="relative flex w-full items-center justify-center bg-gradient-to-b from-zinc-950 via-black to-zinc-950 px-4 py-12 sm:px-6 min-h-[calc(100vh-4rem)]"
      >
        {/* subtle gold glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_65%)]"
        />
        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-gold/30 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center text-center">
              <img
                src="/logo.svg"
                alt="MN.KP monogram crest"
                className="h-14 w-14"
                width={56}
                height={56}
              />
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-gold">
                First run
              </p>
              <h1
                id="setup-title"
                className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100"
              >
                Claim your website
              </h1>
              <div aria-hidden="true" className="gold-rule-center mt-4 w-24" />
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                This MN.KP website is brand new. Create the owner account below —
                it unlocks the full Admin &amp; Developer console with every tool.
              </p>
            </div>

            {alreadyClaimed ? (
              <div
                role="status"
                className="mt-8 rounded-xl border border-gold/30 bg-zinc-900/60 px-4 py-6 text-center"
              >
                <ShieldCheck className="mx-auto size-8 text-gold" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-zinc-100">
                  This website already has an owner
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  The setup window closed the moment the first owner was created.
                </p>
                <ALink href="/admin/login">
                  <Button className="mt-5 h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90">
                    <KeyRound className="size-4" aria-hidden="true" />
                    Sign in to the console
                  </Button>
                </ALink>
              </div>
            ) : (
              <form
                className="mt-8 space-y-4"
                onSubmit={form.handleSubmit((values) => submit.mutate(values))}
                noValidate
              >
                <div className="space-y-2">
                  <label
                    htmlFor="setup-name"
                    className="text-sm font-medium text-zinc-300"
                  >
                    Your full name
                  </label>
                  <div className="relative">
                    <UserRound
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                      aria-hidden="true"
                    />
                    <Input
                      id="setup-name"
                      autoComplete="name"
                      placeholder="e.g. Mohammed Nihad KP"
                      className="h-11 border-zinc-700/80 bg-zinc-900/70 pl-10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-gold/40"
                      {...form.register("fullName")}
                    />
                  </div>
                  {form.formState.errors.fullName ? (
                    <p role="alert" className="text-xs text-red-400">
                      {form.formState.errors.fullName.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="setup-email"
                    className="text-sm font-medium text-zinc-300"
                  >
                    Owner email
                  </label>
                  <Input
                    id="setup-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    className="h-11 border-zinc-700/80 bg-zinc-900/70 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-gold/40"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email ? (
                    <p role="alert" className="text-xs text-red-400">
                      {form.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="setup-password"
                    className="text-sm font-medium text-zinc-300"
                  >
                    Choose a password
                  </label>
                  <div className="relative">
                    <Input
                      id="setup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters, with a number"
                      className="h-11 border-zinc-700/80 bg-zinc-900/70 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-gold/40"
                      {...form.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-md text-zinc-400 outline-none transition-colors hover:bg-white/10 hover:text-zinc-100"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {password ? (
                    <div className="flex items-center gap-2" aria-live="polite">
                      <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-full flex-1 rounded-full transition-colors",
                              i < strength.score ? strength.tone : "bg-zinc-800"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-zinc-400">{strength.label}</p>
                    </div>
                  ) : null}
                  {form.formState.errors.password ? (
                    <p role="alert" className="text-xs text-red-400">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  disabled={submit.isPending || status.isLoading}
                  className="h-11 w-full gap-2 bg-gold font-medium text-gold-foreground hover:bg-gold/90"
                >
                  {submit.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-4" aria-hidden="true" />
                  )}
                  {submit.isPending ? "Creating your console…" : "Create owner account"}
                </Button>

                <ul className="space-y-1.5 pt-1">
                  {[
                    "Full Admin & Developer access from the first sign-in",
                    "You can change every detail later in Settings",
                    "This page disappears once the owner exists",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-xs leading-relaxed text-zinc-400"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
              </form>
            )}
          </div>

          {!alreadyClaimed ? (
            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
              <ShieldCheck className="size-3.5 text-gold/70" aria-hidden="true" />
              One owner per website — the link self-locks after setup.
              <ALink
                href="/"
                className="ml-1 inline-flex items-center gap-1 font-medium text-gold underline-offset-2 hover:underline"
              >
                Back to site
                <ArrowRight className="size-3" aria-hidden="true" />
              </ALink>
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}

export default SetupView;
