"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, MotionConfig } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Briefcase,
  Check,
  ExternalLink,
  FileText,
  Handshake,
  Lightbulb,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Network,
  Package,
  PhoneCall,
  Rocket,
  RotateCcw,
  Search,
  Send,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { DataState, NoResultsState, StatePage, SuccessState } from "@/components/states";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { InquiryDTO, VentureCategory, VentureDTO, VentureStatus } from "@/types";

/**
 * VenturesView — route key "ventures" (#/ventures).
 *
 * Public venture board: dark premium hero band with live stats, an optional
 * featured spotlight, a searchable/filterable catalogue (category + status
 * chips), a 4-step "how collabs work" timeline and a co-create inquiry form
 * (type "venture" / "collab") that lands in the Admin & Developer inbox.
 *
 * MEO: Calicut / Kerala mentioned naturally in copy; ItemList + HowTo JSON-LD.
 * Gracefully empty — the board renders an inviting curation panel at 0 rows.
 */

/* ------------------------------------------------------------------ */
/* constants & metadata                                                */
/* ------------------------------------------------------------------ */

const VENTURE_FALLBACK_IMAGE = "/images/brand/marquee-global.webp";

/** Shared reveal easing (matches the app's route-transition curve). */
const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const CATEGORY_META: Record<VentureCategory, { label: string; icon: LucideIcon }> = {
  venture: { label: "Ventures", icon: Rocket },
  store: { label: "Commerce", icon: Store },
  community: { label: "Community", icon: Network },
  tech: { label: "Tech", icon: Lightbulb },
  product: { label: "Products", icon: Package },
  service: { label: "Services", icon: Briefcase },
  media: { label: "Media", icon: Megaphone },
};

const CATEGORY_ORDER: VentureCategory[] = [
  "venture",
  "store",
  "community",
  "tech",
  "product",
  "service",
  "media",
];

const STATUS_META: Record<VentureStatus, { label: string; dot: string; badge: string }> = {
  live: {
    label: "Live",
    dot: "bg-emerald-500",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  incubating: {
    label: "Incubating",
    dot: "bg-gold",
    badge: "border-gold/40 bg-gold/10 text-gold",
  },
  planned: {
    label: "Planned",
    dot: "bg-stone-400 dark:bg-stone-500",
    badge:
      "border-stone-400/50 bg-stone-400/10 text-stone-600 dark:border-stone-500/50 dark:bg-stone-500/10 dark:text-stone-300",
  },
  idea: {
    label: "Idea",
    dot: "bg-amber-500",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  retired: {
    label: "Retired",
    dot: "bg-muted-foreground/60",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

const STATUS_FILTERS: Array<{ value: VentureStatus | "all"; label: string; dot: string }> = [
  { value: "all", label: "All", dot: "" },
  { value: "live", label: "Live", dot: "bg-emerald-500" },
  { value: "incubating", label: "Incubating", dot: "bg-gold" },
  { value: "planned", label: "Planned", dot: "bg-stone-400 dark:bg-stone-500" },
  { value: "idea", label: "Ideas", dot: "bg-amber-500" },
];

const PROCESS_STEPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Lightbulb,
    title: "Pitch",
    text: "Two honest paragraphs beat a polished deck. Send the idea through the form below or over WhatsApp — rough is welcome.",
  },
  {
    icon: PhoneCall,
    title: "Discovery call",
    text: "Thirty minutes on WhatsApp, Zoom, or over chai in Calicut. We pressure-test the idea and check the fit on both sides.",
  },
  {
    icon: FileText,
    title: "Scope & terms",
    text: "Roles, contribution, revenue or equity split, and milestones — agreed in writing before anything else. Small and clear beats big and vague.",
  },
  {
    icon: Rocket,
    title: "Build & launch",
    text: "I bring the AI-first build workflow, you bring your side of the table, and we ship an MVP in weeks — then iterate with real users.",
  },
];

/** HowTo JSON-LD for the collab process section (module-level, static). */
const PROCESS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to collaborate on an MN.KP venture",
  description:
    "The four-step MN.KP collaboration process — pitch, discovery call, scope and terms, build and launch.",
  step: PROCESS_STEPS.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.text,
  })),
};

