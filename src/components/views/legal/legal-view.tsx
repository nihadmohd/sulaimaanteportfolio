"use client";

/**
 * LegalView — route keys "legal" (#/legal index) and "legal-doc" (#/legal/:slug).
 *
 * Index: compliance hero + responsive grid of document cards (gold hover),
 * CollectionPage/ItemList JSON-LD for AEO/GEO.
 * Doc view: breadcrumbs, prose article (max-w-3xl), last-updated chip, print
 * button, sticky section TOC (lg+), prev/next document nav, related docs,
 * WebPage JSON-LD with dateModified. Unknown slugs render NotFoundState.
 *
 * In-page section links use scrollIntoView buttons — never href="#id" — so the
 * hash router's location.hash is never clobbered by fragment navigation.
 */

import * as React from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListTree,
  Mail,
  Printer,
} from "lucide-react";
import { useHashParams } from "@/hooks/use-hash-params";
import { ALink } from "@/components/router/link";
import { buildCanonical, SEOHead } from "@/components/shared/seo-head";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { NotFoundState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE } from "@/lib/constants";
import { getLegalDoc, LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { cn } from "@/lib/utils";

/* --------------------------------- helpers -------------------------------- */

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatLegalDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : dateFormatter.format(date);
}

function sectionAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Sensible sibling pairings for the "Related documents" row. */
const RELATED_DOCS: Record<string, string[]> = {
  "privacy-policy": ["cookie-policy", "data-processing-agreement", "security-policy"],
  "terms-of-service": ["acceptable-use-policy", "refund-policy", "disclaimer"],
  "cookie-policy": ["privacy-policy", "advertising-disclosure"],
  "refund-policy": ["cancellation-policy", "returns-policy", "shipping-policy"],
  "cancellation-policy": ["refund-policy", "returns-policy"],
  "shipping-policy": ["returns-policy", "refund-policy"],
  "returns-policy": ["shipping-policy", "refund-policy"],
  disclaimer: ["affiliate-disclosure", "earnings-disclaimer"],
  "accessibility-statement": ["privacy-policy", "community-guidelines"],
  "data-processing-agreement": ["privacy-policy", "security-policy"],
  "acceptable-use-policy": ["community-guidelines", "terms-of-service"],
  "security-policy": ["responsible-disclosure", "data-processing-agreement"],
  "responsible-disclosure": ["security-policy", "acceptable-use-policy"],
  "community-guidelines": ["acceptable-use-policy", "privacy-policy"],
  "affiliate-disclosure": ["advertising-disclosure", "editorial-policy", "earnings-disclaimer"],
  "advertising-disclosure": ["affiliate-disclosure", "editorial-policy"],
  "editorial-policy": ["affiliate-disclosure", "earnings-disclaimer"],
  "earnings-disclaimer": ["editorial-policy", "affiliate-disclosure", "disclaimer"],
};

function getRelatedDocs(doc: LegalDoc): LegalDoc[] {
  const picked: LegalDoc[] = [];
  const seen = new Set<string>([doc.slug]);
  const push = (slug: string): void => {
    const found = getLegalDoc(slug);
    if (found && !seen.has(slug)) {
      seen.add(slug);
      picked.push(found);
    }
  };
  (RELATED_DOCS[doc.slug] ?? []).forEach(push);
  // Top up with registry neighbours so every doc shows three related cards.
  if (picked.length < 3) {
    const index = LEGAL_DOCS.findIndex((d) => d.slug === doc.slug);
    for (let step = 1; step <= LEGAL_DOCS.length && picked.length < 3; step += 1) {
      if (index - step >= 0) push(LEGAL_DOCS[index - step].slug);
      if (index + step < LEGAL_DOCS.length) push(LEGAL_DOCS[index + step].slug);
    }
  }
  return picked.slice(0, 3);
}

/* ------------------------------- index view ------------------------------- */

const LEGAL_INDEX_DESCRIPTION =
  "Every MN.KP policy in one place: privacy, terms, cookies, refunds, shipping, returns, affiliate and advertising disclosures, security and accessibility.";

