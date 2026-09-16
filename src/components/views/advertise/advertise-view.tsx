"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    CalendarClock,
    Check,
    Globe2,
    Loader2,
    Megaphone,
    MessageCircle,
    ShieldCheck,
    Users,
} from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { formatINR } from "@/components/shared/product-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import type { AdPlanDTO, AdPlacement } from "@/types";

/**
 * AdvertiseView — route key "advertise" (#/advertise).
 *
 * Public "Advertise on MN.KP" page: monthly ad plans (GET /api/ad-plans,
 * admin-editable), the placement catalogue, a 4-step process, value props,
 * an FAQ (Accordion + FAQPage JSON-LD) and an inquiry Dialog that posts to
 * POST /api/inquiries with type "advertising".
 *
 * Empty/error-safe: with no plans in the database the page still sells the
 * placements and keeps the inquiry CTA front and centre.
 */

/* ------------------------------- content ---------------------------------- */

/** Human labels for every AdPlacement code (kept local to this view). */
const PLACEMENT_META: Record<string, { label: string; hint: string }> = {
    "header-banner": { label: "Header banner", hint: "Slim strip under the site header on every page" },
    "blog-inline": { label: "Blog inline", hint: "Mid-article promo block" },
    "blog-sidebar": { label: "Blog sidebar", hint: "Sticky rail beside articles" },
    "between-cards": { label: "Between cards", hint: "Inside list grids between cards" },
    "home-strip": { label: "Home strip", hint: "Full-width strip on the home hero" },
    "hero-marquee": { label: "Hero marquee", hint: "Premium dual-lane marquee on the home hero" },
    "store-side": { label: "Store side", hint: "Side panel in the store grid" },
    "footer-banner": { label: "Footer banner", hint: "Above the site footer" },
    "product-inline": { label: "Product inline", hint: "Inside product detail pages" },
    marquee: { label: "Marquee", hint: "Scrolling image strip" },
    sticker: { label: "Sticker", hint: "Floating corner sticker" },
};

function placementLabel(code: AdPlacement): string {
    return PLACEMENT_META[code]?.label ?? code;
}

const TRUST_CHIPS = [
    { icon: Globe2, label: "All-page placements" },
    { icon: CalendarClock, label: "Monthly billing" },
    { icon: ShieldCheck, label: "Reviewed campaigns" },
] as const;

const HOW_IT_WORKS = [
    {
        title: "Send an inquiry",
        text: "Tell us your goals and your budget — the form takes two minutes and a rough idea is enough.",
    },
    {
        title: "Get set up",
        text: "We agree the plan, billing starts monthly, and you get an advertiser account in the Advertiser Studio.",
    },
    {
        title: "Send your creative — or we make it",
        text: "Submit your ad from the Advertiser Studio, or brief us and we design it for you.",
    },
    {
        title: "We review, then it goes live",
        text: "Every campaign is approved by MN.KP before publishing — quality first, always.",
    },
] as const;

const WHY_CARDS = [
    {
        icon: BadgeCheck,
        title: "Honest, curated audience",
        text: "No inflated numbers. MN.KP readers arrive through search and word of mouth — and they trust what the site recommends.",
    },
    {
        icon: Users,
        title: "AI-first creators and founders",
        text: "The audience skews toward builders — developers, creators and founders researching the tools and workflows your product fits.",
    },
    {
        icon: Globe2,
        title: "Clean, fast, mobile-first",
        text: "Your creative renders on a fast, clutter-free, mobile-first site — placements that get seen, not ignored.",
    },
    {
        icon: BarChart3,
        title: "Transparent monthly reporting",
        text: "Every plan includes a monthly report of impressions and clicks, so you always know exactly what you paid for.",
    },
] as const;

const FAQS = [
    {
        q: "Do I need approval for every ad?",
        a: "Yes. Clients cannot publish directly — every submission waits for owner approval before it goes live. If you prefer, we create and run the ad for you end to end, so review never slows you down.",
    },
    {
        q: "How does billing work?",
        a: "Plans are flat-rate and billed monthly in INR. Billing starts once we agree the plan, and you can stop at the end of any month — no lock-in, no per-click surprises.",
    },
    {
        q: "Can I change my creative mid-month?",
        a: "Yes. Submit updated creative from the Advertiser Studio at any point in the month. Changes pass through the same quick review and usually go live within a day.",
    },
    {
        q: "What happens if my ad is rejected?",
        a: "You get the reason, so you can edit and resubmit. Rejections are rare and always explained — we want your campaign live as much as you do.",
    },
    {
        q: "Do you design the ad for us?",
        a: "Yes — creative design is included in the Growth and Brand plans. Send your brief and assets; we handle layout, sizing and copy polish.",
    },
] as const;

