"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarClock,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Icon } from "@/components/shared/lucide-icon";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { ErrorState, SuccessState } from "@/components/states";
import { useRouter } from "@/hooks/use-router";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { SITE, SOCIALS } from "@/lib/constants";
import { SERVICES } from "@/lib/content";
import type { InquiryType } from "@/types";
import { inquiryCreateSchema } from "@/lib/validation";
import type { InquiryDTO } from "@/types";

/**
 * ContactView — route key "contact" (#/contact).
 *
 * Two-column layout: react-hook-form + zod inquiry form on the left
 * (same schema the API validates server-side), contact cards, office
 * hours and a lazy Google Map embed (MEO) on the right.
 * ?service=<slug> prefills the subject line.
 */

const INQUIRY_TYPES = [
  { value: "general", label: "General inquiry" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "partnership", label: "Partnership" },
  { value: "advertising", label: "Advertising" },
  { value: "support", label: "Support" },
  { value: "feedback", label: "Feedback" },
] as const;

type InquiryFormInput = {
  name: string;
  email: string;
  phone?: string;
  type?: InquiryType;
  subject?: string;
  message: string;
};
/** Server output: the `type` default is applied by the shared schema. */
type InquiryFormOutput = Omit<InquiryFormInput, "type"> & { type: InquiryType };

const CONTACT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact MOHAMMED NIHAD KP — MN.KP",
  url: `${SITE.url}/contact`,
  description:
    "Reach MOHAMMED NIHAD KP for projects, collaborations, scholarships or sponsorships — WhatsApp, email or the inquiry form, replies within 24 hours.",
  mainEntity: {
    "@type": "Person",
    name: SITE.owner,
    email: SITE.email,
    telephone: SITE.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kozhikode (Calicut)",
      addressRegion: "Kerala",
      addressCountry: "IN",
    },
  },
};

