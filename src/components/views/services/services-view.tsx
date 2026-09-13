"use client";

import * as React from "react";
import { ArrowRight, Check, FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Icon } from "@/components/shared/lucide-icon";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { SITE } from "@/lib/constants";
import { SERVICES } from "@/lib/content";
import { formatINR } from "@/components/shared/product-card";

/**
 * ServicesView — route key "services" (#/services).
 *
 * Five rich, alternating service sections with deliverables checklists,
 * "from ₹X,XXX" pricing and internal links into related blog posts (SEO
 * internal-linking), plus a 4-step process strip and a CTA band.
 *
 * MEO note: Calicut / Kerala are mentioned naturally in copy — never stuffed.
 * JSON-LD: ItemList of Service nodes with Person provider + INR offers.
 */

const PROCESS_STEPS = [
  {
    title: "Inquiry",
    text: "You send a WhatsApp message or the inquiry form — a rough idea is enough.",
  },
  {
    title: "Scope & quote",
    text: "Within 24 hours you get a clear scope, timeline and a fixed price in INR.",
  },
  {
    title: "Build with AI",
    text: "I build in days with the AI workflow — you see progress, not silence.",
  },
  {
    title: "Launch & support",
    text: "We ship, verify on real devices, and I stay on call for 30 days.",
  },
];

const SERVICES_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "MN.KP services in Calicut, Kerala",
  itemListElement: SERVICES.map((service, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Service",
      name: service.name,
      description: service.blurb,
      provider: {
        "@type": "Person",
        name: SITE.owner,
        url: SITE.url,
      },
      areaServed: {
        "@type": "City",
        name: "Calicut (Kozhikode), Kerala, India",
      },
      offers: {
        "@type": "Offer",
        price: service.priceFrom,
        priceCurrency: "INR",
        url: `${SITE.url}/contact?service=${service.slug}`,
      },
    },
  })),
};

export default function ServicesView() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-14 lg:px-8">
      <SEOHead
        title="Services — AI Development, Photography & Videography in Calicut | MN.KP"
        description="AI-powered web & app development, AI training, photography, videography, editing and marketing services in Calicut, Kerala. Free quote within 24 hours."
        canonicalPath="/services"
        ogImage="/images/brand/og-cover.webp"
        jsonLd={SERVICES_JSON_LD}
      />

      <Breadcrumbs items={[{ label: "Home", href: "#/" }, { label: "Services" }]} />

      <header className="mt-5 md:mt-8">
        <SectionHeading
          microLabel="Services in Calicut, Kerala"
          title="Five services. One standard: shipped."
          description="Everything below is delivered with the same AI-powered workflow I write about on the blog — planned, built and launched from Calicut, for clients anywhere in the world."
        />
      </header>

      {/* service sections — alternating layout */}
      <div className="mt-8 space-y-8 md:mt-12 md:space-y-12 lg:space-y-16">
        {SERVICES.map((service, index) => {
          const reversed = index % 2 === 1;
          return (
            <section
              key={service.slug}
              id={service.slug}
              aria-labelledby={`service-${service.slug}`}
              className="grid grid-cols-1 items-center gap-5 sm:gap-8 lg:grid-cols-2 lg:gap-12"
            >
              {/* intro / meta */}
              <div className={reversed ? "lg:order-2" : undefined}>
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold md:size-12 md:rounded-xl"
                >
                  <Icon name={service.icon} className="size-5 md:size-6" strokeWidth={1.75} />
                </span>
                <h2
                  id={`service-${service.slug}`}
                  className="mt-3 text-balance text-xl font-semibold tracking-tight md:mt-4 md:text-2xl lg:text-3xl"
                >
                  {service.name}
                </h2>
                <p className="mt-2.5 text-pretty text-[13px] leading-relaxed text-muted-foreground md:mt-3 md:text-sm lg:text-base">
                  {service.blurb}
                </p>
                <p className="mt-3 text-base font-semibold tracking-tight text-gold md:mt-4 md:text-lg">
                  from {formatINR(service.priceFrom)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5 md:mt-6 md:gap-3">
                  <ALink href={`#/contact?service=${service.slug}`}>
                    <Button className="h-9 gap-2 md:h-10">
                      Get a quote
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </ALink>
                  {service.relatedPosts[0] ? (
                    <ALink href={`#/blog/${service.relatedPosts[0]}`}>
                      <Button variant="outline" className="h-9 gap-2 md:h-10">
                        <FileText className="size-4" aria-hidden="true" />
                        Read the related guide
                      </Button>
                    </ALink>
                  ) : null}
                </div>
              </div>

              {/* deliverables checklist */}
              <div className={reversed ? "lg:order-1" : undefined}>
                <div className="rounded-xl border bg-card p-4 shadow-xs sm:p-5 md:rounded-2xl md:p-8">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground md:text-xs">
                    What you get
                  </p>
                  <ul className="mt-3.5 space-y-2.5 md:mt-5 md:space-y-3.5">
                    {service.deliverables.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed md:gap-3 md:text-sm">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary md:size-5"
                        >
                          <Check className="size-2.5 md:size-3" strokeWidth={2.5} />
                        </span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {service.relatedPosts.length > 0 ? (
                    <div className="mt-4 border-t pt-4 md:mt-6 md:pt-5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground md:text-xs">
                        More reading
                      </p>
                      <ul className="mt-2.5 space-y-2 md:mt-3">
                        {service.relatedPosts.map((slug) => (
                          <li key={slug} className="text-[13px] md:text-sm">
                            <ALink
                              href={`#/blog/${slug}`}
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {slug
                                .split("-")
                                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(" ")}
                            </ALink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* process strip */}
      <section className="mt-10 md:mt-16" aria-label="How working together looks">
        <SectionHeading
          microLabel="The process"
          title="From first message to launch"
          description="No mystery, no months of silence — four steps, each with a clear output."
        />
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-8 md:gap-4 lg:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-lg border bg-card p-4 shadow-xs md:rounded-xl md:p-5">
              <p className="text-[11px] font-semibold tabular-nums text-gold md:text-xs">0{index + 1}</p>
              <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight md:mt-2 md:text-base">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground md:mt-2 md:text-sm">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA band */}
      <section className="mt-10 rounded-xl border border-gold/40 bg-gold/[0.05] p-5 text-center md:mt-16 md:rounded-2xl md:p-10">
        <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl lg:text-3xl">
          Tell me the goal — I&rsquo;ll tell you the price
        </h2>
        <p className="mx-auto mt-2.5 max-w-xl text-pretty text-[13px] leading-relaxed text-muted-foreground md:mt-3 md:text-sm lg:text-base">
          Every quote is free and comes back within 24 hours. Prefer talking? WhatsApp is the
          fastest way to reach me from Calicut or anywhere else.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 md:mt-6 md:gap-3">
          <ALink href="#/contact">
            <Button size="lg" className="h-10 gap-2 md:h-11">
              Request a free quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </ALink>
          <ALink href={SITE.whatsappUrl}>
            <Button size="lg" variant="outline" className="h-10 gap-2 border-gold/50 text-gold hover:bg-gold/10 md:h-11">
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp me
            </Button>
          </ALink>
        </div>
      </section>
    </div>
  );
}
