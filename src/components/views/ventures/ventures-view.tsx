"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Briefcase,
  Check,
  ExternalLink,
  Handshake,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageCircle,
  Network,
  Package,
  Rocket,
  RotateCcw,
  Send,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { DataState, ErrorState, SuccessState } from "@/components/states";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { InquiryDTO, VentureCategory, VentureDTO, VentureStatus } from "@/types";

/**
 * VenturesView — route key "ventures" (#/ventures).
 *
 * Public catalogue of every business idea and venture (Calicut Store,
 * Chaliyam Connect, MN.KP Digital, Project 195...), a "join me — build the
 * next startup" collab band, and a startup-idea inquiry form that lands in
 * the Admin & Developer inbox as a type "venture" inquiry.
 */

/* ------------------------------------------------------------------ */
/* category / status metadata                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<VentureCategory, { label: string; icon: LucideIcon }> = {
  venture: { label: "Venture", icon: Rocket },
  store: { label: "Store", icon: Store },
  community: { label: "Community", icon: Network },
  tech: { label: "Tech", icon: Lightbulb },
  product: { label: "Product", icon: Package },
  service: { label: "Service", icon: Briefcase },
  media: { label: "Media", icon: Megaphone },
};

const STATUS_META: Record<
  VentureStatus,
  { label: string; dot: string; badge: string }
> = {
  live: {
    label: "Live",
    dot: "bg-emerald-500",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  incubating: {
    label: "Incubating",
    dot: "bg-amber-500",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  planned: {
    label: "Planned",
    dot: "bg-gold",
    badge: "border-gold/40 bg-gold/10 text-gold",
  },
  idea: {
    label: "Idea",
    dot: "bg-muted-foreground/60",
    badge: "border-border bg-muted text-muted-foreground",
  },
  retired: {
    label: "Retired",
    dot: "bg-muted-foreground/60",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/* ------------------------------------------------------------------ */
/* inquiry form schema (client-side mirror of inquiryCreateSchema)     */
/* ------------------------------------------------------------------ */

const INTENT_OPTIONS = [
  { value: "join", label: "Join an existing venture" },
  { value: "cofound", label: "Co-found a new startup" },
  { value: "pitch", label: "Pitch my own startup idea" },
  { value: "partner", label: "Partner / collab on a project" },
] as const;

type IntentValue = (typeof INTENT_OPTIONS)[number]["value"];

const NEW_IDEA = "__new__";

const pitchFormSchema = z.object({
  intent: z.enum(["join", "cofound", "pitch", "partner"]),
  venture: z.string().min(1, "Pick a venture (or \"A new idea\")"),
  name: z.string().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email").max(160),
  phone: z.string().max(20).optional().or(z.literal("")),
  message: z.string().min(10, "Tell us a bit more (min 10 characters)").max(4000),
});

type PitchFormValues = z.infer<typeof pitchFormSchema>;

interface VenturesResponse {
  items: VentureDTO[];
  total: number;
}

/* ------------------------------------------------------------------ */
/* venture card                                                        */
/* ------------------------------------------------------------------ */