function LegalIndexView() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Legal & Policies",
    description: LEGAL_INDEX_DESCRIPTION,
    url: buildCanonical("/legal"),
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: LEGAL_DOCS.length,
      itemListElement: LEGAL_DOCS.map((doc, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: doc.title,
        url: buildCanonical(`/legal/${doc.slug}`),
      })),
    },
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <SEOHead
        title="Legal & Policies | MN.KP"
        description={LEGAL_INDEX_DESCRIPTION}
        canonicalPath="/legal"
        noindex={false}
        jsonLd={jsonLd}
      />
      <Breadcrumbs
        items={[{ label: "Home", href: "#/" }, { label: "Legal" }]}
        className="mb-8 print:hidden"
      />

      <header>
        <SectionHeading
          as="h1"
          microLabel="COMPLIANCE"
          title="Legal & Policies"
          description="The complete MN.KP registry — privacy, terms, commerce policies and disclosure documents, written in plain language for a platform run from Calicut, Kerala. Every document lists its last-updated date, prints cleanly, and answers to India's DPDP Act 2023 with GDPR and CCPA consideration for international visitors."
        />
      </header>

      <section aria-labelledby="legal-all-heading" className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="legal-all-heading" className="text-lg font-semibold tracking-tight">
            All documents
          </h2>
          <Badge
            variant="outline"
            className="border-gold/40 bg-gold/10 text-gold"
            aria-label={`${LEGAL_DOCS.length} policy documents`}
          >
            {LEGAL_DOCS.length} documents
          </Badge>
        </div>
        <div aria-hidden="true" className="gold-rule mt-3 w-24" />

        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LEGAL_DOCS.map((doc) => (
            <li key={doc.slug}>
              <ALink
                href={`#/legal/${doc.slug}`}
                className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${doc.title} — last updated ${formatLegalDate(doc.updated)}`}
              >
                <Card className="h-full gap-0 py-0 transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-gold/50 group-hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"
                      >
                        <FileText className="size-5" strokeWidth={1.75} />
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatLegalDate(doc.updated)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                      {doc.title}
                    </h3>
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {doc.description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-gold">
                      Read document
                      <ArrowRight
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </CardContent>
                </Card>
              </ALink>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Questions about any of these documents? Email{" "}
        <ALink
          href="mailto:intobusyness@gmail.com"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          intobusyness@gmail.com
        </ALink>{" "}
        or visit the{" "}
        <ALink
          href="#/support"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Help Center
        </ALink>{" "}
        — the support pages cross-link the policies people ask about most.
      </p>
    </div>
  );
}

/* -------------------------------- doc view -------------------------------- */

function LegalDocView({ doc }: { doc: LegalDoc }) {
  const anchors = React.useMemo(
    () => doc.sections.map((section) => sectionAnchor(section.heading)),
    [doc]
  );

  const docIndex = LEGAL_DOCS.findIndex((d) => d.slug === doc.slug);
  const prev = docIndex > 0 ? LEGAL_DOCS[docIndex - 1] : null;
  const next = docIndex < LEGAL_DOCS.length - 1 ? LEGAL_DOCS[docIndex + 1] : null;
  const related = React.useMemo(() => getRelatedDocs(doc), [doc]);

  const scrollToSection = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: doc.title,
    description: doc.description,
    url: buildCanonical(`/legal/${doc.slug}`),
    dateModified: doc.updated,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <SEOHead
        title={doc.title}
        description={doc.description}
        canonicalPath={`/legal/${doc.slug}`}
        noindex={false}
        jsonLd={jsonLd}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "#/" },
          { label: "Legal", href: "#/legal" },
          { label: doc.title },
        ]}
        className="mb-8 print:hidden"
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        {/* ------------------------------ article ------------------------------ */}
        <article className="min-w-0 max-w-3xl">
          <header className="border-b pb-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              MN.KP legal document
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              {doc.title}
            </h1>
            <div aria-hidden="true" className="gold-rule mt-5 w-24" />

            <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
              <Badge
                variant="outline"
                className="gap-1.5 border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold"
              >
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Last updated {formatLegalDate(doc.updated)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-2"
              >
                <Printer className="size-4" aria-hidden="true" />
                Print
              </Button>
            </div>

            <p className="mt-6 border-l-2 border-gold/40 pl-4 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              {doc.description}
            </p>
          </header>

          <div className="mt-10 space-y-12">
            {doc.sections.map((section, index) => {
              const id = anchors[index];
              return (
                <section key={id} id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
                  <h2
                    id={`${id}-heading`}
                    className="text-xl font-semibold tracking-tight md:text-2xl"
                  >
                    {section.heading}
                  </h2>
                  <div aria-hidden="true" className="gold-rule mt-3 w-16" />
                  <div className="mt-4 space-y-4">
                    {section.paragraphs.map((paragraph, pIndex) => (
                      <p
                        key={pIndex}
                        className="text-sm leading-7 text-muted-foreground md:text-[15px]"
                      >
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets ? (
                      <ul className="list-disc space-y-2.5 pl-5">
                        {section.bullets.map((bullet, bIndex) => (
                          <li
                            key={bIndex}
                            className="pl-1 text-sm leading-6 text-muted-foreground md:text-[15px]"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>

          <p className="mt-12 flex items-start gap-2 rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            <Mail className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
            <span>
              Questions about this document? Email{" "}
              <ALink
                href="mailto:intobusyness@gmail.com"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                intobusyness@gmail.com
              </ALink>{" "}
              or message WhatsApp{" "}
              <ALink
                href={SITE.whatsappUrl}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                +91 98467 50898
              </ALink>
              . This document is informational and may be updated — the date above always reflects
              the current version.
            </span>
          </p>

          {/* --------------------------- prev / next --------------------------- */}
          <nav
            aria-label="Document navigation"
            className="mt-8 grid gap-3 border-t pt-8 sm:grid-cols-2 print:hidden"
          >
            {prev ? (
              <ALink
                href={`#/legal/${prev.slug}`}
                className="group rounded-lg border p-4 outline-none transition-colors hover:border-gold/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <ChevronLeft
                    className="size-3.5 transition-transform group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                  Previous
                </span>
                <span className="mt-1.5 block font-semibold tracking-tight transition-colors group-hover:text-primary">
                  {prev.title}
                </span>
              </ALink>
            ) : (
              <span aria-hidden="true" className="hidden sm:block" />
            )}
            {next ? (
              <ALink
                href={`#/legal/${next.slug}`}
                className="group rounded-lg border p-4 text-right outline-none transition-colors hover:border-gold/50 focus-visible:ring-2 focus-visible:ring-ring sm:col-start-2"
              >
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Next
                  <ChevronRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1.5 block font-semibold tracking-tight transition-colors group-hover:text-primary">
                  {next.title}
                </span>
              </ALink>
            ) : null}
          </nav>

          {/* ------------------------- related documents ------------------------- */}
          <section aria-labelledby="related-docs-heading" className="mt-10 print:hidden">
            <h2 id="related-docs-heading" className="text-lg font-semibold tracking-tight">
              Related documents
            </h2>
            <div aria-hidden="true" className="gold-rule mt-3 w-16" />
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((rel) => (
                <li key={rel.slug}>
                  <ALink
                    href={`#/legal/${rel.slug}`}
                    className="group flex h-full flex-col rounded-lg border p-4 outline-none transition-colors hover:border-gold/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gold">
                      <FileText className="size-3.5" aria-hidden="true" />
                      Document
                    </span>
                    <span className="mt-2 font-semibold tracking-tight transition-colors group-hover:text-primary">
                      {rel.title}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {rel.description}
                    </span>
                  </ALink>
                </li>
              ))}
            </ul>
          </section>
        </article>

        {/* ------------------------------- TOC ------------------------------- */}
        <aside className="hidden lg:block print:hidden">
          <nav
            aria-label="Document sections"
            className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-slim pr-1"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <ListTree className="size-3.5 text-gold" aria-hidden="true" />
              On this page
            </p>
            <ul className="mt-3 space-y-0.5 border-l border-border">
              {doc.sections.map((section, index) => (
                <li key={anchors[index]}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(anchors[index])}
                    className="-ml-px w-full rounded-r-sm border-l-2 border-transparent py-1.5 pl-3 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {section.heading}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t pt-4">
              <ALink
                href="#/legal"
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium text-gold",
                  "underline-offset-4 hover:underline"
                )}
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                All policies
              </ALink>
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------- exports -------------------------------- */

export default function LegalView() {
  // Route "legal-doc" supplies slug; the "legal" index route leaves it absent.
  const { slug } = useHashParams<{ slug: string }>();

  if (!slug) return <LegalIndexView />;

  const doc = getLegalDoc(slug);
  if (!doc) return <NotFoundState path={`/legal/${slug}`} />;

  return <LegalDocView doc={doc} />;
}
