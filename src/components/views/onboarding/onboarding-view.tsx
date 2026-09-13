"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ALink } from "@/components/router/link";
import { navigate } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/components/views/auth/_shared";
import { parseChips } from "@/components/views/account/_shared";
import type { SafeUser } from "@/types";

/* ------------------------------------------------------------------ */
/* wizard catalogue                                                    */
/* ------------------------------------------------------------------ */

const INTEREST_OPTIONS = [
  "Web Development",
  "AI Tools",
  "Photography",
  "Videography",
  "Marketing",
  "Business",
  "Scholarships",
  "Travel",
  "Tech News",
  "Deals",
];

const GOAL_OPTIONS = [
  "Start a project",
  "Learn AI",
  "Grow my business",
  "Follow the blog",
  "Find deals",
  "Hire me",
];

const STEP_META = [
  { n: 1, title: "Welcome & name" },
  { n: 2, title: "Profile" },
  { n: 3, title: "Interests" },
  { n: 4, title: "Goals" },
] as const;

interface OnboardingPayload {
  user: SafeUser;
}

/* ------------------------------------------------------------------ */
/* chip selector                                                       */
/* ------------------------------------------------------------------ */

function ChipSelector({
  options,
  selected,
  onToggle,
  ariaLabel,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option)}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
              active
                ? "border-gold bg-gold/15 text-gold shadow-[0_0_0_1px_var(--gold)]"
                : "border-border bg-muted/40 text-muted-foreground hover:border-gold/50 hover:text-foreground"
            )}
          >
            {active ? <Check className="mr-1.5 inline size-3.5" aria-hidden="true" /> : null}
            {option}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

/**
 * #/onboarding (route key onboarding, guard auth) — the 4-step account
 * setup wizard. Every step POSTs {step, data} to /api/auth/onboarding;
 * step 4 flips onboardingCompleted and lands on the gold-check done screen.
 */
