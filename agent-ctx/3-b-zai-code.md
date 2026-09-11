# Work Record — Task 3-b (Legal Registry, FAQ, Legal & Support Views)

Agent: Z.ai Code (build agent), MN.KP platform
Date context: BUILD CONTRACT v1 (worklog.md) + 3-a shared-component contracts.
Scope owned: src/lib/legal.ts, src/lib/faq.ts, src/components/views/legal/legal-view.tsx, src/components/views/support/support-view.tsx. No other files touched.

## What was built

### 1. src/lib/legal.ts
- `LegalDoc` interface exactly per spec: `{slug, title, description, updated, sections: Array<{heading, paragraphs: string[], bullets?: string[]}>}`.
- `LEGAL_DOCS: LegalDoc[]` — 18 docs, exact slug list and order:
  privacy-policy, terms-of-service, cookie-policy, refund-policy, cancellation-policy,
  shipping-policy, returns-policy, disclaimer, accessibility-statement,
  data-processing-agreement, acceptable-use-policy, security-policy,
  responsible-disclosure, community-guidelines, affiliate-disclosure,
  advertising-disclosure, editorial-policy, earnings-disclaimer.
- Helper `getLegalDoc(slug)` (undefined on unknown slug).
- Content quality: real India-aware legal text — DPDP Act 2023, IT Act 2000, GST,
  Copyright Act 1957, Consumer Protection (E-commerce) Rules 2020; GDPR/CCPA for
  international visitors; FTC 16 CFR Part 255 + ASCI for affiliate/ads. Specifics
  wired to the brand: Free / Pro ₹339→₹399 / Business ₹1,499 plans, Amazon Associates
  (amazon.in) + Flipkart programs, first-party MN.KP Digital products, 7-day digital
  refund window vs merchant-handled affiliate refunds, instant email delivery,
  Kozhikode jurisdiction, hello@mnkp.dev + WhatsApp +91 98467 50898 grievance contact.
- Invariants (verified by script): 18/18 slugs exact order; descriptions unique and
  ≤160 chars (max 142); title+" | MN.KP" ≤33 chars; ISO dates; 2-4 sections per doc;
  every single-paragraph section carries bullets; no empty strings.

### 2. src/lib/faq.ts
- `FAQ_ITEMS: FaqItem[]` — 15 AEO question-formulated items (all end with "?", answers
  80-400 chars, unique). Category split: services 3 / orders 4 / billing 3 / privacy 3 / support 2.
- Types `FaqItem` / `FaqCategory` ("services"|"orders"|"billing"|"privacy"|"support").
- `FAQ_CATEGORIES` ordered tab list incl. "all".
- Sample questions: "What services does MN.KP offer in Calicut?", "How fast is a typical
  website project?", "Do you work with clients outside Kerala?", "How do affiliate links
  work on this site?", "Can I get a refund on a digital template?", "Who handles shipping
  and returns…", "What's included in the Pro plan?", "Can I cancel my subscription
  anytime?", "How is my data handled?", "How do I reset my password?", "How fast do you
  reply to inquiries?" etc.

### 3. src/components/views/legal/legal-view.tsx (default export)
- Handles BOTH "legal" (#/legal) and "legal-doc" (#/legal/:slug) via
  `useHashParams<{slug: string}>()` — slug absent → index.
- Index: Breadcrumbs, SectionHeading(micro "COMPLIANCE"), "18 documents" gold badge,
  responsive 1/2/3-col card grid (FileText gold medallion, description clamp-3, updated
  date, gold hover+lift), cross-links to mailto + #/support; SEOHead
  "Legal & Policies | MN.KP" + unique description + canonical /legal + noindex false +
  CollectionPage/ItemList JSON-LD (all 18 docs).
- Doc: Breadcrumbs(Home/Legal/title), article max-w-3xl, lead description, gold
  "Last updated <d MMM yyyy>" chip + Print button (window.print()), sections with h2
  anchor ids (scroll-mt-24), sticky lg-only TOC sidebar (scrollIntoView buttons — NOT
  fragment hrefs, to protect the hash router), prev/next registry-order nav,
  3 related-doc cards (RELATED_DOCS sibling map + neighbour top-up), contact note;
  SEOHead(doc.title, doc.description, canonical /legal/:slug) + WebPage JSON-LD
  {name, description, url, dateModified}. Unknown slug → NotFoundState(path).
  print:hidden applied to non-document chrome.

### 4. src/components/views/support/support-view.tsx (default export)
- Route key "support". Breadcrumbs(Home/Support), SectionHeading(micro "HELP CENTER").
- Quick-help cards: WhatsApp (SITE.whatsappUrl, external, aria hint), Email
  (mailto:hello@mnkp.dev), Inquiry form (#/contact).
- FAQ: search Input (h-10/11 touch-friendly) + category Tabs (FAQ_CATEGORIES,
  horizontally scrollable on mobile) → shadcn Accordion (py-5 rows, category badge,
  hover:no-underline); NoResultsState(query, onClear) when filtered empty.
- "Still stuck?" gold-bordered CTA band → #/contact / WhatsApp / email.
- "Policies worth a read": privacy-policy, refund-policy, terms-of-service pulled live
  from LEGAL_DOCS + link to #/legal.
- SEOHead per §3 + FAQPage JSON-LD from all FAQ_ITEMS (AEO critical).

## Verification
- `bun run lint`: zero issues in my 4 files (remaining project errors are other agents'
  files: api/_lib/serialize.ts ×2, auth views warnings — untouched).
- `bunx tsc --noEmit`: zero errors in my files (only pre-existing skills/* errors).
- Invariant script (bun one-off): all checks green (see above).
- SSR smoke render (throwaway file, deleted): index 18 cards; privacy-policy doc full
  chrome (breadcrumb/chip/Print/TOC/prev-next/related); unknown slug → NotFoundState;
  support renders all 15 questions, search, all 6 tabs, WhatsApp/mailto/contact/legal
  links. ("What's included in the Pro plan?" matches post-HTML-escape — confirmed.)
- dev.log tail: clean; other agents' API routes 200; nothing from my files (not yet
  wired into viewRegistry).

## Deviations (documented in worklog too)
1. support-view path = src/components/views/support/support-view.tsx (folder-per-route
   per task instruction + 4-a pattern), NOT the flat path in worklog §5 — orchestrator
   must wire viewRegistry["support"] accordingly.
2. TOC links are buttons + scrollIntoView (fragment hrefs would break hash routing).
3. FAQ_ITEMS = 15 items (~14 asked) for balanced categories.
4. Extra exports: getLegalDoc, FAQ_CATEGORIES, FaqItem/FaqCategory types.

## Handoff
- Task 8 wiring: "legal" + "legal-doc" → views/legal/legal-view; "support" →
  views/support/support-view (both default exports, no props).
- 6-a: FAQ_ITEMS/FAQ_CATEGORIES/FaqItem/FaqCategory importable from "@/lib/faq".
- 4-a: deep-link targets ready — #/legal/refund-policy, #/legal/shipping-policy,
  #/legal/returns-policy, #/legal/affiliate-disclosure.
- sitemap/llms.txt: iterate LEGAL_DOCS for 18 canonical /legal/:slug URLs with dates.
