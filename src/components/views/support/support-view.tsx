"use client";

/**
 * SupportView — route key "support" (#/support), the MN.KP Help Center.
 *
 * Sections: quick-help cards (WhatsApp / email / inquiry form), a searchable +
 * category-filterable FAQ accordion (lib/faq.ts), a gold "Still stuck?" CTA
 * band linking to the inquiry flow, and key legal doc links.
 *
 * SEO: route meta per BUILD CONTRACT §3 + FAQPage JSON-LD built from
 * FAQ_ITEMS (AEO-critical). Mobile-first; accordion rows are touch-friendly.
 */

import * as React from "react";
import {
  ArrowRight,
  FileText,
  Mail,
  MessageCircle,
  Scale,
  Search,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ALink } from "@/components/router/link";
import { SEOHead } from "@/components/shared/seo-head";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { NoResultsState } from "@/components/states";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SITE } from "@/lib/constants";
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategory } from "@/lib/faq";
import { getLegalDoc } from "@/lib/legal";

/* -------------------------------- constants ------------------------------- */

const SUPPORT_DESCRIPTION =
  "Answers about MN.KP services, affiliate orders, payments, privacy and more — plus fast ways to get help.";

type SupportTab = FaqCategory | "all";

const KEY_POLICY_SLUGS = ["privacy-policy", "refund-policy", "terms-of-service"] as const;

/* ------------------------------ quick help ------------------------------- */

interface QuickHelpCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  cta: string;
  /** Accessible hint for links that leave the site or open a mail client. */
  hint: string;
}

function QuickHelpCard({ icon: Icon, title, body, href, cta, hint }: QuickHelpCardProps) {
  return (
    <ALink
      href={href}
      aria-label={`${cta} — ${hint}`}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full gap-0 py-0 transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-gold/50 group-hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-semibold tracking-tight">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-gold">
            {cta}
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </CardContent>
      </Card>
    </ALink>
  );
}

/* -------------------------------- component ------------------------------- */

export default function SupportView() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<SupportTab>("all");

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesQuery =
        q === "" || `${item.question} ${item.answer}`.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const categoryLabel = (value: FaqCategory): string =>
    FAQ_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <SEOHead
        title="Support & Help Center — FAQ & Guides | MN.KP"
        description={SUPPORT_DESCRIPTION}
        canonicalPath="/support"
        noindex={false}
        jsonLd={faqJsonLd}
      />
      <Breadcrumbs
        items={[{ label: "Home", href: "#/" }, { label: "Support" }]}
        className="mb-8"
      />

      <header>
        <SectionHeading
          as="h1"
          microLabel="HELP CENTER"
          title="Support & Help Center"
          description="Fast answers about services, affiliate orders, payments, privacy and accounts — plus the fastest ways to reach a human in Calicut when the answer you need is not here."
        />
      </header>

      {/* ------------------------------ quick help ------------------------------ */}
      <section aria-labelledby="quick-help-heading" className="mt-12">
        <h2 id="quick-help-heading" className="text-lg font-semibold tracking-tight">
          Quick help
        </h2>
        <div aria-hidden="true" className="gold-rule mt-3 w-24" />
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <li>
            <QuickHelpCard
              icon={MessageCircle}
              title="WhatsApp"
              body="Fastest replies — usually within minutes on working days."
              href={SITE.whatsappUrl}
              cta="Chat now"
              hint="opens WhatsApp in a new tab"
            />
          </li>
          <li>
            <QuickHelpCard
              icon={Mail}
              title="Email"
              body="intobusyness@gmail.com — detailed questions answered within 24 hours."
              href="mailto:intobusyness@gmail.com"
              cta="Send email"
              hint="opens your email app"
            />
          </li>
          <li>
            <QuickHelpCard
              icon={Send}
              title="Inquiry form"
              body="Project quotes, collaborations and partnerships."
              href="#/contact"
              cta="Open the form"
              hint="goes to the contact page"
            />
          </li>
        </ul>
      </section>

      {/* --------------------------------- FAQ --------------------------------- */}
      <section aria-labelledby="faq-heading" className="mt-12">
        <h2 id="faq-heading" className="text-lg font-semibold tracking-tight">
          Frequently asked questions
        </h2>
        <div aria-hidden="true" className="gold-rule mt-3 w-24" />

        <div className="mt-6 flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search answers — try 'refund' or 'password'"
              aria-label="Search frequently asked questions"
              className="h-10 pl-9 sm:h-11"
            />
          </div>
          <Tabs
            value={category}
            onValueChange={(value) => setCategory(value as SupportTab)}
          >
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 scrollbar-slim sm:w-fit">
              {FAQ_CATEGORIES.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-none px-3 py-1.5 text-xs sm:text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {filteredItems.length === 0 ? (
          <NoResultsState
            query={query.trim() || null}
            onClear={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-4"
          />
        ) : (
          <Accordion
            type="single"
            collapsible
            className="mt-6 rounded-xl border bg-card px-4 sm:px-5"
          >
            {filteredItems.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="py-5 text-left text-sm font-medium hover:no-underline sm:text-base">
                  <span className="flex items-start gap-3 pr-2">
                    <Badge
                      variant="secondary"
                      className="mt-0.5 hidden shrink-0 border border-gold/30 bg-gold/10 text-xs font-medium text-gold sm:inline-flex"
                    >
                      {categoryLabel(item.category)}
                    </Badge>
                    <span>{item.question}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>

      {/* ----------------------------- still stuck ----------------------------- */}
      <section aria-labelledby="still-stuck-heading" className="mt-12">
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-6 md:p-8">
          <h2
            id="still-stuck-heading"
            className="text-xl font-semibold tracking-tight md:text-2xl"
          >
            Still stuck?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            If none of the answers above solved it, send an inquiry — it lands directly with
            MOHAMMED NIHAD KP in Calicut, Kerala, and you will hear back within 24 hours on
            working days. Pro and Business subscribers always get priority.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ALink href="#/contact">
              <Button className="gap-2">
                <Send className="size-4" aria-hidden="true" />
                Send an inquiry
              </Button>
            </ALink>
            <ALink href={SITE.whatsappUrl}>
              <Button variant="outline" className="gap-2">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp us
              </Button>
            </ALink>
            <ALink href="mailto:intobusyness@gmail.com">
              <Button variant="ghost" className="gap-2">
                <Mail className="size-4" aria-hidden="true" />
                Email us
              </Button>
            </ALink>
          </div>
        </div>
      </section>

      {/* ---------------------------- key policies ---------------------------- */}
      <section aria-labelledby="policies-heading" className="mt-12">
        <h2 id="policies-heading" className="text-lg font-semibold tracking-tight">
          Policies worth a read
        </h2>
        <div aria-hidden="true" className="gold-rule mt-3 w-24" />
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {KEY_POLICY_SLUGS.map((slug) => {
            const doc = getLegalDoc(slug);
            if (!doc) return null;
            return (
              <li key={slug}>
                <ALink
                  href={`#/legal/${doc.slug}`}
                  className="group flex h-full flex-col rounded-lg border p-4 outline-none transition-colors hover:border-gold/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gold">
                    <FileText className="size-3.5" aria-hidden="true" />
                    Policy
                  </span>
                  <span className="mt-2 font-semibold tracking-tight transition-colors group-hover:text-primary">
                    {doc.title}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {doc.description}
                  </span>
                </ALink>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Scale className="size-4 shrink-0 text-gold" aria-hidden="true" />
          Looking for something else? Browse{" "}
          <ALink
            href="#/legal"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            all legal and policy documents
          </ALink>
          .
        </p>
      </section>
    </div>
  );
}
