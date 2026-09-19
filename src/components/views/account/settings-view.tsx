"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Check,
  Cookie,
  Database,
  Loader2,
  LogOut,
  Mail,
  Save,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ALink } from "@/components/router/link";
import { navigate } from "@/hooks/use-router";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/shared/seo-head";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { CONSENT_CHANGE_EVENT, COOKIE_CONSENT_KEY, SITE } from "@/lib/constants";
import { apiFetch } from "@/components/views/auth/_shared";
import { parseChips, type ClientUser } from "./_shared";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* catalogue + schema                                                  */
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

const profileFormSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(80),
  displayName: z.string().max(80),
  headline: z.string().max(120),
  location: z.string().max(80),
  websiteUrl: z.string().url("Must be a valid URL").max(600).or(z.literal("")),
  bio: z.string().max(600),
  avatarUrl: z.string().max(600, "Keep the avatar URL under 600 characters"),
});

type ProfileValues = z.infer<typeof profileFormSchema>;

/* ------------------------------------------------------------------ */
/* chip editor                                                         */
/* ------------------------------------------------------------------ */

function ChipEditor({
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
 * #/account/settings (route key account-settings, guard auth) — profile
 * form (PATCH /api/auth/me), editable interests/goals (onboarding
 * endpoint), danger zone and data/privacy controls.
 */
export default function SettingsView() {
  const { user: rawUser, refetch } = useSession();
  const user = rawUser as ClientUser | null;

  const [marketingOptIn, setMarketingOptIn] = React.useState(user?.marketingOptIn ?? true);
  const [interests, setInterests] = React.useState<string[]>(() =>
    parseChips(user?.socials, "_interests")
  );
  const [goals, setGoals] = React.useState<string[]>(() =>
    parseChips(user?.socials, "_goals")
  );
  const [savingChips, setSavingChips] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      displayName: user?.displayName ?? "",
      headline: user?.headline ?? "",
      location: user?.location ?? "",
      websiteUrl: user?.websiteUrl ?? "",
      bio: user?.bio ?? "",
      avatarUrl: user?.avatarUrl ?? "",
    },
  });
  const submitDisabled = form.formState.isSubmitting;

  if (!user) return null; // guard guarantees a session

  const onProfileSubmit = async (values: ProfileValues) => {
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: values.fullName,
          ...(values.displayName !== (user.displayName ?? "") ? { displayName: values.displayName } : {}),
          ...(values.headline !== (user.headline ?? "") ? { headline: values.headline } : {}),
          ...(values.location !== (user.location ?? "") ? { location: values.location } : {}),
          ...(values.websiteUrl !== (user.websiteUrl ?? "") ? { websiteUrl: values.websiteUrl } : {}),
          ...(values.bio !== (user.bio ?? "") ? { bio: values.bio } : {}),
          ...(values.avatarUrl !== (user.avatarUrl ?? "") ? { avatarUrl: values.avatarUrl } : {}),
        }),
      });
      await refetch();
      toast({ title: "Profile saved", description: "Your account details are up to date." });
    } catch (e) {
      toast({
        title: "Could not save profile",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveMarketing = async (next: boolean) => {
    setMarketingOptIn(next);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ marketingOptIn: next }),
      });
      await refetch();
      toast({
        title: next ? "Updates on" : "Updates off",
        description: next
          ? "You'll receive occasional emails about posts, deals and news."
          : "You're opted out of marketing emails.",
      });
    } catch {
      setMarketingOptIn(!next);
      toast({ title: "Could not update preference", variant: "destructive" });
    }
  };

  const saveChips = async () => {
    setSavingChips(true);
    const step = Math.min(4, Math.max(1, user.onboardingStep || 1));
    try {
      await apiFetch("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({ step, data: { interests, goals } }),
      });
      await refetch();
      toast({ title: "Interests & goals saved", description: "Recommendations will follow suit." });
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingChips(false);
    }
  };

  const resetCookieConsent = () => {
    try {
      window.localStorage.removeItem(COOKIE_CONSENT_KEY);
      window.dispatchEvent(new CustomEvent<null>(CONSENT_CHANGE_EVENT, { detail: null }));
      toast({
        title: "Cookie preferences reset",
        description: "The consent banner will re-appear so you can choose again.",
      });
    } catch {
      toast({ title: "Could not reset preferences", variant: "destructive" });
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      await refetch();
      toast({ title: "Signed out", description: "See you soon." });
      navigate("/");
    } catch (e) {
      toast({
        title: "Sign-out failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setSigningOut(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Account Settings | MN.KP"
        description="Update your MN.KP profile, password and preferences."
        canonicalPath="/account/settings"
        noindex
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Account", href: "/account" },
            { label: "Settings" },
          ]}
        />

        <header className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Account · Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Account settings
          </h1>
          <div aria-hidden="true" className="gold-rule mt-4 w-24" />
        </header>

        <div className="mt-8 space-y-8">
          {/* profile form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-gold" aria-hidden="true" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-5" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full name</FormLabel>
                          <FormControl>
                            <Input className="h-11" placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display name</FormLabel>
                          <FormControl>
                            <Input className="h-11" placeholder="How we greet you" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="headline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Headline</FormLabel>
                          <FormControl>
                            <Input className="h-11" placeholder="e.g. Freelance designer" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input className="h-11" placeholder="e.g. Calicut, Kerala" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input className="h-11" placeholder="https://your-site.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="avatarUrl"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Avatar URL</FormLabel>
                          <FormControl>
                            <Input className="h-11" placeholder="/images/… or https://…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder="A couple of lines about you (shown to team only in this build)"
                              className="min-h-28"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitDisabled}
                    className="h-11 gap-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {submitDisabled ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    {submitDisabled ? "Saving…" : "Save profile"}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="marketing-switch" className="text-sm font-medium">
                    Product updates &amp; deals
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Occasional emails — new posts, deal alerts and platform news.
                  </p>
                </div>
                <Switch
                  id="marketing-switch"
                  checked={marketingOptIn}
                  onCheckedChange={(v) => void saveMarketing(v)}
                  aria-label="Marketing emails opt-in"
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* interests + goals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interests &amp; goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">
                  Interests <span className="font-normal text-muted-foreground">— pick any</span>
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Drives the posts, gear and deals we highlight for you.
                </p>
                <div className="mt-3">
                  <ChipEditor
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
              <div>
                <Label className="text-sm font-medium">
                  Goals <span className="font-normal text-muted-foreground">— pick any</span>
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shapes the shortcuts suggested on your dashboard.
                </p>
                <div className="mt-3">
                  <ChipEditor
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
              <Button
                onClick={() => void saveChips()}
                disabled={savingChips}
                variant="outline"
                className="h-11 gap-2"
              >
                {savingChips ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {savingChips ? "Saving…" : "Save interests & goals"}
              </Button>
            </CardContent>
          </Card>

          {/* data & privacy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4 text-gold" aria-hidden="true" />
                Data &amp; privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ul className="space-y-2">
                <li>
                  <ALink href="/legal/privacy-policy" className="font-medium text-primary underline-offset-2 hover:underline">
                    Privacy Policy
                  </ALink>{" "}
                  — what we collect and why.
                </li>
                <li>
                  <ALink href="/legal/data-processing-agreement" className="font-medium text-primary underline-offset-2 hover:underline">
                    Data Processing Agreement (DPA)
                  </ALink>{" "}
                  — how data is handled on your behalf.
                </li>
                <li>
                  <ALink href="/legal/cookie-policy" className="font-medium text-primary underline-offset-2 hover:underline">
                    Cookie Policy
                  </ALink>{" "}
                  — the cookies this site sets.
                </li>
              </ul>
              <Button
                variant="outline"
                onClick={resetCookieConsent}
                className="h-11 gap-2"
              >
                <Cookie className="size-4" aria-hidden="true" />
                Cookie preferences
              </Button>
              <p className="text-xs text-muted-foreground">
                Resets your consent choice — the banner re-appears so you can opt in
                or out of analytics and marketing cookies again.
              </p>
            </CardContent>
          </Card>

          {/* danger zone */}
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="size-4" aria-hidden="true" />
                Danger zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">Deactivate my account</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sends a request to the MN.KP team — we'll confirm and wipe data
                    per the retention policy.
                  </p>
                </div>
                <Button asChild variant="outline" className="h-11 gap-2 sm:shrink-0">
                  <a
                    href={`mailto:${SITE.email}?subject=${encodeURIComponent(
                      "Account deactivation request"
                    )}&body=${encodeURIComponent(
                      `Hello MN.KP team,\n\nPlease deactivate the account registered to ${user.email}.\n\nReason (optional): `
                    )}`}
                  >
                    <Mail className="size-4" aria-hidden="true" />
                    Request deactivation
                  </a>
                </Button>
              </div>
              <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">Sign out</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    End this session on this device and return to the homepage.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  className="h-11 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive sm:shrink-0"
                >
                  {signingOut ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut className="size-4" aria-hidden="true" />
                  )}
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