export default function OnboardingView() {
  const { user, refetch } = useSession();

  const [step, setStep] = React.useState<number>(() => {
    const saved = user?.onboardingStep ?? 1;
    return Math.min(4, Math.max(1, saved));
  });
  const [done, setDone] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [fullName, setFullName] = React.useState(user?.fullName ?? "");
  const [headline, setHeadline] = React.useState(user?.headline ?? "");
  const [location, setLocation] = React.useState(user?.location ?? "");
  const [interests, setInterests] = React.useState<string[]>(() =>
    parseChips(user?.socials as Record<string, string> | string | null, "_interests")
  );
  const [goals, setGoals] = React.useState<string[]>(() =>
    parseChips(user?.socials as Record<string, string> | string | null, "_goals")
  );
  const [marketingOptIn, setMarketingOptIn] = React.useState(user?.marketingOptIn ?? true);

  const progress = done ? 100 : Math.round(((step - 1) / 4) * 100);

  /** POST one step's payload; returns success. */
  const saveStep = async (stepNumber: number, data: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    try {
      await apiFetch<OnboardingPayload>("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({ step: stepNumber, data }),
      });
      await refetch();
      return true;
    } catch (e) {
      toast({
        title: "Could not save this step",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const advance = async (next: number, data: Record<string, unknown>) => {
    const okSave = await saveStep(next, data);
    if (!okSave) return;
    if (next < 4) {
      setStep(next + 1);
      toast({ title: `Step ${next} saved`, description: "Nice — moving on." });
    } else {
      setDone(true);
      toast({ title: "Setup complete", description: "Your MN.KP account is ready." });
    }
  };

  const skip = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      void advance(4, {});
    }
  };

  const submitStep = async () => {
    if (step === 1) {
      if (fullName.trim().length < 2) {
        toast({ title: "Add your name", description: "We'd like to greet you properly — two characters or more.", variant: "destructive" });
        return;
      }
      await advance(1, { fullName: fullName.trim() });
    } else if (step === 2) {
      await advance(2, {
        ...(headline.trim() ? { headline: headline.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
      });
    } else if (step === 3) {
      await advance(3, { interests });
    } else {
      await advance(4, { goals, marketingOptIn });
    }
  };

  const stepTitle = STEP_META[step - 1]?.title ?? "";

  return (
    <>
      <SEOHead
        title="Welcome — Set Up Your Account | MN.KP"
        description="A four-step onboarding flow for new MN.KP accounts."
        canonicalPath="/onboarding"
        noindex
      />
      <section
        aria-labelledby="onboarding-title"
        className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 md:py-16"
      >
        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-2xl border border-gold/25 bg-card p-8 text-center shadow-sm sm:p-12"
            role="status"
          >
            <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <Check className="size-9 text-gold" strokeWidth={2} aria-hidden="true" />
            </div>
            <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-gold">Setup complete</p>
            <h1 id="onboarding-title" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Welcome to MN.KP{fullName ? `, ${fullName.split(" ")[0]}` : ""}
            </h1>
            <div aria-hidden="true" className="gold-rule-center mx-auto mt-4 w-24" />
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Your account is ready — blog, store and services are a tap away, and your
              profile lives in Account whenever you need it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => navigate("/account")}
                className="h-11 gap-2 bg-primary px-6 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Enter MN.KP
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" asChild className="h-11 px-6">
                <ALink href="#/">Explore the homepage first</ALink>
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="rounded-2xl border bg-card shadow-sm">
            {/* header */}
            <div className="border-b px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="MN.KP monogram crest" className="h-9 w-9" width={36} height={36} />
                <div>
                  <h1 id="onboarding-title" className="text-lg font-semibold tracking-tight">
                    Set up your account
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Four quick steps — about a minute.
                  </p>
                </div>
              </div>

              {/* stepper */}
              <div className="mt-5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Onboarding progress">
                <Progress value={progress} className="h-1.5 [&>div]:bg-gold" />
                <ol className="mt-3 flex items-center justify-between">
                  {STEP_META.map((meta) => {
                    const state = done || meta.n < step ? "done" : meta.n === step ? "current" : "todo";
                    return (
                      <li key={meta.n} className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                            state === "done" && "border-gold bg-gold/15 text-gold",
                            state === "current" && "border-gold bg-gold text-gold-foreground",
                            state === "todo" && "border-border text-muted-foreground"
                          )}
                        >
                          {state === "done" ? <Check className="size-3.5" /> : meta.n}
                        </span>
                        <span
                          className={cn(
                            "hidden text-xs sm:inline",
                            state === "current" ? "font-medium text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {meta.title}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* body */}
            <div className="px-6 py-7 sm:px-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Step {step} of 4 — {stepTitle}
              </p>

              {step === 1 ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="onb-fullname" className="text-sm font-medium">
                      What should we call you?
                    </Label>
                    <Input
                      id="onb-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      className="mt-2 h-11"
                      minLength={2}
                      maxLength={80}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      This is how your name appears on your account and receipts.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="onb-headline" className="text-sm font-medium">
                      Headline <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="onb-headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Freelance designer · Learner"
                      className="mt-2 h-11"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label htmlFor="onb-location" className="text-sm font-medium">
                      Location <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="onb-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Calicut, Kerala"
                      className="mt-2 h-11"
                      maxLength={80}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Both help tailor deal alerts and content suggestions.
                  </p>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="mt-5">
                  <Label className="text-sm font-medium">
                    What are you into? <span className="font-normal text-muted-foreground">Pick any</span>
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We use these to highlight posts, gear and deals you actually care about.
                  </p>
                  <div className="mt-4">
                    <ChipSelector
                      ariaLabel="Interests"
                      options={INTEREST_OPTIONS}
                      selected={interests}
                      onToggle={(v) =>
                        setInterests((prev) =>
                          prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="mt-5 space-y-6">
                  <div>
                    <Label className="text-sm font-medium">
                      What brings you here? <span className="font-normal text-muted-foreground">Pick any</span>
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Goals shape the shortcuts we suggest on your dashboard.
                    </p>
                    <div className="mt-4">
                      <ChipSelector
                        ariaLabel="Goals"
                        options={GOAL_OPTIONS}
                        selected={goals}
                        onToggle={(v) =>
                          setGoals((prev) =>
                            prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                    <div>
                      <Label htmlFor="onb-marketing" className="text-sm font-medium">
                        Product updates &amp; deals
                      </Label>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Occasional emails — new posts, deal alerts and platform news.
                        No spam, unsubscribe anytime.
                      </p>
                    </div>
                    <Switch
                      id="onb-marketing"
                      checked={marketingOptIn}
                      onCheckedChange={setMarketingOptIn}
                      aria-label="Marketing emails opt-in"
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* footer */}
            <div className="flex flex-col-reverse gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex items-center gap-1">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(step - 1)}
                    disabled={saving}
                    className="h-11 gap-1.5"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={skip}
                  disabled={saving}
                  className="h-11 text-muted-foreground"
                >
                  Skip for now
                </Button>
              </div>
              <Button
                type="button"
                onClick={() => void submitStep()}
                disabled={saving}
                className="h-11 gap-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90 sm:min-w-40"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {saving ? "Saving…" : step === 4 ? "Finish setup" : "Continue"}
                {!saving ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