/* ------------------------------------------------------------------ */
/* inquiry form schema (client-side mirror of inquiryCreateSchema)     */
/* ------------------------------------------------------------------ */

const INTENT_OPTIONS = [
  { value: "join", label: "Join a venture", hint: "Step into something already moving", icon: Users },
  { value: "pitch", label: "Pitch a startup idea", hint: "Bring your own idea to the table", icon: Lightbulb },
  { value: "collab", label: "Collab / partnership", hint: "Team up on a project or campaign", icon: Handshake },
] as const;

type IntentValue = (typeof INTENT_OPTIONS)[number]["value"];

const collabFormSchema = z.object({
  intent: z.enum(["join", "pitch", "collab"]),
  subject: z.string().max(160, "Keep the subject under 160 characters"),
  name: z.string().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email").max(160),
  phone: z.string().max(20, "Keep the phone number short").or(z.literal("")),
  message: z.string().min(10, "Tell me a bit more (min 10 characters)").max(4000),
});

type CollabFormValues = z.infer<typeof collabFormSchema>;

interface VenturesResponse {
  items: VentureDTO[];
  total: number;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const CHIP_BASE =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-medium transition-colors sm:min-h-9 sm:px-3.5";
const CHIP_ACTIVE = "border-gold/60 bg-gold/10 text-gold";
const CHIP_IDLE = "bg-card text-muted-foreground hover:border-gold/40 hover:text-foreground";

/* ------------------------------------------------------------------ */
/* venture card                                                        */
/* ------------------------------------------------------------------ */

interface VentureCardProps {
  venture: VentureDTO;
  onDiscuss: (venture: VentureDTO) => void;
}

function VentureCard({ venture, onDiscuss }: VentureCardProps) {
  const meta = CATEGORY_META[venture.category] ?? CATEGORY_META.venture;
  const status = STATUS_META[venture.status] ?? STATUS_META.idea;
  const visibleHighlights = venture.highlights.slice(0, 3);
  const extraHighlights = venture.highlights.length - visibleHighlights.length;
  const cover = venture.imageUrl ?? VENTURE_FALLBACK_IMAGE;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg">
      <img
        src={cover}
        alt={`${venture.name} — venture cover`}
        loading="lazy"
        className="aspect-video w-full object-cover"
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("gap-1.5 px-2 py-0 text-[10px] font-medium", status.badge)}
          >
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", status.dot)} />
            {status.label}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 px-2 py-0 text-[10px] font-medium text-muted-foreground"
          >
            <meta.icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
            {meta.label}
          </Badge>
          {venture.isFeatured ? (
            <Badge variant="outline" className="border-gold/40 px-2 py-0 text-[10px] font-medium text-gold">
              Featured
            </Badge>
          ) : null}
        </div>