function VentureCard({ venture }: { venture: VentureDTO }) {
  const meta = CATEGORY_META[venture.category] ?? CATEGORY_META.venture;
  const status = STATUS_META[venture.status] ?? STATUS_META.idea;
  const visibleHighlights = venture.highlights.slice(0, 4);
  const extraHighlights = venture.highlights.length - visibleHighlights.length;

  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md sm:p-5">
      {/* cover image or copper category medallion */}
      {venture.imageUrl ? (
        <img
          src={venture.imageUrl}
          alt={`${venture.name} cover`}
          loading="lazy"
          className="aspect-video w-full rounded-lg border object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-gold/25 bg-gold/[0.05]">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"
          >
            <meta.icon className="size-6" strokeWidth={1.75} />
          </span>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn("gap-1.5 px-2 py-0 text-[10px] font-medium capitalize", status.badge)}
        >
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", status.dot)} />
          {status.label}
        </Badge>
        <Badge variant="outline" className="px-2 py-0 text-[10px] font-medium capitalize text-muted-foreground">
          {meta.label}
        </Badge>
        {venture.isFeatured ? (
          <Badge variant="outline" className="border-gold/40 px-2 py-0 text-[10px] font-medium text-gold">
            Featured
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-2.5 text-base font-semibold tracking-tight md:text-lg">
        {venture.name}
      </h3>
      {venture.location ? (
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-gold/80" aria-hidden="true" />
          {venture.location}
        </p>
      ) : null}
      {venture.tagline ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
          {venture.tagline}
        </p>
      ) : null}

      {visibleHighlights.length > 0 ? (
        <ul className="mt-3.5 space-y-2">
          {visibleHighlights.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"
              >
                <Check className="size-2.5" strokeWidth={2.5} />
              </span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
          {extraHighlights > 0 ? (
            <li className="pl-[26px] text-xs text-muted-foreground">+{extraHighlights} more</li>
          ) : null}
        </ul>
      ) : null}

      {venture.collabRoles.length > 0 ? (
        <div className="mt-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Looking for
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {venture.collabRoles.map((role) => (
              <Badge
                key={role}
                variant="outline"
                className="border-gold/40 bg-gold/[0.06] px-2 py-0 text-[10px] font-medium text-gold"
              >
                {role}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {venture.websiteUrl ? (
        <div className="mt-auto pt-4">
          <a
            href={venture.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Visit the ${venture.name} website`}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Visit website
          </a>
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function VenturesView() {
  const [submitted, setSubmitted] = React.useState<InquiryDTO | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const venturesQuery = useQuery({
    queryKey: ["ventures"],
    queryFn: () => apiFetch<VenturesResponse>("/api/ventures"),
    staleTime: 60_000,
    retry: 1,
  });

  const ventures = venturesQuery.data?.items ?? [];

  const jsonLd = React.useMemo(() => {
    if (ventures.length === 0) return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "MN.KP ventures & business ideas",
      itemListElement: ventures.map((venture, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Organization",
          name: venture.name,
          description: venture.tagline ?? undefined,
          url: venture.websiteUrl ?? `${SITE.url}/ventures`,
          ...(venture.location
            ? {
                location: {
                  "@type": "Place",
                  name: venture.location,
                },
              }
            : {}),
        },
      })),
    };
  }, [ventures]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PitchFormValues>({
    resolver: zodResolver(pitchFormSchema),
    defaultValues: {
      intent: "pitch",
      venture: NEW_IDEA,
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  // Radix Selects mirror their value into local state + the RHF fields.
  const [intentValue, setIntentValue] = React.useState<IntentValue>("pitch");
  const [ventureValue, setVentureValue] = React.useState<string>(NEW_IDEA);

  const submitMutation = useMutation({
    mutationFn: (values: PitchFormValues) => {
      const intentLabel =
        INTENT_OPTIONS.find((o) => o.value === values.intent)?.label ?? "Startup idea";
      const ventureName =
        values.venture === NEW_IDEA
          ? "A new idea"
          : (ventures.find((v) => v.id === values.venture)?.name ?? "A new idea");
      return apiFetch<InquiryDTO>("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({
          type: "venture",
          subject: `${intentLabel} — ${ventureName}`,
          name: values.name,
          email: values.email,
          phone: values.phone,
          message: values.message,
        }),
      });
    },
    onSuccess: (inquiry) => {
      setSubmitted(inquiry);
      setSubmitError(null);
      reset({ intent: "pitch", venture: NEW_IDEA, name: "", email: "", phone: "", message: "" });
      setIntentValue("pitch");
      setVentureValue(NEW_IDEA);
      toast({
        title: "Pitch received",
        description: "Your startup idea landed — expect a reply within 24 hours.",
      });
    },
    onError: (e: Error) => {
      setSubmitError(e.message);
      toast({
        title: "Could not send your pitch",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PitchFormValues) => {
    setSubmitError(null);
    void submitMutation.mutateAsync(values);
  };

  const sendAnother = () => {
    setSubmitted(null);
    setSubmitError(null);
    setIntentValue("pitch");
    setVentureValue(NEW_IDEA);
  };

  const scrollToForm = () => {
    document.getElementById("pitch-your-idea")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // useWatch (single call, whole values) instead of form.watch — satisfies
  // react-hooks/incompatible-library; defaults are complete so the cast is safe.
  const watched = useWatch({ control }) as PitchFormValues;
  const currentIntent = watched.intent;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-14 lg:px-8">
      <SEOHead
        title="Ventures & Business Ideas — Calicut Store, Chaliyam Connect & More | MN.KP"
        description="Every MN.KP business idea and venture in one place — the Calicut Store, Chaliyam Connect, digital products and long-horizon startup ideas from Calicut, Kerala. Got a startup idea? Join me and build it together."
        canonicalPath="/ventures"
        ogImage="/images/brand/og-cover.webp"
        jsonLd={jsonLd}
      />

      <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Ventures" }]} />

      <header className="mt-5 md:mt-8">
        <SectionHeading
          microLabel="Ventures & business ideas"
          title="Everything I'm building — on one page"
          description="From a curated Calicut store to community initiatives and long-horizon startup ideas, these are the ventures I'm actively growing. If one of them speaks to you, there's a seat at the table."
        />
      </header>

      {/* ventures grid */}
      <div className="mt-8 md:mt-12">
        <DataState query={venturesQuery} skeletonRows={6}>
          {(data) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
              {data.items.map((venture) => (
                <VentureCard key={venture.id} venture={venture} />
              ))}
            </div>
          )}
        </DataState>
      </div>

      {/* join me band */}
      <section
        className="mt-10 rounded-xl border border-gold/40 bg-gold/[0.05] p-5 md:mt-16 md:p-8"
        aria-labelledby="join-me-heading"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Join me</p>
        <h2 id="join-me-heading" className="mt-2 text-balance text-xl font-semibold tracking-tight md:text-2xl lg:text-3xl">
          Build the next startup with me
        </h2>
        <p className="mt-2.5 max-w-2xl text-pretty text-[13px] leading-relaxed text-muted-foreground md:mt-3 md:text-sm lg:text-base">
          Every venture above started as a conversation. I partner with operators, investors,
          creators and local businesses — whether you want to co-found something new, join a
          live venture, or pitch an idea of your own. Current focus:{" "}
          <span className="font-medium text-foreground">
            {ventures[0]?.name ?? "Calicut Store"} collabs
          </span>
          .
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5 md:mt-6 md:gap-3">
          <Button size="lg" className="h-10 gap-2 md:h-11" onClick={scrollToForm}>
            <Lightbulb className="size-4" aria-hidden="true" />
            Pitch your idea
          </Button>
          <ALink href={SITE.whatsappUrl}>
            <Button
              size="lg"
              variant="outline"
              className="h-10 gap-2 border-gold/50 text-gold hover:bg-gold/10 md:h-11"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp me
            </Button>
          </ALink>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5 text-gold/80" aria-hidden="true" />
          Collaboration is welcome at every stage — idea, incubation or live.
        </p>
      </section>

      {/* startup-idea inquiry form */}
      <section id="pitch-your-idea" className="mt-10 scroll-mt-24 md:mt-14" aria-labelledby="pitch-form-heading">
        <SectionHeading
          microLabel="Startup inquiry"
          title="Tell me about your idea"
          description="Two minutes, no pitch deck needed. Serious ideas get a personal reply within 24 hours — usually much sooner over WhatsApp."
        />
        <div className="mt-5 md:mt-8">
          {submitted ? (
            <div className="rounded-xl border bg-card p-2 shadow-xs">
              <SuccessState
                title="Pitch received"
                description={
                  <>
                    Your reference number is{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {submitted.id.slice(0, 8).toUpperCase()}
                    </span>
                    . It lands in the MN.KP inbox as a venture inquiry — expect a response
                    within 24 hours.
                  </>
                }
                action={
                  <Button onClick={sendAnother} variant="outline" className="gap-2">
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Send another idea
                  </Button>
                }
              />
            </div>
          ) : submitError ? (
            <div className="rounded-xl border bg-card p-2 shadow-xs">
              <ErrorState
                message={submitError}
                onRetry={() => {
                  setSubmitError(null);
                }}
              />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6 md:p-8"
            >
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-gold">
                <Handshake className="size-3.5" aria-hidden="true" />
                Join me — startup idea form
              </p>
              <div className="gold-rule mt-3 mb-5 w-16 md:mb-6" aria-hidden="true" />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pitch-intent">I want to</Label>
                  <Select
                    value={intentValue}
                    onValueChange={(value) => {
                      const next = value as IntentValue;
                      setIntentValue(next);
                      setValue("intent", next, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger id="pitch-intent" aria-invalid={errors.intent ? true : undefined}>
                      <SelectValue placeholder="Choose an intent" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.intent ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.intent.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pitch-venture">The venture</Label>
                  <Select
                    value={ventureValue}
                    onValueChange={(value) => {
                      setVentureValue(value);
                      setValue("venture", value, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger id="pitch-venture" aria-invalid={errors.venture ? true : undefined}>
                      <SelectValue placeholder="Pick a venture" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_IDEA}>A new idea</SelectItem>
                      {ventures.map((venture) => (
                        <SelectItem key={venture.id} value={venture.id}>
                          {venture.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.venture ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.venture.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pitch-name">Name</Label>
                  <Input
                    id="pitch-name"
                    autoComplete="name"
                    placeholder="Your full name"
                    aria-invalid={errors.name ? true : undefined}
                    {...register("name")}
                  />
                  {errors.name ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pitch-email">Email</Label>
                  <Input
                    id="pitch-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={errors.email ? true : undefined}
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pitch-phone">
                    Phone <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="pitch-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 ..."
                    aria-invalid={errors.phone ? true : undefined}
                    {...register("phone")}
                  />
                  {errors.phone ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.phone.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pitch-message">
                    {currentIntent === "pitch" || currentIntent === "cofound"
                      ? "Your startup idea"
                      : "Your message"}
                  </Label>
                  <Textarea
                    id="pitch-message"
                    rows={6}
                    placeholder="The idea, the problem it solves, what stage you're at and what you'd want from me — whatever you have so far."
                    aria-invalid={errors.message ? true : undefined}
                    {...register("message")}
                  />
                  {errors.message ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.message.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  Serious ideas get a reply within 24 hours · IST (UTC+5:30)
                </p>
                <Button type="submit" disabled={isSubmitting || submitMutation.isPending} className="gap-2">
                  {isSubmitting || submitMutation.isPending ? "Sending..." : "Send my idea"}
                  <Send className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* related links */}
      <nav aria-label="Related pages" className="mt-10 md:mt-14">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <li>
            <ALink
              href="#/services"
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm font-medium shadow-xs transition-colors hover:border-gold/50"
            >
              Work with me on a project
              <ArrowRight className="size-4 shrink-0 text-gold" aria-hidden="true" />
            </ALink>
          </li>
          <li>
            <ALink
              href="#/store"
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm font-medium shadow-xs transition-colors hover:border-gold/50"
            >
              Shop the Calicut Store picks
              <ArrowRight className="size-4 shrink-0 text-gold" aria-hidden="true" />
            </ALink>
          </li>
          <li>
            <ALink
              href="#/contact"
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm font-medium shadow-xs transition-colors hover:border-gold/50"
            >
              General inquiries & contact
              <ArrowRight className="size-4 shrink-0 text-gold" aria-hidden="true" />
            </ALink>
          </li>
        </ul>
      </nav>
    </div>
  );
}