const FAQ_JSON_LD = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
};

/* ------------------------------ inquiry form ------------------------------ */

interface InquiryPayload {
    type: "advertising";
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------- component ------------------------------- */

export default function AdvertiseView() {
    // ---- plans (public GET; admin edits them in the Ad Manager) ----
    const plansQuery = useQuery({
        queryKey: ["ad-plans", "public"],
        queryFn: () => apiFetch<{ items: AdPlanDTO[] }>("/api/ad-plans"),
        staleTime: 60_000,
        retry: 1,
    });
    const plans = React.useMemo(() => plansQuery.data?.items ?? [], [plansQuery.data]);

    // ---- inquiry dialog state ----
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [planChoice, setPlanChoice] = React.useState("custom");
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [phone, setPhone] = React.useState("");
    const [company, setCompany] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const openInquiry = React.useCallback((planCode: string | null) => {
        setPlanChoice(planCode ?? "custom");
        setErrors({});
        setDialogOpen(true);
    }, []);

    const resetForm = React.useCallback(() => {
        setName("");
        setEmail("");
        setPhone("");
        setCompany("");
        setMessage("");
        setPlanChoice("custom");
        setErrors({});
    }, []);

    const inquiryMutation = useMutation({
        mutationFn: (payload: InquiryPayload) =>
            apiFetch<unknown>("/api/inquiries", {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        onSuccess: () => {
            toast({
                title: "Inquiry sent",
                description: "We reply within 24 hours with a plan and next steps.",
            });
            setDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast({
                title: "Could not send the inquiry",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextErrors: Record<string, string> = {};
        if (name.trim().length < 2) nextErrors.name = "Enter your name (at least 2 characters).";
        if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = "Enter a valid email address.";
        if (message.trim().length < 10) nextErrors.message = "Tell us a bit more (at least 10 characters).";
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        const chosen = plans.find((plan) => plan.code === planChoice);
        const lines: string[] = [];
        if (company.trim()) lines.push(`Company: ${company.trim()}`);
        lines.push("");
        lines.push(message.trim());

        inquiryMutation.mutate({
            type: "advertising",
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            subject: `Ad plan: ${chosen ? chosen.name : "Custom / not sure"}`,
            message: lines.join("\n"),
        });
    };

    // Guard against a stale plan code after the plans list refetches.
    const effectivePlanChoice =
        planChoice === "custom" || plans.some((plan) => plan.code === planChoice)
            ? planChoice
            : "custom";

    const scrollToPlans = () => {
        document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    /* --------------------------------- render -------------------------------- */

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:px-8">
            <SEOHead
                title="Advertise on MN.KP — Monthly Ad Plans & Placements"
                description="Simple monthly ad plans on MN.KP — header banners, blog placements, homepage strips and the hero marquee. Every campaign is quality-reviewed. Replies within 24 hours."
                canonicalPath="/advertise"
                ogImage="/images/brand/og-cover.webp"
                jsonLd={FAQ_JSON_LD}
            />

            <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Advertise" }]} />

            {/* ------------------------------ hero ------------------------------ */}
            <header className="mt-5 md:mt-8">
                <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold md:size-12"
                >
                    <Megaphone className="size-5 md:size-6" strokeWidth={1.75} />
                </span>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                    Advertising
                </p>
                <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
                    Advertise on MN.KP
                </h1>
                <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                    Monthly plans with placements across every page of the site — from the home hero to
                    deep blog reads — behind an approval-based quality bar that keeps readers trusting
                    what they see. Set up in days, billed monthly, reported honestly.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button size="lg" className="h-11 w-full gap-2 sm:w-auto" onClick={scrollToPlans}>
                        View plans
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                    <ALink href="#/contact" className="w-full sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="h-11 w-full sm:w-auto"
                            aria-label="Contact us instead of picking a plan"
                        >
                            Contact us instead
                        </Button>
                    </ALink>
                </div>
                <ul className="mt-6 flex flex-wrap gap-2.5">
                    {TRUST_CHIPS.map((chip) => {
                        const ChipIcon = chip.icon;
                        return (
                            <li
                                key={chip.label}
                                className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
                            >
                                <ChipIcon className="size-3.5 text-gold" aria-hidden="true" />
                                {chip.label}
                            </li>
                        );
                    })}
                </ul>
            </header>

            {/* ------------------------------ plans ------------------------------ */}
            <section id="plans" aria-label="Advertising plans" className="mt-12 scroll-mt-24 md:mt-16">
                <SectionHeading
                    microLabel="Plans"
                    title="Simple monthly plans"
                    description="One flat price per month in INR, placements on every page of the site, and honest reporting. Pick a package or ask for any combination — plans start with a conversation, not a contract."
                />

                {plansQuery.isPending ? (
                    <>
                        <p className="sr-only" role="status">
                            Loading advertising plans
                        </p>
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-8 lg:grid-cols-3 md:gap-6">
                            {[0, 1, 2].map((index) => (
                                <div
                                    key={index}
                                    aria-hidden="true"
                                    className="h-80 animate-pulse rounded-xl border bg-muted/40"
                                />
                            ))}
                        </div>
                    </>
                ) : plansQuery.isError ? (
                    <div className="mt-6 rounded-xl border bg-card p-6 text-center sm:p-10 md:mt-8">
                        <span
                            aria-hidden="true"
                            className="mx-auto flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold"
                        >
                            <MessageCircle className="size-5" strokeWidth={1.75} />
                        </span>
                        <h3 className="mt-4 text-base font-semibold tracking-tight">
                            Couldn&apos;t load the plans
                        </h3>
                        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                            Something went wrong while fetching the lineup. Try again in a moment — or send
                            an inquiry and we will include the current plans in our reply.
                        </p>
                        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                            <Button
                                variant="outline"
                                className="h-11 sm:w-auto"
                                onClick={() => {
                                    void plansQuery.refetch();
                                }}
                            >
                                Try again
                            </Button>
                            <Button className="h-11 gap-1.5 sm:w-auto" onClick={() => openInquiry(null)}>
                                Send an inquiry
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="mt-6 rounded-xl border bg-card p-6 text-center sm:p-10 md:mt-8">
                        <span
                            aria-hidden="true"
                            className="mx-auto flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold"
                        >
                            <MessageCircle className="size-5" strokeWidth={1.75} />
                        </span>
                        <h3 className="mt-4 text-base font-semibold tracking-tight">
                            The plan lineup is being finalised
                        </h3>
                        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                            Monthly packages are coming online shortly. Every placement is also sold
                            individually — tell us what you need and we will put a package together.
                        </p>
                        <Button className="mt-5 h-11 gap-1.5" onClick={() => openInquiry(null)}>
                            Ask about a custom plan
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-8 lg:grid-cols-3 md:gap-6">
                            {plans.map((plan) => (
                                <Card
                                    key={plan.id}
                                    className={`flex h-full flex-col rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${plan.isFeatured ? "border-gold/50 bg-gold/[0.05]" : ""
                                        }`}
                                >
                                    <CardHeader className="pb-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="text-lg font-semibold tracking-tight">
                                                {plan.name}
                                            </CardTitle>
                                            {plan.isFeatured ? (
                                                <Badge className="shrink-0 border-gold/40 bg-gold/15 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
                                                    Most popular
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1.5">
                                            <span className="text-2xl font-semibold tracking-tight">
                                                {formatINR(plan.priceMonthly)}
                                            </span>
                                            <span className="text-sm text-muted-foreground"> /month</span>
                                        </p>
                                        {plan.description ? (
                                            <CardDescription className="text-[13px] leading-relaxed">
                                                {plan.description}
                                            </CardDescription>
                                        ) : null}
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col gap-4">
                                        {plan.features.length > 0 ? (
                                            <ul className="space-y-2">
                                                {plan.features.map((feature) => (
                                                    <li
                                                        key={feature}
                                                        className="flex items-start gap-2 text-[13px] leading-relaxed"
                                                    >
                                                        <Check
                                                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                                                            aria-hidden="true"
                                                            strokeWidth={2.5}
                                                        />
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                        {plan.placements.length > 0 ? (
                                            <div className="mt-auto pt-1">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                                    Placements
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {plan.placements.map((code) => (
                                                        <Badge
                                                            key={code}
                                                            variant="outline"
                                                            className="border-gold/30 bg-gold/[0.06] text-[10px] font-medium"
                                                        >
                                                            {placementLabel(code)}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        <Button
                                            variant={plan.isFeatured ? "default" : "outline"}
                                            className="mt-1 h-11 w-full"
                                            onClick={() => openInquiry(plan.code)}
                                        >
                                            Inquire about {plan.name}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <p className="mt-6 text-center text-[13px] leading-relaxed text-muted-foreground">
                            Need something custom? Every placement is also sold individually —{" "}
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-[13px]"
                                onClick={() => openInquiry(null)}
                            >
                                ask
                            </Button>
                            .
                        </p>
                    </>
                )}
            </section>

            {/* --------------------------- placements --------------------------- */}
            <section aria-label="Where your ad appears" className="mt-12 md:mt-16">
                <SectionHeading
                    microLabel="Placements"
                    title="Where your ad appears"
                    description="Eleven placements across the home page, blog, store and product pages — each one sold individually or bundled into a monthly plan."
                />
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-8 lg:grid-cols-3 md:gap-4">
                    {Object.entries(PLACEMENT_META).map(([code, meta]) => (
                        <div
                            key={code}
                            className="rounded-xl border bg-card p-4 transition-colors hover:border-gold/40"
                        >
                            <div className="flex items-center gap-2">
                                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold" />
                                <h3 className="text-sm font-semibold">{meta.label}</h3>
                            </div>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                                {meta.hint}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* --------------------------- how it works -------------------------- */}
            <section aria-label="How it works" className="mt-12 md:mt-16">
                <SectionHeading
                    microLabel="Process"
                    title="How it works"
                    description="From first message to live campaign in four steps — most advertisers are live within a week."
                />
                <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-8 lg:grid-cols-4 md:gap-5">
                    {HOW_IT_WORKS.map((step, index) => (
                        <li key={step.title} className="h-full rounded-xl border bg-card p-4 md:p-5">
                            <span
                                aria-hidden="true"
                                className="flex size-9 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-sm font-semibold text-gold"
                            >
                                {index + 1}
                            </span>
                            <h3 className="mt-3.5 text-sm font-semibold leading-snug">{step.title}</h3>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                                {step.text}
                            </p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* ----------------------------- why MN.KP ---------------------------- */}
            <section aria-label="Why advertise on MN.KP" className="mt-12 md:mt-16">
                <SectionHeading
                    microLabel="Why MN.KP"
                    title="Why MN.KP"
                    description="A small, focused audience that trusts the site — and reporting that shows exactly what your budget did."
                />
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-8 lg:grid-cols-4 md:gap-5">
                    {WHY_CARDS.map((card) => {
                        const CardIcon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className="h-full rounded-xl border bg-card p-4 transition-colors hover:border-gold/40 md:p-5"
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex size-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"
                                >
                                    <CardIcon className="size-5" strokeWidth={1.75} />
                                </span>
                                <h3 className="mt-3.5 text-sm font-semibold leading-snug">{card.title}</h3>
                                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                                    {card.text}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* -------------------------------- FAQ ------------------------------- */}
            <section aria-label="Frequently asked questions" className="mt-12 md:mt-16">
                <SectionHeading
                    microLabel="FAQ"
                    title="Frequently asked questions"
                    description="Everything advertisers usually ask before the first campaign. Something missing? Send an inquiry — a human replies."
                />
                <Accordion type="single" collapsible className="mt-6 w-full md:mt-8">
                    {FAQS.map((faq, index) => (
                        <AccordionItem key={faq.q} value={`faq-${index}`}>
                            <AccordionTrigger className="text-left text-sm md:text-base">
                                {faq.q}
                            </AccordionTrigger>
                            <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground md:text-sm">
                                {faq.a}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </section>

            {/* ----------------------------- final CTA ---------------------------- */}
            <section aria-label="Start advertising on MN.KP" className="mt-12 md:mt-16">
                <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/[0.14] via-gold/[0.07] to-transparent p-6 sm:p-8 md:p-12">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                        Next step
                    </p>
                    <h2 className="mt-2 max-w-xl text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                        Ready to reach the MN.KP audience?
                    </h2>
                    <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                        Tell us your goals and budget — we reply within 24 hours with a recommended plan
                        and next steps.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                            size="lg"
                            className="h-11 w-full gap-2 sm:w-auto"
                            onClick={() => openInquiry(null)}
                        >
                            Start with an inquiry
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                        <ALink href="#/studio" className="w-full sm:w-auto">
                            <Button
                                size="lg"
                                variant="ghost"
                                className="h-auto min-h-11 w-full whitespace-normal text-center sm:w-auto sm:whitespace-nowrap"
                            >
                                Already a client? Open the Advertiser Studio
                            </Button>
                        </ALink>
                    </div>
                </div>
            </section>

            {/* --------------------------- inquiry dialog -------------------------- */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Advertising inquiry</DialogTitle>
                        <DialogDescription>
                            Tell us about your goals, budget and timeline — we reply within 24 hours with a
                            plan and next steps.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="adv-name">
                                    Name <span aria-hidden="true">*</span>
                                </Label>
                                <Input
                                    id="adv-name"
                                    className="h-11"
                                    autoComplete="name"
                                    placeholder="Your full name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    required
                                    aria-required="true"
                                    aria-invalid={errors.name ? true : undefined}
                                    aria-describedby={errors.name ? "adv-name-error" : undefined}
                                />
                                {errors.name ? (
                                    <p id="adv-name-error" className="text-xs text-destructive" role="alert">
                                        {errors.name}
                                    </p>
                                ) : null}
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="adv-email">
                                    Email <span aria-hidden="true">*</span>
                                </Label>
                                <Input
                                    id="adv-email"
                                    type="email"
                                    inputMode="email"
                                    className="h-11"
                                    autoComplete="email"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                    aria-required="true"
                                    aria-invalid={errors.email ? true : undefined}
                                    aria-describedby={errors.email ? "adv-email-error" : undefined}
                                />
                                {errors.email ? (
                                    <p id="adv-email-error" className="text-xs text-destructive" role="alert">
                                        {errors.email}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="adv-phone">Phone (optional)</Label>
                                <Input
                                    id="adv-phone"
                                    type="tel"
                                    inputMode="tel"
                                    className="h-11"
                                    autoComplete="tel"
                                    placeholder="+91 ..."
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="adv-company">Company (optional)</Label>
                                <Input
                                    id="adv-company"
                                    className="h-11"
                                    autoComplete="organization"
                                    placeholder="Company or brand name"
                                    value={company}
                                    onChange={(event) => setCompany(event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="adv-plan">Plan</Label>
                            <Select value={effectivePlanChoice} onValueChange={setPlanChoice}>
                                <SelectTrigger id="adv-plan" className="h-11 w-full">
                                    <SelectValue placeholder="Choose a plan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {plans.map((plan) => (
                                        <SelectItem key={plan.code} value={plan.code}>
                                            {plan.name} — {formatINR(plan.priceMonthly)}/mo
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="custom">Custom / not sure</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="adv-message">
                                Message <span aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="adv-message"
                                className="min-h-28"
                                placeholder="What are you promoting? What is your monthly budget, and when would you like to go live?"
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                required
                                aria-required="true"
                                aria-invalid={errors.message ? true : undefined}
                                aria-describedby={errors.message ? "adv-message-error" : undefined}
                            />
                            {errors.message ? (
                                <p id="adv-message-error" className="text-xs text-destructive" role="alert">
                                    {errors.message}
                                </p>
                            ) : null}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full sm:w-auto"
                                onClick={() => setDialogOpen(false)}
                                disabled={inquiryMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="h-11 w-full gap-2 sm:w-auto"
                                disabled={inquiryMutation.isPending}
                            >
                                {inquiryMutation.isPending ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                        Sending
                                    </>
                                ) : (
                                    <>
                                        Send inquiry
                                        <ArrowRight className="size-4" aria-hidden="true" />
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