        <h3 className="mt-2.5 break-words text-base font-semibold tracking-tight md:text-lg">
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
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Users className="size-3.5 text-gold/80" aria-hidden="true" />
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

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Button onClick={() => onDiscuss(venture)} className="h-11 flex-1 gap-2 text-[13px]">
            <MessageCircle className="size-4" aria-hidden="true" />
            Discuss this venture
          </Button>
          {venture.websiteUrl ? (
            <a
              href={venture.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit the ${venture.name} website (opens in a new tab)`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* featured spotlight                                                  */
/* ------------------------------------------------------------------ */

interface FeaturedSpotlightProps {
  venture: VentureDTO;
  onDiscuss: (venture: VentureDTO) => void;
}

function FeaturedSpotlight({ venture, onDiscuss }: FeaturedSpotlightProps) {
  const meta = CATEGORY_META[venture.category] ?? CATEGORY_META.venture;
  const status = STATUS_META[venture.status] ?? STATUS_META.idea;
  const cover = venture.imageUrl ?? VENTURE_FALLBACK_IMAGE;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.45, ease: REVEAL_EASE }}
      className="mt-8 md:mt-12"
      aria-labelledby="featured-venture-name"
    >
      <div className="overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-xs">
        <div className="grid lg:grid-cols-5">
          <div className="relative aspect-[16/10] lg:col-span-2 lg:aspect-auto lg:min-h-[360px]">
            <img
              src={cover}
              alt={`${venture.name} — featured venture cover`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent"
            />
            <Badge
              variant="outline"
              className="absolute left-4 top-4 gap-1.5 border-gold/60 bg-stone-950/80 px-2.5 py-0.5 text-[10px] font-medium text-gold backdrop-blur-sm"
            >
              <Rocket className="size-3" strokeWidth={1.75} aria-hidden="true" />
              Featured
            </Badge>
          </div>

          <div className="flex flex-col p-5 sm:p-7 lg:col-span-3 lg:p-9">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Featured venture
            </p>
            <h2
              id="featured-venture-name"
              className="mt-2 break-words text-balance text-xl font-semibold tracking-tight md:text-2xl lg:text-3xl"
            >
              {venture.name}
            </h2>
            {venture.tagline ? (
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-foreground/90 md:text-sm">
                {venture.tagline}
              </p>
            ) : null}

            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Badge
                variant="outline"
                className={cn("gap-1.5 px-2.5 py-0 text-[10px] font-medium", status.badge)}
              >
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", status.dot)} />
                {status.label}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1 px-2.5 py-0 text-[10px] font-medium text-muted-foreground"
              >
                <meta.icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
                {meta.label}
              </Badge>
              {venture.location ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0 text-gold/80" aria-hidden="true" />
                  {venture.location}
                </span>
              ) : null}
            </div>

            {venture.description ? (
              <p className="mt-4 line-clamp-3 text-pretty text-[13px] leading-relaxed text-muted-foreground md:text-sm">
                {venture.description}
              </p>
            ) : null}

            {venture.highlights.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {venture.highlights.slice(0, 4).map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
                  >
                    <Check className="size-3 shrink-0 text-gold" strokeWidth={2.5} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            {venture.collabRoles.length > 0 ? (
              <div className="mt-4">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Users className="size-3.5 text-gold/80" aria-hidden="true" />
                  Looking for
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {venture.collabRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="border-gold/40 bg-gold/[0.06] px-2.5 py-0 text-[10px] font-medium text-gold"
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-auto flex flex-col gap-2.5 pt-6 sm:flex-row sm:items-center">
              <Button onClick={() => onDiscuss(venture)} className="h-11 gap-2">
                <MessageCircle className="size-4" aria-hidden="true" />
                Discuss this venture
              </Button>
              {venture.websiteUrl ? (
                <a
                  href={venture.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Visit the ${venture.name} website (opens in a new tab)`}
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Visit website
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* empty board panel (0 ventures)                                      */
/* ------------------------------------------------------------------ */

function EmptyBoardPanel({ onPitch }: { onPitch: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.45, ease: REVEAL_EASE }}
      className="rounded-2xl border border-gold/25 bg-card shadow-xs"
    >
      <StatePage
        icon={Rocket}
        tone="gold"
        microLabel="ON THE BOARD"
        title="The venture board is being curated"
        description="The first wave of MN.KP ventures — commerce, community and product ideas rooted in Calicut — is being prepared right now. The board fills up soon, and early collaborators get the best seats."
        actions={
          <>
            <Button size="lg" className="h-11 gap-2" onClick={onPitch}>
              <Lightbulb className="size-4" aria-hidden="true" />
              Pitch your idea
            </Button>
            <ALink href="#/services">
              <Button
                size="lg"
                variant="outline"
                className="h-11 gap-2 border-gold/50 text-gold hover:bg-gold/10"
              >
                Explore services meanwhile
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </ALink>
          </>
        }
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

export default function VenturesView() {
  const [submitted, setSubmitted] = React.useState<InquiryDTO | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  /* filters */
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<VentureCategory | "all">("all");
  const [status, setStatus] = React.useState<VentureStatus | "all">("all");

  const venturesQuery = useQuery({
    queryKey: ["ventures"],
    queryFn: () => apiFetch<VenturesResponse>("/api/ventures"),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const ventures = venturesQuery.data?.items ?? [];

  const liveCount = ventures.filter((v) => v.status === "live").length;
  const incubatingCount = ventures.filter((v) => v.status === "incubating").length;
  const ideaCount = ventures.filter((v) => v.status === "planned" || v.status === "idea").length;
  const featured = ventures.find((v) => v.isFeatured) ?? null;
  const statsReady = venturesQuery.isSuccess;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return ventures.filter((venture) => {
      if (category !== "all" && venture.category !== category) return false;
      if (status !== "all" && venture.status !== status) return false;
      if (q) {
        const haystack = `${venture.name} ${venture.tagline ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [ventures, search, category, status]);

  const filtersActive = search.trim() !== "" || category !== "all" || status !== "all";
  const total = ventures.length;

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setStatus("all");
  };

  /* JSON-LD — ItemList of the ventures + HowTo for the collab process. */
  const jsonLd = React.useMemo(() => {
    const schemas: unknown[] = [PROCESS_JSON_LD];
    if (ventures.length > 0) {
      schemas.unshift({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "MN.KP ventures & business ideas",
        itemListElement: ventures.map((venture, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: venture.name,
          url: venture.websiteUrl ?? `${SITE.url}/ventures`,
        })),
      });
    }
    return schemas;
  }, [ventures]);

  /* ------------------------------ form ------------------------------ */

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CollabFormValues>({
    resolver: zodResolver(collabFormSchema),
    defaultValues: {
      intent: "pitch",
      subject: "",
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: (values: CollabFormValues) => {
      const intentLabel =
        INTENT_OPTIONS.find((option) => option.value === values.intent)?.label ?? "Venture inquiry";
      return apiFetch<InquiryDTO>("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({
          type: values.intent === "collab" ? "collab" : "venture",
          subject: values.subject.trim() || intentLabel,
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
      reset({ intent: "pitch", subject: "", name: "", email: "", phone: "", message: "" });
      toast({
        title: "Message received",
        description: "Your pitch landed in the MN.KP inbox — expect a personal reply within 24 hours.",
      });
    },
    onError: (e: Error) => {
      setSubmitError(e.message);
      toast({
        title: "Could not send your message",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CollabFormValues) => {
    setSubmitError(null);
    void submitMutation.mutateAsync(values);
  };

  const sendAnother = () => {
    setSubmitted(null);
    setSubmitError(null);
  };

  /** Pre-fill the form from a venture card / spotlight and scroll to it. */
  const handleDiscuss = (venture: VentureDTO) => {
    setSubmitted(null);
    setSubmitError(null);
    setValue("intent", "join", { shouldValidate: true });
    setValue("subject", venture.name, { shouldValidate: true });
    scrollToId("collab-form");
  };

  // useWatch (single call, whole values) instead of form.watch — satisfies
  // react-hooks/incompatible-library; defaults are complete so the cast is safe.
  const watched = useWatch({ control }) as CollabFormValues;
  const currentIntent: IntentValue = watched.intent;

  const messageLabel =
    currentIntent === "pitch" ? "Your startup idea" : currentIntent === "join" ? "Your message" : "Your proposal";
  const messagePlaceholder =
    currentIntent === "pitch"
      ? "The idea, the problem it solves, the stage you are at and what you would want from me — rough is fine."
      : currentIntent === "join"
        ? "Which venture caught your eye, what you would own in it, and how much time you can give it?"
        : "What you bring, what I bring, and what we would build together — a campaign, a product, a project.";

  const countLabel = filtersActive
    ? `Showing ${filtered.length} of ${total} ${total === 1 ? "venture" : "ventures"}`
    : `${total} ${total === 1 ? "venture" : "ventures"} on the board`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-14 lg:px-8">
        <SEOHead
          title="Ventures & Business Ideas — Build a Startup with Me | MN.KP"
          description="Explore MN.KP ventures & startup ideas from Calicut, Kerala — live projects, incubating ideas and open calls to collaborate. Pitch yours and build it with me."
          canonicalPath="/ventures"
          ogImage="/images/brand/og-cover.webp"
          jsonLd={jsonLd}
        />

        <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Ventures" }]} />

        {/* ------------------------------------------------ hero band */}
        <section className="relative isolate mt-5 overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 px-4 py-8 text-stone-100 shadow-sm sm:px-7 sm:py-10 md:mt-8 md:px-10 md:py-12 lg:px-12">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(680px circle at 86% -12%, color-mix(in oklab, var(--gold) 16%, transparent), transparent 62%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: REVEAL_EASE }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-soft">
              MN.KP Ventures
            </p>
            <div className="mt-3">
              <SectionHeading
                as="h1"
                title="Build the next startup with me"
                description="This is where my ventures and business ideas take shape — commerce, community, tech and media projects rooted in Calicut, Kerala. Some are live, some are incubating, and every one of them has room for the right collaborator."
                className="text-stone-100 [&_p]:text-stone-400"
              />
            </div>

            <dl className="mt-8 grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {[
                { label: "Live", value: statsReady ? liveCount : "—" },
                { label: "Incubating", value: statsReady ? incubatingCount : "—" },
                { label: "Ideas", value: statsReady ? ideaCount : "—" },
              ].map((stat) => (
                <div key={stat.label} className="px-3 py-4 text-center sm:px-6">
                  <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400 sm:text-[11px] sm:tracking-[0.18em]">
                    {stat.label}
                  </dt>
                  <dd className="mt-1.5 text-xl font-semibold tabular-nums text-stone-50 sm:text-3xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={() => scrollToId("venture-catalogue")}
                className="h-11 w-full gap-2 bg-gold text-gold-foreground hover:bg-gold/90 sm:w-auto"
              >
                Explore the ventures
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToId("collab-form")}
                className="h-11 w-full gap-2 border-gold/50 text-gold hover:bg-gold/10 sm:w-auto"
              >
                <Lightbulb className="size-4" aria-hidden="true" />
                Pitch your idea
              </Button>
            </div>
          </motion.div>
        </section>

        {/* --------------------------------------- featured spotlight */}
        {featured ? <FeaturedSpotlight venture={featured} onDiscuss={handleDiscuss} /> : null}

        {/* --------------------------------------------- catalogue */}
        <section id="venture-catalogue" className="mt-10 scroll-mt-24 md:mt-14">
          <SectionHeading
            microLabel="The venture board"
            title="Every venture, at every stage"
            description="Live products, incubating builds and ideas still on the whiteboard — filter by category or stage, then open a conversation on the one that fits you."
          />

          <div className="mt-6 md:mt-8">
            <DataState query={venturesQuery} skeletonRows={6} empty={() => false}>
              {() =>
                total === 0 ? (
                  <EmptyBoardPanel onPitch={() => scrollToId("collab-form")} />
                ) : (
                  <>
                    {/* filter toolbar */}
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.4, ease: REVEAL_EASE }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="relative flex-1">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <label htmlFor="venture-search" className="sr-only">
                            Search ventures by name or tagline
                          </label>
                          <Input
                            id="venture-search"
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by name or tagline — try 'Calicut'"
                            className="h-11 pl-9"
                          />
                        </div>
                        <p aria-live="polite" className="text-xs text-muted-foreground sm:shrink-0">
                          {countLabel}
                        </p>
                      </div>

                      <div
                        className="scrollbar-slim -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
                        role="group"
                        aria-label="Filter by category"
                      >
                        <button
                          type="button"
                          onClick={() => setCategory("all")}
                          aria-pressed={category === "all"}
                          className={cn(CHIP_BASE, category === "all" ? CHIP_ACTIVE : CHIP_IDLE)}
                        >
                          All
                        </button>
                        {CATEGORY_ORDER.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setCategory(value)}
                            aria-pressed={category === value}
                            className={cn(CHIP_BASE, category === value ? CHIP_ACTIVE : CHIP_IDLE)}
                          >
                            {CATEGORY_META[value].label}
                          </button>
                        ))}
                      </div>

                      <div
                        className="scrollbar-slim -mx-4 mt-2.5 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
                        role="group"
                        aria-label="Filter by status"
                      >
                        {STATUS_FILTERS.map((item) => {
                          const isActive = status === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setStatus(item.value)}
                              aria-pressed={isActive}
                              className={cn(CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_IDLE)}
                            >
                              {item.dot ? (
                                <span aria-hidden="true" className={cn("size-1.5 rounded-full", item.dot)} />
                              ) : null}
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* grid */}
                    {filtered.length === 0 ? (
                      <div className="mt-6">
                        <NoResultsState query={search.trim() || null} onClear={resetFilters} />
                      </div>
                    ) : (
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                        {filtered.map((venture, index) => (
                          <motion.div
                            key={venture.id}
                            className="h-full"
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{
                              duration: 0.4,
                              ease: REVEAL_EASE,
                              delay: (index % 3) * 0.06,
                            }}
                          >
                            <VentureCard venture={venture} onDiscuss={handleDiscuss} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )
              }
            </DataState>
          </div>
        </section>

        {/* --------------------------------- how collabs work timeline */}
        <section className="mt-10 md:mt-16">
          <SectionHeading
            microLabel="The process"
            title="How collabs work"
            description="No gatekeeping and no ghosting — four steps, each with a clear output, from first message to launch day."
          />
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            It&rsquo;s the same discipline I bring to{" "}
            <ALink href="#/services" className="font-medium text-primary underline-offset-2 hover:underline">
              client work
            </ALink>{" "}
            — just aimed at ventures we co-own instead of invoices you pay.
          </p>

          <motion.ol
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }}
            transition={{ duration: 0.45, ease: REVEAL_EASE }}
            className="mt-8 grid gap-8 lg:grid-cols-4 lg:gap-6"
          >
            {PROCESS_STEPS.map((step, index) => {
              const isLast = index === PROCESS_STEPS.length - 1;
              return (
                <li key={step.title} className="relative">
                  {!isLast ? (
                    <>
                      {/* vertical connector (mobile / tablet) */}
                      <span
                        aria-hidden="true"
                        className="absolute bottom-[-2rem] left-5 top-10 hidden w-px bg-gradient-to-b from-gold/45 via-gold/20 to-transparent max-lg:block"
                      />
                      {/* horizontal connector (desktop) */}
                      <span
                        aria-hidden="true"
                        className="absolute top-5 right-[-1.5rem] left-12 hidden h-px bg-gradient-to-r from-gold/45 via-gold/20 to-transparent lg:block"
                      />
                    </>
                  ) : null}
                  <div className="flex items-start gap-4 lg:block">
                    <span
                      aria-hidden="true"
                      className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold tabular-nums text-gold-foreground"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="lg:mt-4">
                      <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight md:text-base">
                        <step.icon className="size-4 shrink-0 text-gold" strokeWidth={1.75} aria-hidden="true" />
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </motion.ol>
        </section>

        {/* ------------------------------------- co-create form */}
        <section id="collab-form" className="mt-10 scroll-mt-24 md:mt-16">
          <SectionHeading
            microLabel="Co-create"
            title="Build the next one with me"
            description="Two minutes, no pitch deck required. Every message lands in my personal inbox and gets a considered reply within 24 hours — usually much sooner over WhatsApp."
          />
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            New here? Read{" "}
            <ALink href="#/about" className="font-medium text-primary underline-offset-2 hover:underline">
              who I am
            </ALink>{" "}
            or see{" "}
            <ALink href="#/services" className="font-medium text-primary underline-offset-2 hover:underline">
              how I work with clients
            </ALink>{" "}
            — the short version: I answer everything, I put terms in writing, and I ship.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }}
            transition={{ duration: 0.45, ease: REVEAL_EASE }}
            className="mt-6 md:mt-8"
          >
            {submitted ? (
              <div className="rounded-2xl border bg-card p-2 shadow-xs">
                <SuccessState
                  title="Message received"
                  description={
                    <>
                      Your reference number is{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {submitted.id.slice(0, 8).toUpperCase()}
                      </span>
                      . It lands in the MN.KP inbox as a venture inquiry — expect a personal response
                      within 24 hours, usually sooner over WhatsApp.
                    </>
                  }
                  action={
                    <Button onClick={sendAnother} variant="outline" className="h-11 gap-2">
                      <RotateCcw className="size-4" aria-hidden="true" />
                      Send another message
                    </Button>
                  }
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
                  Join me — co-create form
                </p>
                <div className="gold-rule mt-3 mb-6 w-16" aria-hidden="true" />

                {/* intent */}
                <p className="text-sm font-medium" id="collab-intent-label">
                  I want to
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="collab-intent-label"
                  className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                  {INTENT_OPTIONS.map((option) => {
                    const isActive = currentIntent === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "press relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors",
                          "has-[:focus-visible]:border-gold/60 has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          isActive
                            ? "border-gold/60 bg-gold/[0.07]"
                            : "bg-card hover:border-gold/40"
                        )}
                      >
                        <input
                          type="radio"
                          value={option.value}
                          className="sr-only"
                          {...register("intent")}
                        />
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                            <option.icon
                              className={cn(
                                "size-4 shrink-0",
                                isActive ? "text-gold" : "text-muted-foreground"
                              )}
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            {option.label}
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                              isActive
                                ? "border-gold bg-gold text-gold-foreground"
                                : "border-muted-foreground/40 text-transparent"
                            )}
                          >
                            <Check className="size-2.5" strokeWidth={3} />
                          </span>
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {option.hint}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="collab-name">Name</Label>
                    <Input
                      id="collab-name"
                      autoComplete="name"
                      maxLength={80}
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
                    <Label htmlFor="collab-email">Email</Label>
                    <Input
                      id="collab-email"
                      type="email"
                      autoComplete="email"
                      maxLength={160}
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

                  <div className="space-y-2">
                    <Label htmlFor="collab-phone">
                      Phone <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="collab-phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={20}
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

                  <div className="space-y-2">
                    <Label htmlFor="collab-subject">Subject</Label>
                    <Input
                      id="collab-subject"
                      maxLength={160}
                      placeholder="e.g. Joining the Calicut Store — operations"
                      aria-invalid={errors.subject ? true : undefined}
                      {...register("subject")}
                    />
                    {errors.subject ? (
                      <p role="alert" className="text-xs text-destructive">
                        {errors.subject.message}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        One clear line — auto-filled when you open a venture from the board.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="collab-message">{messageLabel}</Label>
                    <Textarea
                      id="collab-message"
                      rows={6}
                      maxLength={4000}
                      placeholder={messagePlaceholder}
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

                {submitError ? (
                  <p
                    role="alert"
                    className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {submitError}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    Every message gets a personal reply within 24 hours · IST — anything else?{" "}
                    <ALink
                      href="#/contact"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      The contact page
                    </ALink>{" "}
                    covers it.
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || submitMutation.isPending}
                    className="h-11 gap-2"
                  >
                    {isSubmitting || submitMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Sending…
                      </>
                    ) : (
                      <>
                        Send my pitch
                        <Send className="size-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
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
                General inquiries &amp; contact
                <ArrowRight className="size-4 shrink-0 text-gold" aria-hidden="true" />
              </ALink>
            </li>
          </ul>
        </nav>
      </div>
    </MotionConfig>
  );
}