function ContactCards() {
  const cards = [
    {
      icon: MessageCircle,
      title: "WhatsApp (fastest)",
      line: "Usually replies within the hour, IST daytime.",
      href: SITE.whatsappUrl,
      action: "Open WhatsApp",
      className: "border-primary/40 bg-primary/[0.07]",
      iconClass: "border-primary/30 bg-primary/10 text-primary",
    },
    {
      icon: Mail,
      title: "Email",
      line: SITE.email,
      href: `mailto:${SITE.email}`,
      action: "Write an email",
      className: "",
      iconClass: "border-gold/30 bg-gold/10 text-gold",
    },
    {
      icon: Phone,
      title: "Phone",
      line: SITE.phone,
      href: `tel:+${SITE.phoneRaw}`,
      action: "Call me",
      className: "",
      iconClass: "border-gold/30 bg-gold/10 text-gold",
    },
    {
      icon: MapPin,
      title: "Based in",
      line: "Calicut (Kozhikode), Kerala — working worldwide.",
      href: null,
      action: null,
      className: "",
      iconClass: "border-gold/30 bg-gold/10 text-gold",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <article
          key={card.title}
          className={`flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs ${card.className}`}
        >
          <span
            aria-hidden="true"
            className={`flex size-10 items-center justify-center rounded-lg border ${card.iconClass}`}
          >
            <card.icon className="size-5" strokeWidth={1.75} />
          </span>
          <h3 className="mt-3 text-sm font-semibold tracking-tight">{card.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.line}</p>
          {card.href && card.action ? (
            <ALink
              href={card.href}
              className="mt-auto pt-4 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {card.action}
            </ALink>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default function ContactView() {
  const { toast } = useToast();
  const { query } = useRouter();
  const [submitted, setSubmitted] = React.useState<InquiryDTO | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // ?service=<slug> prefill — type general + a ready-made subject line.
  const serviceSlug = query.get("service");
  const service = React.useMemo(
    () => SERVICES.find((s) => s.slug === serviceSlug) ?? null,
    [serviceSlug]
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormInput, unknown, InquiryFormOutput>({
    resolver: zodResolver(inquiryCreateSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      type: "general",
      subject: service ? `Inquiry about ${service.name}` : "",
      message: "",
    },
  });

  // Select (radix) mirrors its value into local state + the RHF field
  const [typeValue, setTypeValue] = React.useState<InquiryType>("general");

  const onSubmit = async (values: InquiryFormOutput) => {
    setSubmitError(null);
    try {
      const inquiry = await apiFetch<InquiryDTO>("/api/inquiries", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSubmitted(inquiry);
      reset({ name: "", email: "", phone: "", type: "general", subject: "", message: "" });
      setTypeValue("general");
      toast({
        title: "Inquiry received",
        description: "Reference saved — expect a reply within 24 hours.",
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not send your inquiry.");
    }
  };

  const sendAnother = () => {
    setSubmitted(null);
    setSubmitError(null);
    setTypeValue("general");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <SEOHead
        title="Contact & Inquiries — Hire an AI Developer in Calicut | MN.KP"
        description="Reach MOHAMMED NIHAD KP for projects, collaborations, scholarships or sponsorships. WhatsApp, email or the inquiry form — replies within 24 hours."
        canonicalPath="/contact"
        ogImage="/images/brand/og-cover.png"
        jsonLd={CONTACT_JSON_LD}
      />

      <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Contact" }]} />

      <header className="mt-8">
        <SectionHeading
          microLabel="Contact"
          title="Let's talk about what you're building"
          description={
            service
              ? `You picked ${service.name} — tell me a little about the project and you'll get a scoped quote within 24 hours.`
              : "Projects, collaborations, scholarships or sponsorships — WhatsApp, email or the form below. Every serious inquiry gets a reply within 24 hours."
          }
        />
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        {/* inquiry form */}
        <section aria-label="Inquiry form">
          {submitted ? (
            <div className="rounded-xl border bg-card p-2 shadow-xs">
              <SuccessState
                title="Inquiry received"
                description={
                  <>
                    Your reference number is{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {submitted.id.slice(0, 8).toUpperCase()}
                    </span>
                    . Expect a response within 24 hours — usually much sooner over WhatsApp.
                  </>
                }
                action={
                  <Button onClick={sendAnother} variant="outline" className="gap-2">
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Send another message
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
              className="rounded-2xl border bg-card p-6 shadow-xs md:p-8"
            >
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Inquiry form
              </p>
              <div className="gold-rule mt-3 mb-6 w-16" aria-hidden="true" />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inquiry-name">Name</Label>
                  <Input
                    id="inquiry-name"
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
                  <Label htmlFor="inquiry-email">Email</Label>
                  <Input
                    id="inquiry-email"
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

                <div className="space-y-2">
                  <Label htmlFor="inquiry-phone">
                    Phone <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="inquiry-phone"
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

                <div className="space-y-2">
                  <Label htmlFor="inquiry-type">Inquiry type</Label>
                  <Select
                    value={typeValue}
                    onValueChange={(value) => {
                      const next = value as InquiryType;
                      setTypeValue(next);
                      setValue("type", next, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger id="inquiry-type" aria-invalid={errors.type ? true : undefined}>
                      <SelectValue placeholder="Choose a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INQUIRY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.type.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inquiry-subject">
                    Subject <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="inquiry-subject"
                    placeholder="What's this about?"
                    aria-invalid={errors.subject ? true : undefined}
                    {...register("subject")}
                  />
                  {errors.subject ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.subject.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inquiry-message">Message</Label>
                  <Textarea
                    id="inquiry-message"
                    rows={6}
                    placeholder="The goal, the timeline, the budget range — whatever you have so far."
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
                  <Clock className="size-3.5" aria-hidden="true" />
                  Replies within 24 hours · IST (UTC+5:30)
                </p>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? "Sending..." : "Send inquiry"}
                  <Send className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* contact side */}
        <section aria-label="Direct contact channels">
          <ContactCards />

          <div className="mt-6 rounded-xl border bg-card p-5 shadow-xs">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <CalendarClock className="size-4 text-gold" aria-hidden="true" />
              Office hours
            </h3>
            <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>Mon – Sat</dt>
                <dd className="font-medium text-foreground">9:00 – 21:00 IST</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Sunday</dt>
                <dd className="font-medium text-foreground">WhatsApp only</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Global clients: async-first. Leave a message in your timezone and it will be
              answered inside the 24-hour window.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border">
            <iframe
              src={SITE.mapEmbedUrl}
              title="MN.KP location map — Calicut, Kerala"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-64 w-full border-0"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Calicut (Kozhikode), Kerala, India — remote-first, worldwide delivery.
          </p>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Elsewhere
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Social profiles">
              {SOCIALS.map((social) => (
                <li key={social.name}>
                  <ALink
                    href={social.url}
                    aria-label={social.name}
                    title={social.name}
                    className="flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon name={social.icon} className="size-4" />
                  </ALink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
