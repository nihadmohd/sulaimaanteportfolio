"use client";

import * as React from "react";
import { ArrowUpRight, Briefcase, Camera, BrainCircuit, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALink } from "@/components/router/link";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Icon } from "@/components/shared/lucide-icon";
import { SectionHeading } from "@/components/shared/section-heading";
import { SEOHead } from "@/components/shared/seo-head";
import { SITE, SOCIALS } from "@/lib/constants";
import {
  ABOUT_PARAGRAPHS,
  BRANDS,
  EDUCATION,
  EXPLORING,
  PILLARS,
  PROJECTS,
  STACK,
  VISION,
} from "@/lib/content";

/**
 * AboutView — route key "about" (#/about).
 *
 * The story page: portrait, biography, three pillars, the 195-country vision,
 * what I'm exploring, education timeline, stack chips, brands and projects,
 * CV + socials. Rich Person JSON-LD for E-E-A-T signals.
 */

const PILLAR_ICONS = [BrainCircuit, Camera, Briefcase];

const PERSON_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE.owner,
  url: `${SITE.url}/about`,
  jobTitle: "Freelancer · Businessman · AI-First Developer",
  description:
    "AI-first developer, freelancer and businessman from Calicut (Kozhikode), Kerala — building apps, websites and digital solutions with an AI-powered workflow.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Kozhikode (Calicut)",
    addressRegion: "Kerala",
    addressCountry: "IN",
  },
  knowsAbout: [
    "AI-powered web development",
    "AI-powered app development",
    "AI training and workflow coaching",
    "Photography and photo editing",
    "Videography and video editing",
    "Marketing and business growth",
    "Freelancing and business strategy",
  ],
  alumniOf: {
    "@type": "Organization",
    name: "Diploma in Computer Engineering (Polytechnic, Kerala)",
  },
  sameAs: SOCIALS.map((social) => social.url),
};

export default function AboutView() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <SEOHead
        title="About MOHAMMED NIHAD KP — AI-First Developer & Freelancer from Calicut | MN.KP"
        description="From a Computer Engineering diploma in Calicut to AI-powered digital execution — the story, skills, stack and 195-country vision of Mohammed Nihad KP."
        canonicalPath="/about"
        ogImage="/images/brand/portrait.webp"
        ogType="profile"
        jsonLd={PERSON_JSON_LD}
      />

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr] lg:gap-12">
        {/* portrait — sticky on large screens */}
        <aside className="mx-auto w-full max-w-[300px] lg:mx-0">
          <div className="lg:sticky lg:top-24">
            <img
              src="/images/brand/portrait.webp"
              alt="Portrait of MOHAMMED NIHAD KP — AI-first developer and freelancer from Calicut, Kerala"
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full rounded-2xl border border-gold/30 object-cover shadow-md ring-1 ring-gold/40"
            />
            <div className="mt-4 flex flex-col gap-3">
              <ALink href={SITE.cvUrl}>
                <Button variant="outline" className="w-full gap-2 border-gold/50 text-gold hover:bg-gold/10">
                  <FileText className="size-4" aria-hidden="true" />
                  View my CV
                </Button>
              </ALink>
              <ul className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Social profiles">
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
              <p className="text-center text-xs text-muted-foreground">
                {SITE.roleLine} · {SITE.location}
              </p>
            </div>
          </div>
        </aside>

        {/* story column */}
        <article>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">My story</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            About MOHAMMED NIHAD KP
          </h1>
          <div className="gold-rule mt-5 w-24" aria-hidden="true" />

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            {ABOUT_PARAGRAPHS.map((paragraph, index) => (
              <p key={index} className="text-pretty">
                {paragraph}
              </p>
            ))}
          </div>

          {/* pillars */}
          <div className="mt-12">
            <SectionHeading microLabel="What I bring" title="Three pillars" />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PILLARS.map((pillar, index) => {
                const PillarIcon = PILLAR_ICONS[index % PILLAR_ICONS.length];
                return (
                  <article key={pillar.title} className="rounded-xl border bg-card p-5 shadow-xs">
                    <span
                      aria-hidden="true"
                      className="flex size-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"
                    >
                      <PillarIcon className="size-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold tracking-tight">{pillar.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.text}</p>
                  </article>
                );
              })}
            </div>
          </div>

          {/* vision */}
          <section className="mt-12" aria-label="Global vision">
            <div className="rounded-2xl border border-gold/40 bg-gold/[0.05] p-6 md:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                {VISION.headline}
              </p>
              <p className="mt-4 text-balance text-xl font-medium leading-snug tracking-tight md:text-2xl">
                &ldquo;See all 195 countries — and leave every place better than I found it.&rdquo;
              </p>
              <div className="gold-rule mt-5 w-24" aria-hidden="true" />
              <ul className="mt-5 space-y-3">
                {VISION.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-relaxed md:text-base">
                    <Globe className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* exploring */}
          <section className="mt-12" aria-label="Currently exploring">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Currently exploring</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {EXPLORING.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-gold/30 bg-gold/[0.06] px-4 py-2 text-xs font-medium leading-snug text-foreground/90 md:text-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* education timeline */}
          <section className="mt-12" aria-label="Education">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Education &amp; credentials</h2>
            <ol className="mt-6 space-y-0 border-l border-gold/30 pl-6">
              {EDUCATION.map((entry) => (
                <li key={entry.title} className="relative pb-6 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[31px] top-1 size-2.5 rounded-full border-2 border-gold bg-background"
                  />
                  <h3 className="text-base font-semibold leading-snug tracking-tight">{entry.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{entry.note}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* stack */}
          <section className="mt-12" aria-label="Tools and stack">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">The stack I build on</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Build &amp; ship
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {STACK.build.map((tool) => (
                    <li
                      key={tool}
                      className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Creative media
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {STACK.creative.map((tool) => (
                    <li
                      key={tool}
                      className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* brands + projects */}
          <section className="mt-12" aria-label="Brands and projects">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Brands &amp; projects</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {BRANDS.map((brand) => (
                <article key={brand.name} className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">{brand.role}</p>
                  <h3 className="mt-2 text-base font-semibold tracking-tight">{brand.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
                  <div className="mt-auto pt-4">
                    <ALink
                      href={brand.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {brand.href.startsWith("#/") ? "Read the vision" : "Visit site"}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </ALink>
                  </div>
                </article>
              ))}
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {PROJECTS.map((project) => (
                <li key={project.name}>
                  <ALink
                    href={project.href}
                    title={project.description}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    {project.name}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </ALink>
                </li>
              ))}
            </ul>
          </section>

          {/* closing CTA */}
          <section className="mt-14 rounded-2xl border border-gold/40 bg-gold/[0.05] p-6 md:p-8">
            <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
              The short version? I get things shipped.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              If you need a website, an app, a shoot or a growth plan executed with AI-speed and
              human judgment — that is exactly what I do.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ALink href="/services">
                <Button className="gap-2">
                  See the services
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Button>
              </ALink>
              <ALink href="/contact">
                <Button variant="outline" className="gap-2 border-gold/50 text-gold hover:bg-gold/10">
                  Work with me
                </Button>
              </ALink>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
