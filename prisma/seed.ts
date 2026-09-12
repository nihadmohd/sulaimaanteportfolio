/**
 * MN.KP — database seed (BUILD CONTRACT v1 §6 — binding spec).
 *
 * Run with:  bun prisma/seed.ts
 *
 * Idempotent by design: every row with a natural unique key (email, slug,
 * code, key) is upserted; inquiries (no unique key) are
 * create-if-missing. Re-running restores canonical seed state without
 * duplicating rows.
 *
 * NOTE: the two sticker values in the `media` setting contain literal
 * emoji characters — they are DATABASE DATA (rendered by the UI when
 * enabled), not source-file styling, and are the only emoji in this file.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { FOOTER_DEFAULT, SITE, SOCIALS } from "../src/lib/constants";

const db = new PrismaClient();

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);
const daysFromNow = (days: number): Date => new Date(Date.now() + days * 86_400_000);

/** camelCase socials record derived from the orchestrator-owned SOCIALS list. */
function socialsRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of SOCIALS) {
    const key = s.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/ (.)/g, (_all, c: string) => c.toUpperCase());
    out[key] = s.url;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* seed content: categories                                            */
/* ------------------------------------------------------------------ */

const BLOG_CATEGORIES = [
  {
    slug: "ai-development",
    name: "AI & Development",
    description: "AI-first workflows, tools and practical web development notes.",
    sortOrder: 0,
  },
  {
    slug: "business",
    name: "Business & Freelancing",
    description: "Running a services business from Kerala for clients worldwide.",
    sortOrder: 1,
  },
  {
    slug: "creative-media",
    name: "Creative Media",
    description: "Photography, videography and the editing stacks behind them.",
    sortOrder: 2,
  },
  {
    slug: "career",
    name: "Career & Learning",
    description: "Diploma-to-developer journeys, upskilling and AI-era careers.",
    sortOrder: 3,
  },
  {
    slug: "tutorials",
    name: "Tutorials",
    description: "Step-by-step guides you can follow in an afternoon.",
    sortOrder: 4,
  },
];

const STORE_CATEGORIES = [
  {
    slug: "audio",
    name: "Audio",
    description: "Headphones and audio gear for deep work and production.",
    sortOrder: 0,
  },
  {
    slug: "creator-gear",
    name: "Creator Gear",
    description: "Cameras, keyboards and mice rated for daily creator abuse.",
    sortOrder: 1,
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Power, storage and everyday carry that survives real work.",
    sortOrder: 2,
  },
  {
    slug: "digital",
    name: "Digital Products",
    description: "Templates, presets and packs built by MN.KP itself.",
    sortOrder: 3,
  },
];

/* ------------------------------------------------------------------ */
/* seed content: posts (BUILD CONTRACT §6 — exact slugs/covers/tags)   */
/* ------------------------------------------------------------------ */

interface PostSeed {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  categorySlug: string;
  tags: string[];
  readingTimeMinutes: number;
  viewsCount: number;
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  publishedDaysAgo: number;
}

const POSTS: PostSeed[] = [
  {
    slug: "ai-development-workflow-calicut",
    title: "Inside My AI-Powered Development Workflow in Calicut",
    excerpt:
      "The exact AI-first workflow I use to take client projects from a WhatsApp message to a deployed product — planning, prompting, reviewing and shipping.",
    coverImageUrl: "/images/blog/blog-ai-workflow.png",
    categorySlug: "ai-development",
    tags: ["ai-tools", "workflow", "web-development"],
    readingTimeMinutes: 7,
    viewsCount: 1860,
    seoTitle: "My AI-Powered Development Workflow in Calicut | MN.KP",
    seoDescription:
      "A practical look at the AI-first workflow I use in Calicut to ship websites and apps in days — tools, quality checks and honest limits.",
    isFeatured: false,
    publishedDaysAgo: 18,
    content: `# Inside My AI-Powered Development Workflow in Calicut

> **TL;DR:** I stopped writing every line of code by hand. A disciplined AI workflow — plan first, prompt in small chunks, review everything, test relentlessly — lets me deliver client websites and apps in days instead of months. This is the exact process, from first message to deployment.

Every project that lands in my inbox starts the same way: a WhatsApp message, a rough idea, and a deadline that is usually "as soon as possible." What happens next is a workflow I have refined across dozens of builds — one where AI does the heavy lifting and I supply the judgment. Here is how it works, step by step.

## What Does an AI-First Workflow Actually Look Like?

![The AI-first development workspace behind MN.KP projects](/images/blog/blog-ai-workflow.png)

An AI-first workflow does not mean typing "build me a website" and shipping whatever comes back. It means treating AI like a brilliant junior developer with infinite stamina and zero memory: exceptional at producing, unreliable at deciding.

My process runs in four stages:

1. **Plan** — I break the project into small, testable units: pages, components, API routes, database tables. This happens in a markdown file before any AI tool is opened.
2. **Prompt** — each unit gets its own focused conversation. Small prompts produce reviewable code; monster prompts produce spaghetti.
3. **Review** — every generated block gets read line by line. If I cannot explain what a block does, it does not ship.
4. **Verify** — manual testing on real devices, edge cases, slow-network checks, then deployment.

## Which AI Tools Sit at the Center of the Workflow?

### The Planner

Before code, I use a conversational model to stress-test the idea itself: What happens when two users book the same slot? What breaks if the client edits 10,000 rows at once? Who sees the admin panel? Interrogating the plan is cheaper than debugging the product.

### The Builder

For code generation I work in vertical slices — one feature, fully wired, from interface to database. A slice small enough to review in ten minutes is a slice small enough to trust. Larger features get decomposed until every piece fits that bar.

### The Verifier

The most underrated use of AI in my stack: feeding it my own finished code and asking it to find bugs, missing error handling and security holes. It catches the obvious so I can hunt the subtle. On payment flows and auth, this second pass has paid for itself many times over.

## How Do I Keep AI-Generated Code Reliable?

Three hard rules, none of them optional:

- **Nothing ships unread.** Generated code is a draft, never a deliverable.
- **Patterns over one-offs.** I keep a personal library of prompts, scaffolds and snippets that have survived real projects. If a pattern worked in production three times, it earns reuse.
- **Testing is not optional.** Every form, every payment flow, every admin action gets exercised manually before handover — including on low-end Android devices, because Calicut clients and their customers are rarely on flagship phones.

## How Much Faster Is AI-Assisted Development Really?

Honest numbers from recent work: a marketing site that once took three to four weeks now ships in four to six days. A booking app with payments and an admin dashboard took eleven days end to end. The bottleneck moved from typing code to making decisions — which is exactly where a freelancer's value should live.

The speed is real, but the compounding effect matters more. Faster delivery means more projects per month, more feedback per project, and a learning loop a solo developer simply could not access five years ago.

## Where Does a Real Client Project Fit In?

This workflow powers everything I ship through [my services](#/services) — from landing pages to full web apps with payments and admin panels. When a project needs hardware to match the software, I point clients to gear I have actually tested in the [affiliate store](#/store).

For the tool side of this equation, I broke down the [best AI tools for rapid development in 2025](#/blog/best-ai-tools-rapid-development-2025) in a separate deep-dive.

## Frequently Asked Questions

### How much does an AI-powered website cost?

Most client websites land between ₹4,999 and ₹25,000 depending on pages, integrations and content. Because the workflow compresses build time, the price reflects decisions and polish rather than hours of manual typing.

### Do you still write code by hand?

Yes — for architecture, tricky logic and anything the AI gets visibly wrong. AI writes the scaffolding; I own the judgment. Roughly 70 percent generated, 30 percent hand-finished and reviewed.

### Can I hire you from outside Kerala?

Absolutely. I run projects for clients across time zones from Calicut. Async updates, weekly demos and clear written scopes keep the distance irrelevant.`,
  },
  {
    slug: "best-ai-tools-rapid-development-2025",
    title: "The Best AI Tools for Rapid Development in 2025",
    excerpt:
      "Every AI tool in my 2025 stack, rated by what it actually does on a real client project — planning, code generation, review, testing and shipping.",
    coverImageUrl: "/images/blog/blog-ai-tools.png",
    categorySlug: "ai-development",
    tags: ["ai-tools", "reviews", "productivity"],
    readingTimeMinutes: 8,
    viewsCount: 2400,
    seoTitle: "Best AI Tools for Rapid Development in 2025 | MN.KP",
    seoDescription:
      "The AI tools I actually use in 2025 to plan, build, test and ship software faster — with honest notes on where each one earns its keep.",
    isFeatured: false,
    publishedDaysAgo: 12,
    content: `# The Best AI Tools for Rapid Development in 2025

> **TL;DR:** A stack of AI tools carries my entire freelance practice in 2025 — one for thinking, two for code, one for review, two for content and one for automation. This is the honest, project-tested breakdown of what each is good at, and where it wastes your time.

The AI tools market is loud. Every week a new assistant promises to replace developers, and every week a project deadline quietly ignores the hype. What follows is the stack I actually run client projects with — tools that survived contact with real requirements, real clients and real deadlines in Calicut.

## Which AI Coding Assist Actually Writes Production Code?

![The 2025 AI tool stack behind MN.KP builds](/images/blog/blog-ai-tools.png)

The headline question of the year. My answer after twelve months of daily use: the frontier chat models are genuinely production-grade for web work — with caveats.

**Where they shine:** scaffolding components, writing repetitive CRUD logic, explaining unfamiliar code, converting designs into responsive markup, drafting database schemas and generating test cases. On a typical project these tasks are 60 to 70 percent of the code volume.

**Where they fail:** long-range architecture decisions, multi-file refactors across large legacy codebases, and anything requiring taste. A model will happily hand you three confidently wrong database designs in a row.

The winning move is using them as a tireless junior developer whose output you review — not an architect whose output you trust.

## What About Design, Copy and Assets?

Rapid development is not just code. Three categories of tool do the non-code lifting:

1. **Copy drafting** — first drafts of landing copy, blog outlines and email sequences. I rewrite heavily, but starting from a draft triples my throughput.
2. **Image generation** — hero art, mockups, brand visuals and social preview images. The cover on this very post started as an AI draft, then got color-graded by hand.
3. **UI exploration** — generating layout variations before committing to one. It is cheaper to argue with a mockup than with a finished build.

## How Do I Stack These Tools Into One Workflow?

The stack matters less than the pipeline. Mine looks like this:

- **Think** with a conversational model — interrogate requirements, list edge cases, define what "done" means.
- **Plan** the build as small vertical slices, each independently testable.
- **Generate** each slice with a coding assistant, one focused session per slice.
- **Review** every change myself, then feed it back for a second-opinion pass.
- **Test** on real devices — especially affordable Android phones, because that is what most real audiences in Kerala hold.
- **Ship** through one-command deploys, then watch analytics for a week.

## Are Free AI Tools Enough to Start?

Yes — genuinely. Every category above has a free tier good enough to learn on. The paid tiers buy speed and longer context, not talent. A disciplined free-tier workflow beats a lazy premium one every single time.

If you are choosing where to spend money first: pay for the coding assistant, stay free everywhere else until revenue says otherwise.

## Where Should You Go From Here?

Two suggestions, depending on who you are:

- **Need a product built?** My [AI-powered development services](#/services) ship exactly this workflow as a service — websites, apps and automations, delivered in days.
- **Building it yourself?** Skim the [affiliate store](#/store) for the gear I test and recommend — a comfortable keyboard and proper audio honestly do more for your output than one more subscription.

For the workflow behind this list, read [the AI development process I use in Calicut](#/blog/ai-development-workflow-calicut) — the two posts pair together.

## Frequently Asked Questions

### Which single AI tool should a beginner pick in 2025?

One strong conversational model, used daily and well. Depth beats breadth: mastery of one assistant outperforms shallow familiarity with five.

### Do AI tools replace computer science fundamentals?

No. Data structures, HTTP, databases and security awareness are what let you evaluate generated code. The stronger your fundamentals, the more dangerous your AI leverage.

### How do I avoid shipping buggy AI code?

Small slices, mandatory human review, and manual testing on real devices. If you cannot explain a line, delete it or learn it — never ship it blind.`,
  },
  {
    slug: "freelancing-from-calicut-global-business",
    title: "Freelancing From Calicut: Building a Global Business From Kerala",
    excerpt:
      "Running a freelance business from Calicut while serving clients on three continents — the systems, pricing and mindset that make it work.",
    coverImageUrl: "/images/blog/blog-freelance-calicut.png",
    categorySlug: "business",
    tags: ["freelancing", "business", "kerala"],
    readingTimeMinutes: 6,
    viewsCount: 610,
    seoTitle: "Freelancing From Calicut: A Global Business From Kerala",
    seoDescription:
      "How a freelancer in Calicut serves clients worldwide — pricing, pipelines, tools and the mindset behind a borderless service business.",
    isFeatured: false,
    publishedDaysAgo: 41,
    content: `# Freelancing From Calicut: Building a Global Business From Kerala

> **TL;DR:** You do not need to move to a metro city — or abroad — to run a serious freelance business. From Calicut, I serve clients across time zones with three systems: productized services, ruthless communication, and pricing anchored to value instead of geography. Here is the playbook.

Kozhikode is not Berlin, Bangalore or New York. There is no co-working scene handing out investor introductions, no meetup where recruiters hand you retainers. And yet, from a desk here in Calicut, I run a business that ships websites for clients I have never met, in countries I have not yet visited.

This post is about the mechanics of that — because "work hard" is not a strategy.

## Why Build a Freelance Business From Calicut?

![Freelancing from Calicut to the world](/images/blog/blog-freelance-calicut.png)

The honest reasons are cost and leverage. My overhead is a fraction of what it would be in a metro, which means a Kerala freelancer can price competitively for global clients without racing to the bottom. A project that looks small to a European agency is a serious month for a solo operator here — that arbitrage is a moat, not a shame.

But the deeper reason is quality of life. I can take on a client in Dubai, another in Singapore and one in Kerala, work early mornings and evenings to overlap their hours, and still keep my afternoons. Calicut is quiet in the best possible way.

## What Does a Global Client Pipeline Look Like?

Clients arrive through four channels, in rough order of importance:

1. **Referrals** — every finished project is asked, gently, "who else needs this?"
2. **Portfolio content** — this very blog. Writing publicly about what I build is the highest-leverage marketing a solo business can do.
3. **Social presence** — LinkedIn and Instagram, maintained weekly, not hourly.
4. **Marketplaces** — used sparingly, mostly to fill gaps between direct projects.

The pipeline is deliberately boring. No funnels, no paid ads — just work that talks about itself.

## How Do You Price Services for International Clients?

Two rules. First, never quote hourly — quote outcomes: a five-page website with booking, delivered in ten days, costs a fixed number. Second, anchor to the value of the deliverable, discounted honestly for my cost base, never inflated to match Western rates I cannot yet justify with references.

Every quote includes scope, timeline, revision limits and a payment split — 50 percent upfront, 50 percent on delivery. Clear scopes are what keep cross-border relationships friendly years later.

## What Tools Keep a Solo Business Organized?

A small, stable stack: WhatsApp Business for client chat (it is what clients actually use), Google Workspace for documents and email, Notion for project trackers and the knowledge base, and Razorpay or Wise for payments across currencies. The goal is not a fancy stack — it is a stack you never have to think about.

## Where Do You Go From Here?

If you are a business owner reading this, the practical next step is simple: look at [the services I offer](#/services) and see whether one of them matches a problem you have today. If you are a fellow freelancer in Kerala, browse the [tools and gear I actually use](#/store) — and for the bigger picture, read [the KP Foundation vision](#/blog/kp-foundation-platform-vision), where all of this is heading.

## Frequently Asked Questions

### Do international clients care that you are based in Kerala?

Almost never — after the first delivery. Credibility comes from response time, demos and finished work, not your pincode.

### How do you handle payments from abroad?

Wise, Razorpay international links and PayPal where necessary. Payment terms go in the quote, always before work begins.

### What is the biggest mistake new freelancers make?

Underpricing "to get started" and then being trapped at that rate. Start slightly higher than comfortable and deliver slightly more than promised.`,
  },
  {
    slug: "photography-ai-editing-stack",
    title: "My Photography and AI Editing Stack, Explained",
    excerpt:
      "Portrait and product photography in Calicut, powered by a Lightroom-plus-AI editing pipeline — what I shoot with, and how much of the polish is software.",
    coverImageUrl: "/images/blog/blog-photo-ai-editing.png",
    categorySlug: "creative-media",
    tags: ["photography", "editing", "ai"],
    readingTimeMinutes: 4,
    viewsCount: 380,
    seoTitle: "My Photography and AI Photo Editing Stack | MN.KP",
    seoDescription:
      "The cameras, Lightroom presets and AI editing tools behind my portrait and product photography in Calicut — and when AI helps versus harms.",
    isFeatured: false,
    publishedDaysAgo: 28,
    content: `# My Photography and AI Editing Stack, Explained

> **TL;DR:** I shoot portraits, products and events in and around Calicut with a compact, deliberate kit, then finish every frame through a Lightroom-plus-AI pipeline that cuts my editing time by roughly 60 percent. Here is the full stack — and the line I refuse to cross with AI.

Photography was my first business. Before web development paid a single rupee, I was shooting portraits for families in Kozhikode and product shots for small stores — learning that clients do not buy photographs, they buy the way photographs make them feel.

The tools have changed dramatically since then. This is the current stack, end to end.

## What Is Actually in the Camera Bag?

![The photography and AI editing pipeline](/images/blog/blog-photo-ai-editing.png)

I keep the kit deliberately small:

- One mirrorless body with a fast prime for portraits
- A zoom for events where changing lenses loses moments
- Two LED panels and a foldable reflector — Calicut's monsoon clouds are not a reliable light source
- A tripod that has survived more beach shoots than I will admit

Small kit, fewer decisions, better photographs.

## How Does AI Change Photo Editing?

Three concrete changes to my workflow:

1. **Culling** — AI-assisted sorting flags blinks, blur and duplicates in minutes instead of hours. On a 900-shot event, this alone saves an evening.
2. **Masking** — what used to be careful brushwork on sky, subject and background is now a one-click starting point that I refine by hand.
3. **Retouching** — skin cleanup that took twenty minutes per portrait now takes five, and looks more natural, because the machine handles repetition while I handle taste.

The pipeline is Lightroom for global adjustments and AI masking, then targeted tools for specific jobs. Nothing gets exported until it passes one test: would this look right printed and framed?

## Which Editing Tools Do I Actually Use?

Lightroom carries 80 percent of the load. Beyond it, I keep a small rotation: an AI upscaler for older low-resolution client files, a denoiser for dim venue shots, and preset packs I built myself so my color signature stays consistent across every delivery.

That consistency is the product. When a client books me, they are booking a look — and presets plus a fixed pipeline are what make that look repeatable at scale.

## Should You Hire a Photographer Who Uses AI?

Yes — with one question asked: "what does your AI not do?" My answer: it does not compose, it does not light, and it does not decide what matters in a frame. AI polishes photographs; it does not take them. If someone's portfolio is mostly AI-generated scenes, you are buying illustration, not photography — different craft, different price.

## Where Does This Fit Into MN.KP?

Photography is one of the five services I run from Calicut — [see the full list here](#/services). If you are a creator building your own kit, the store has the [audio and camera gear I genuinely rate](#/store). And if you enjoyed this, the story of [how a diploma student ended up running five services](#/blog/diploma-to-ai-developer) explains the strange route here.

## Frequently Asked Questions

### Do you deliver RAW files?

No — edited JPEGs and web-optimized versions are the deliverable. The edit is half the photograph; RAW files are my negatives.

### Can AI fix a badly blurred photo?

Mostly no. Minor camera-shake recovery is real; motion blur and missed focus usually are not savable. Get it right in camera — that is still the job.

### How long does a portrait session take to turn around?

Shooting takes one to two hours; delivery within a week, because the AI-assisted pipeline compresses editing without cutting quality.`,
  },
  {
    slug: "diploma-to-ai-developer",
    title: "From Engineering Diploma to AI-First Developer: My Journey",
    excerpt:
      "A Computer Engineering diploma in Kerala, a stubborn refusal to learn the slow way, and the AI-first career that came out of it — lessons included.",
    coverImageUrl: "/images/blog/blog-career-journey.png",
    categorySlug: "career",
    tags: ["career", "learning", "ai"],
    readingTimeMinutes: 6,
    viewsCount: 1520,
    seoTitle: "From Engineering Diploma to AI-First Developer | MN.KP",
    seoDescription:
      "My journey from a computer engineering diploma in Kerala to AI-first development — what I learned, what I would skip, and how you can start too.",
    isFeatured: false,
    publishedDaysAgo: 55,
    content: `# From Engineering Diploma to AI-First Developer: My Journey

> **TL;DR:** I hold a Computer Engineering diploma — not the prestigious degree people expect behind the work I ship. The gap between the two was closed by AI tools, relentless building and a simple rule: never learn anything twice. This is the route, the mistakes and the advice that survived it.

There is a moment every non-traditional developer knows. Someone sees your work, is impressed, then asks where you studied. The answer — a polytechnic diploma in computer engineering — rearranges their face. You learn to enjoy that moment.

## Why Did a Diploma Student Bet on AI?

![The journey from diploma classrooms to AI-first development](/images/blog/blog-career-journey.png)

The diploma gave me fundamentals: circuits, C programming, networking, databases. What it did not give me was time. A three-year syllabus moves slower than three months of the software industry, and I could feel the gap widening while I sat in classrooms.

The choice was never "AI or traditional learning." It was "learn faster or fall behind." AI tools became my unfair advantage: a tutor available at 2 a.m., a code reviewer with infinite patience, a study partner that never judged the stupid version of my questions.

## What Did Learning AI-First Development Look Like?

Three habits carried everything:

1. **Build, then learn.** I started projects slightly beyond my skill and let the requirements pull the knowledge in. A client wanted a booking system — that week I learned databases properly. Motivation first, curriculum second.
2. **Never learn anything twice.** Every solved problem became a note, a prompt or a reusable snippet. My personal knowledge base is worth more than any certificate I could buy.
3. **Ship publicly.** Every finished project went live and onto a portfolio. Ten shipped small projects teach more than one perfect abandoned big one.

The stack I actually learned on — Firebase, Vercel, Supabase, modern AI assistants — let me deliver production software without first owning a server or a dev-ops career. That compression is the entire story.

## What Would I Tell Someone Starting Today?

- **Your credential is your portfolio.** Nobody has ever asked me for a marksheet after seeing a live product with my name on it.
- **Use AI to learn, not to skip learning.** There is a difference between code you can explain and code you can only paste. Interviewers, clients and production incidents can tell them apart instantly.
- **Pick boring fundamentals.** HTTP, databases, git, security basics. The flashier the tool, the faster it dates; fundamentals compound for decades.
- **Find your unfair angle.** Mine was combining development with photography and business strategy — three ordinary skills that become rare stacked together.

## Where Is This Heading?

Today I run five services under one practice — development, training, photography, videography and marketing — and the long game is [KP Foundation, one platform for every business](#/blog/kp-foundation-platform-vision). If you are a business owner rather than a learner, [the services page](#/services) is the practical entry point. If you are building your own creator setup, the [store](#/store) has the gear I use daily.

## Frequently Asked Questions

### Can you become a developer with just a diploma?

Yes — with evidence. A diploma plus shipped projects beats a degree plus none. The industry pays for what you can demonstrate, not attend.

### How long does it take to learn AI-first development?

Six focused months to employable, in my honest estimate: fundamentals, one strong AI assistant used daily, and three shipped projects that real people use.

### Is AI going to replace junior developers?

It is going to replace juniors who only paste. Juniors who review, test and understand generated code become seniors unusually fast — the leverage cuts both ways.`,
  },
  {
    slug: "kp-foundation-platform-vision",
    title: "KP Foundation: One Platform for Every Business Vision",
    excerpt:
      "KP Foundation is the parent idea: one platform, three brands, every kind of business born under a single roof — the vision and the first steps.",
    coverImageUrl: "/images/blog/blog-kp-foundation.png",
    categorySlug: "business",
    tags: ["kp-foundation", "business", "vision"],
    readingTimeMinutes: 5,
    viewsCount: 940,
    seoTitle: "KP Foundation: One Platform for Every Business | MN.KP",
    seoDescription:
      "The vision behind KP Foundation — one Calicut-born platform where services, commerce, community and education grow under a single roof.",
    isFeatured: true,
    publishedDaysAgo: 5,
    content: `# KP Foundation: One Platform for Every Business Vision

> **TL;DR:** KP Foundation is the parent organization I am building from Calicut — one roof under which services, commerce, community and education live together. It already has three brands and shipped platforms. This post is the vision, the reasoning and what launches next.

Most people meet my work through one brand — a website delivered, a photograph edited, a store listing. But the individual services were never the point. They are load-bearing columns for something bigger: KP Foundation, an all-in-one business platform where every kind of business is born under one roof.

## What Is KP Foundation?

![The KP Foundation vision — one roof, every business](/images/blog/blog-kp-foundation.png)

Structurally, it is a parent platform with three brands inside it today:

- **KP Foundation** — the flagship: the services engine, this website, the education arm and everything the umbrella stands for.
- **Calicut Store** — curated commerce for Calicut: local finds and trusted essentials, delivered simply.
- **Chaliyam** — a free service facility for the community of Chaliyam, because a platform that only takes is not a foundation.

Under those brands sit shipped platforms: Chaliyam Connect for community connection, Calicut Gold for jewelry commerce, and PolyStudy for polytechnic students. Each one started as a real need someone brought to me, and each one proved the same thesis — when services, tools and audience live on one platform, every new business is born with a running start.

## Why Build One Platform for Every Business?

Because fragmentation is the tax on small business. A boutique in Calicut today buys a website from one vendor, marketing from another, photography from a third, and training from nobody. Every handoff loses context, money and weeks.

One platform flips the model: the same team that builds your store can shoot your product photos, run your growth and train your staff — because the context never leaves the building. For clients that means speed and coherence. For the platform it means every service strengthens every other service.

## How Do the Brands Fit Together?

Think of it as layers. The Foundation supplies identity, principles and shared capability. The brands own their audiences — commerce for Calicut Store, community for Chaliyam, services and education for KP Foundation itself. Platforms under the brands own specific jobs: connect people, sell gold, help students study.

New ventures plug into existing rails instead of starting from zero. That is the compounding bet: each launch is cheaper and faster than the last, until "every kind of business under one roof" stops being a slogan and becomes an operating system.

## What About the Longer Arc?

The honest version: this platform funds and trains a life built around it. KP Foundation exists so that a freelancer in Calicut can grow a global practice, and so that the people who learn here — clients, students, community — inherit the tools instead of renting them. Education is not a side project here; teaching AI-first execution is half the reason the platform exists.

The near-term roadmap is deliberately concrete: deepen the [services engine](#/services), grow the honestly-curated [affiliate store](#/store) into a trusted gear authority, and keep publishing the working notes — like [the AI workflow that makes all of this possible](#/blog/ai-development-workflow-calicut) — on this blog.

## Frequently Asked Questions

### Is KP Foundation hiring or partnering?

Both, informally. The partnership inbox is open — serious proposals get replies within 48 hours through the contact page.

### What does "every kind of business" actually mean?

Services, commerce, community and education. If a venture needs building, selling, storytelling or teaching, it fits under the roof.

### Can I start my business under KP Foundation today?

Yes — that is literally the pitch. Bring the idea; the platform brings execution. Book a conversation through the services page and the answer will be concrete within a day.`,
  },
];

/* ------------------------------------------------------------------ */
/* seed content: products (BUILD CONTRACT §6 — exact slugs/prices)     */
/* ------------------------------------------------------------------ */

interface ProductSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  brand: string;
  merchant: string;
  imageUrl: string | null;
  price: number | null;
  compareAtPrice: number | null;
  affiliateUrl: string;
  pros: string[];
  cons: string[];
  keySpecs: Record<string, string>;
  rating: number;
  reviewCount: number;
  clicksCount: number;
  isFeatured: boolean;
  categorySlug: string;
}

const PRODUCTS: ProductSeed[] = [
  {
    slug: "sony-wh-1000xm5",
    name: "Sony WH-1000XM5 Wireless Headphones",
    tagline: "The noise-cancelling benchmark for deep work and travel",
    brand: "Sony",
    merchant: "Amazon",
    imageUrl: "/images/store/prod-headphones.png",
    price: 29990,
    compareAtPrice: 34990,
    affiliateUrl: "https://www.amazon.in/dp/B09XS7JWHH?tag=mnkp-21",
    pros: [
      "Best-in-class noise cancellation",
      "30-hour real-world battery",
      "Crystal-clear call quality",
      "Multipoint pairing with two devices",
      "LDAC hi-res audio on Android",
    ],
    cons: [
      "Premium pricing in India",
      "No fold-flat hinge for compact storage",
      "Touch controls take a week to learn",
    ],
    keySpecs: {
      Battery: "30 hours with ANC on",
      Weight: "250 g",
      Driver: "30 mm carbon fiber composite",
      Charging: "USB-C, 3-min quick charge = 3 hours",
      Codecs: "SBC, AAC, LDAC",
    },
    rating: 4.8,
    reviewCount: 3421,
    clicksCount: 874,
    isFeatured: true,
    categorySlug: "audio",
    description: `## Why this is my daily driver

Deep-work headphones are not an accessory for me — they are infrastructure. The WH-1000XM5 is the pair that survives my actual routine: morning research blocks, client calls, late-night builds and long train rides down to Kochi for shoots.

The noise cancellation is the headline, and it earns it. Calicut traffic, cafe chatter and airplane drone collapse into silence, leaving only whatever I choose to hear. Calls stay surprisingly clear thanks to beamforming microphones — clients rarely guess I am not in a studio.

Battery is the quiet triumph: a genuine 30 hours with ANC on, and a three-minute top-up buys three more hours when I forget to charge overnight. Multipoint pairing keeps the headphones connected to laptop and phone at once, so notifications and calls hand off without ritual.

The sound signature is warm and relaxed rather than analytical — forgiving on long sessions, satisfying on bass-heavy tracks. LDAC support squeezes noticeably more detail out of streaming on Android.

**What to know before buying:** the fixed headband no longer folds flat, so it is bulkier in a sling bag than the XM4, and the touch surface needs a week of muscle memory. Neither has ever sent me back to the XM4.`,
  },
  {
    slug: "dji-osmo-pocket-3-creator-combo",
    name: "DJI Osmo Pocket 3 Creator Combo",
    tagline: "A gimbal camera that fits in a pocket and outshoots phones",
    brand: "DJI",
    merchant: "Amazon",
    imageUrl: "/images/store/prod-creator-camera.png",
    price: 64990,
    compareAtPrice: 69990,
    affiliateUrl: "https://www.amazon.in/dp/B0CJ1ST3CZ?tag=mnkp-21",
    pros: [
      "One-inch sensor outclasses phone footage",
      "Three-axis gimbal in a pocket body",
      "Rotating screen flips to vertical instantly",
      "Creator Combo includes a wireless mic",
      "Excellent low-light performance",
    ],
    cons: [
      "Roughly 2.5-hour battery on long shoots",
      "No native waterproofing",
      "File transfer via app is the slow step",
    ],
    keySpecs: {
      Sensor: "1-inch CMOS",
      Gimbal: "3-axis mechanical",
      Screen: "2-inch rotatable touchscreen",
      Battery: "Around 166 minutes continuous",
      "Combo extras": "DJI Mic transmitter, wide lens, handle",
    },
    rating: 4.7,
    reviewCount: 1287,
    clicksCount: 641,
    isFeatured: true,
    categorySlug: "creator-gear",
    description: `## The camera that replaced my phone for client reels

The Osmo Pocket 3 Creator Combo is the camera that finally replaced my phone for client reels. A one-inch sensor on a three-axis gimbal, in a body that closes into something the size of a candy bar — it is the entire reason my videography service can promise stabilized, cinematic footage without a two-bag kit.

The rotating screen flips fast between horizontal and vertical, which matters more than any spec sheet admits: one shoot now feeds YouTube and Reels without reframing. Face tracking locks onto a subject walking through a Calicut market crowd and simply does not lose them. The Creator Combo adds the Do-It-All handle, a wide-angle lens and the wireless mic transmitter — the transmitter alone upgraded my interview audio overnight.

Low light from the one-inch sensor is a full class above any phone I have used; evening events no longer demand a lighting van. Ten-bit D-Log M gives grading room when the edit needs a specific mood.

**The honest caveats:** battery life is roughly 2.5 hours of continuous rolling, app-based file transfer is the slow part of the pipeline, and there is no waterproofing without a case — monsoon shoots need planning. For everything else, it is the most capable camera I have carried.`,
  },
  {
    slug: "logitech-mx-master-3s",
    name: "Logitech MX Master 3S Wireless Mouse",
    tagline: "The mouse that makes eight-hour build days easier",
    brand: "Logitech",
    merchant: "Amazon",
    imageUrl: "/images/store/prod-mouse.png",
    price: 8495,
    compareAtPrice: 9995,
    affiliateUrl: "https://www.amazon.in/dp/B09HM94VDS?tag=mnkp-21",
    pros: [
      "All-day sculpted comfort",
      "Silent clicks for shared spaces",
      "MagSpeed wheel for huge files",
      "70-day battery life",
      "Per-app button customization",
    ],
    cons: ["Right-handed design only", "Heavy for competitive gaming"],
    keySpecs: {
      Sensor: "8,000 DPI Darkfield",
      Battery: "Up to 70 days",
      Scroll: "MagSpeed electromagnetic + thumbwheel",
      Connectivity: "Bluetooth LE + Logi Bolt receiver",
      Buttons: "7 customizable",
    },
    rating: 4.6,
    reviewCount: 8934,
    clicksCount: 512,
    isFeatured: false,
    categorySlug: "creator-gear",
    description: `## The kit you stop noticing because it never fails

Every freelancer has one piece of kit they stop noticing because it never fails. For me that is the MX Master 3S — the mouse attached to roughly three thousand hours of building, editing and invoice-sending.

The shape is the real product: a sculpted right-hand arc that keeps my wrist neutral through eight-hour build days, something flat mice quietly punish you for skipping. The 8,000 DPI sensor tracks on glass, wood and the slightly uneven desk at the cafe where I sketch plans. Silent clicks mean late-night commits never wake the house.

The thumb wheel is the feature converts never give up: horizontal scroll sweeps timelines in editors and code files side to side, and maps to brush size in Lightroom. The MagSpeed scroll wheel flicks through 1,000-line files in a second, then stops dead pixel-by-pixel when you slow down.

Battery runs 70 days on a full charge, and USB-C top-ups make anxiety pointless. Logi Options+ maps every button per application — my Photoshop buttons differ from my VS Code buttons, automatically.

**Caveats worth stating plainly:** it is right-hand-only, heavy for gaming, and the price stings until the first deadline it survives. For work — not fragging — nothing else I have used comes close.`,
  },
  {
    slug: "keychron-k3-pro",
    name: "Keychron K3 Pro Mechanical Keyboard",
    tagline: "Low-profile mechanical typing for deep-work sessions",
    brand: "Keychron",
    merchant: "Flipkart",
    imageUrl: "/images/store/prod-keyboard.png",
    price: 9499,
    compareAtPrice: null,
    affiliateUrl: "https://www.flipkart.com/keychron-k3-pro-wireless-mechanical-keyboard",
    pros: [
      "Low-profile mechanical comfort",
      "Hot-swappable switches",
      "Three-device Bluetooth switching",
      "Aluminum frame option",
      "Wired and wireless modes",
    ],
    cons: [
      "Stock stabilizers rattle until lubed",
      "QMK and VIA setup rewards tinkerers",
    ],
    keySpecs: {
      Layout: "75% low-profile, 84 keys",
      Switches: "Hot-swappable low-profile mechanical",
      Connectivity: "Bluetooth 5.1 (3 devices) + USB-C wired",
      Battery: "87 hours with backlight off",
      Frame: "Aluminum + ABS",
    },
    rating: 4.5,
    reviewCount: 562,
    clicksCount: 389,
    isFeatured: false,
    categorySlug: "creator-gear",
    description: `## The keyboard that made me care about typing again

The K3 Pro is the keyboard that made me care about typing again. A low-profile 75-percent mechanical board with hot-swappable switches, it splits the difference between laptop keyboards and full battlestations — quiet enough for shared rooms, satisfying enough to make 2 a.m. documentation vaguely pleasant.

The low-profile Keychron switches need half the travel of standard mechanicals, so the adjustment from a laptop keyboard takes an evening, not a month. Hot-swap sockets mean switch preferences can change without buying a new board — my arrow keys run tactile browns while the rest carry linear reds, tuned exactly to taste.

Bluetooth pairs with three devices, and a physical dial switches between desktop, laptop and iPad between meetings. A wired USB-C mode covers the days I want zero latency and simultaneous charging. The south-facing RGB is tasteful rather than arcade-flashy, and the white backlight version survives bright Kerala afternoons.

The aluminum frame adds rigidity that survives a sling bag between client offices. Battery life lands around 87 hours with backlight off — roughly two weeks of real use.

**Honest caveats:** the stock stabilizers rattle until you lube them, the QMK/VIA software rewards tinkering rather than hand-holding, and Flipkart availability in Kerala fluctuates — watch the price for a week before buying. Once tuned, it is the last keyboard most people need to buy.`,
  },
  {
    slug: "anker-737-powerbank",
    name: "Anker 737 Power Bank (PowerCore 24K)",
    tagline: "24,000 mAh of laptop-grade power for shoot days",
    brand: "Anker",
    merchant: "Amazon",
    imageUrl: "/images/store/prod-powerbank.png",
    price: 12999,
    compareAtPrice: 14999,
    affiliateUrl: "https://www.amazon.in/dp/B09VPHVT2Z?tag=mnkp-21",
    pros: [
      "140W laptop-grade output",
      "Smart display with exact percentage",
      "Charges three devices at once",
      "95-minute self-recharge",
      "Airline-legal 24,000 mAh capacity",
    ],
    cons: [
      "630 g brick for pockets",
      "Needs a high-watt GaN charger for full speed",
    ],
    keySpecs: {
      Capacity: "24,000 mAh / 86 Wh",
      Output: "140W max USB-C PD 3.1",
      Ports: "2x USB-C + 1x USB-A",
      Display: "Smart digital readout",
      Recharge: "0-80% in about 65 minutes",
    },
    rating: 4.6,
    reviewCount: 2140,
    clicksCount: 297,
    isFeatured: false,
    categorySlug: "accessories",
    description: `## Cheap insurance against dead-battery shoot days

Shoot days die from dead batteries, not lack of ideas. The Anker 737 — PowerCore 24K — is the power bank that ended that failure mode in my kit: 24,000 mAh with a 140W USB-C output fast enough to charge a laptop, a camera battery bank and a phone in the same afternoon.

The smart display is the feature I did not know I needed: percentage, watts in or out, and time-to-empty on a crisp readout. No more shaking a power bank to guess its mood between locations. During a recent full-day event shoot, it topped up the Osmo Pocket 3 twice, my phone three times and still carried 30 percent home.

A 140W input means the 737 itself refills in about 95 minutes on a GaN charger — the difference between having power tomorrow and having power tonight. Airline-legal capacity keeps it in cabin luggage for the Dubai and Singapore trips.

It doubles as a desktop charger: one USB-C port runs a laptop at full speed while USB-A handles earbuds or a gimbal. Build quality is tank-grade aluminum that has survived being dropped on concrete once — not recommended, but documented.

**Caveats:** at 630 grams it is a brick in a pocket — this is a bag battery, not a jeans battery — and it needs a high-watt charger to hit those speeds. For any working creator, it is cheap insurance.`,
  },
  {
    slug: "samsung-t7-shield-1tb",
    name: "Samsung T7 Shield 1TB Portable SSD",
    tagline: "Rugged, pocketable storage that keeps every shoot safe",
    brand: "Samsung",
    merchant: "Amazon",
    imageUrl: "/images/store/prod-ssd.png",
    price: 9799,
    compareAtPrice: 11999,
    affiliateUrl: "https://www.amazon.in/dp/B09X7BK27V?tag=mnkp-21",
    pros: [
      "1,050 MB/s offloads in minutes",
      "IP65 dust and water resistance",
      "3-meter drop tolerance",
      "Runs Lightroom catalogs directly",
      "Matchbox-sized and light",
    ],
    cons: [
      "Warms during sustained writes",
      "Pricier per GB than desktop drives",
    ],
    keySpecs: {
      Capacity: "1TB",
      Speed: "1,050 MB/s read / 1,000 MB/s write",
      Durability: "IP65, 3 m drop resistance",
      Interface: "USB 3.2 Gen 2 Type-C",
      Weight: "98 g",
    },
    rating: 4.7,
    reviewCount: 4102,
    clicksCount: 233,
    isFeatured: false,
    categorySlug: "accessories",
    description: `## Where every important file lands the moment a shoot wraps

Every photographer learns the same lesson eventually: a wedding shoot exists exactly once, and SD cards are small, losable things. The T7 Shield 1TB is where every important file lands the moment a shoot wraps — rugged, tiny and fast enough that offloading is a coffee break, not a chore.

The rubberized shield earns its name: IP65 dust and water resistance plus three-meter drop tolerance means the drive survives the monsoon-season reality of Kerala event work that bare aluminum drives quietly do not. Mine has been rained on — lightly, once, accidentally — and shrugged it off.

Speed is the daily pleasure: 1,050 MB/s reads over USB 3.2 Gen 2 turn 64GB of 4K footage into a two-minute transfer, and Lightroom catalogs run directly off it without lag when I edit on a laptop away from the studio. The included Type-C-to-C and C-to-A cables cover every machine I meet.

At roughly the weight of a matchbox and the size of a credit card, it lives permanently in the camera section of my sling. Two of them, mirrored, is my personal backup rule — one on my body, one at home.

**Caveats:** it warms noticeably during sustained multi-GB writes, the shield makes it a few millimeters chunkier than the standard T7, and at 1TB the price per byte is higher than desktop drives. For shoot-critical storage, I have never once regretted it.`,
  },
  {
    slug: "notion-ai-template-pack",
    name: "Notion AI Template Pack for Solo Founders",
    tagline: "The exact MN.KP workspace: clients, content and money in one place",
    brand: "MN.KP",
    merchant: "MN.KP Digital",
    imageUrl: null,
    price: 999,
    compareAtPrice: null,
    affiliateUrl: "#/store/notion-ai-template-pack",
    pros: [
      "Complete linked operating system",
      "AI prompt library at every stage",
      "Installs in minutes with walkthroughs",
      "Lifetime quarterly updates",
      "Zero extra subscriptions needed",
    ],
    cons: [
      "Solo-founder sized, no team permissions",
      "Requires basic Notion fluency",
    ],
    keySpecs: {
      Format: "Duplicatable Notion workspace",
      Databases: "9 linked databases",
      Includes: "AI prompt library + SOP vault",
      Updates: "Lifetime quarterly drops",
      Delivery: "Instant after checkout",
    },
    rating: 4.9,
    reviewCount: 128,
    clicksCount: 156,
    isFeatured: true,
    categorySlug: "digital",
    description: `## Not a template dump — the actual MN.KP operating system

This is not a folder of pretty templates — it is the actual operating system behind MN.KP, packaged. Client pipeline, content calendar, income tracker, project briefs, the SOP library and the weekly review ritual that keeps a five-service solo business from quietly unraveling: every database is wired to the next, with the automations and views I use daily.

The pack installs into a Notion workspace in minutes and comes pre-linked: move a deal to Won and it appears in the client portal, the delivery checklist and the revenue dashboard simultaneously. The content engine tracks blog and reel ideas through research, draft, edit and publish stages, with AI prompt templates at each step — the same prompts that produce the posts on this very site.

**Built for:** solo founders, freelancers and creator-businesses running one to five revenue streams. **Not built for:** teams needing role permissions — keep it simple, keep it yours.

The AI layer leans on Notion's built-in AI, so it adds zero subscriptions. Every template includes a short walkthrough plus quarterly update drops as my own systems improve — you are buying a living system, not a snapshot.

Immediate delivery after checkout, lifetime updates included. If you have ever opened a fresh Notion workspace and felt the blank-page panic, this pack is the antidote — structure first, momentum forever.`,
  },
  {
    slug: "capcut-pro-presets",
    name: "CapCut Pro Presets & Transitions Pack",
    tagline: "50 client-tested presets that make reels look finished",
    brand: "MN.KP",
    merchant: "MN.KP Digital",
    imageUrl: null,
    price: 499,
    compareAtPrice: null,
    affiliateUrl: "#/store/capcut-pro-presets",
    pros: [
      "50 presets organized by job",
      "Adjustable intensity and timing",
      "Indian wedding lighting bases",
      "Vertical and horizontal masters",
      "Instant delivery with updates",
    ],
    cons: [
      "Requires a CapCut Pro subscription",
      "Not a cinematic film-grade pack",
    ],
    keySpecs: {
      Presets: "50 adjustable presets + transitions",
      Formats: "Vertical 9:16 and horizontal 16:9",
      Compatibility: "CapCut Pro, desktop and mobile",
      Includes: "Grading bases + reel formulas PDF",
      Delivery: "Instant after checkout",
    },
    rating: 4.8,
    reviewCount: 96,
    clicksCount: 88,
    isFeatured: false,
    categorySlug: "digital",
    description: `## The working library behind every reel I ship

Every reel I ship for videography clients passes through this pack — 50 presets and transitions assembled from three years of paid work, tuned for CapCut Pro's current engine. Not a grab-bag of effects: a working library organized by job — punchy product reveals, warm wedding grades, clean talking-head setups, kinetic text moments and the subtle transitions that make cuts invisible rather than loud.

Each preset is adjustable — intensity, color strength, timing — because a preset that cannot be dialed down is a preset that gets clients unfollowed. The pack includes my grading base for the common Indian wedding and event lighting mix of tungsten and LED (the nightmare every Kerala editor knows), plus skin-tone-safe looks for both warm and cool scenes.

Usage is deliberately frictionless: import once, browse by category, tap to preview, adjust, export. Vertical and horizontal masters are both covered. A quick-start PDF shows the exact stacking order for five common reel formulas — hook, build, payoff — the same structures I use on client work.

**Built for** creators and editors delivering reels weekly; it is not a film-color package. Instant delivery, works with the CapCut Pro subscription you already have, and free updates whenever the engine shifts. If your edit is one preset away from finished, this is that preset.`,
  },
];

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* seed content: inquiries / newsletter                                */
/* ------------------------------------------------------------------ */

const INQUIRIES = [
  {
    name: "Arjun Menon",
    email: "arjun.menon@brightwave.in",
    phone: "+91 94470 22118",
    type: "sponsorship",
    subject: "Sponsored review + sidebar banner for our AI writing tool",
    message:
      "Hi Nihad, I run marketing at Brightwave — we build an AI writing assistant for Indian small businesses. We would like to book a sponsored review on your blog plus a sidebar banner slot for 60 days. Your AI-tools readers are exactly our target audience. Please share your media kit, rate card and available dates. We can proceed immediately.",
    status: "new",
    priority: "high",
    daysAgo: 2,
    repliedDaysAgo: null as number | null,
    internalNote: null as string | null,
  },
  {
    name: "Fathima Zahra",
    email: "fathima.zahra@gmail.com",
    phone: "+91 99461 05530",
    type: "general",
    subject: "Product photography for a small home-bakery business",
    message:
      "Hello, I run a small home bakery in Calicut and need around 15 product photos for Instagram and a Swiggy listing. Could you share your photography package pricing and how soon you could schedule a shoot? The products are cakes and snacks, and I can bring them to your studio if that is easier.",
    status: "replied",
    priority: "normal",
    daysAgo: 8,
    repliedDaysAgo: 6,
    internalNote: "Sent the ₹1,499 product package + availability. Waiting on date confirmation.",
  },
  {
    name: "Rahul Krishnan",
    email: "rahul@techparkcalicut.org",
    phone: "+91 85890 67412",
    type: "partnership",
    subject: "AI upskilling workshops for polytechnic students",
    message:
      "Hi, I coordinate programs at a polytechnic near Calicut. We would like to explore a partnership with MN.KP to run weekend AI-tools workshops for final-year students — your diploma-to-developer story resonates with exactly the audience we are trying to inspire. Can we set up a call this week to discuss structure, pricing and dates?",
    status: "in_progress",
    priority: "normal",
    daysAgo: 5,
    repliedDaysAgo: null as number | null,
    internalNote: "Call scheduled for Friday; drafting a two-weekend pilot outline.",
  },
];

const NEWSLETTER = [
  { email: "aisha.rahman@gmail.com", status: "confirmed", source: "blog", daysAgo: 45 },
  { email: "rohit.sharma99@yahoo.com", status: "pending", source: "footer", daysAgo: 20 },
  { email: "devika.nair@outlook.com", status: "confirmed", source: "store", daysAgo: 33 },
  { email: "karthik.menon@gmail.com", status: "pending", source: "blog", daysAgo: 9 },
  { email: "saniya.pv@gmail.com", status: "confirmed", source: "footer", daysAgo: 52 },
];

/* ------------------------------------------------------------------ */
/* seed content: ventures (Ventures & Business Ideas, Task 11)         */
/* ------------------------------------------------------------------ */

const VENTURES = [
  {
    slug: "calicut-store",
    name: "Calicut Store",
    tagline: "Curated creator and everyday gear, handpicked in Calicut.",
    description:
      "A local-commerce retail venture: a curated shelf of creator and everyday gear for Calicut, blended with the MN.KP affiliate store's honestly-reviewed picks. Order over WhatsApp, pick up in the city, and get gear that has actually been tested — not just listed.",
    category: "store",
    status: "live",
    location: "Calicut, Kerala",
    websiteUrl: null as string | null,
    imageUrl: null as string | null,
    highlights: [
      "Curated creator & everyday gear",
      "Local pickup in Calicut city",
      "WhatsApp-first ordering",
      "Honest, tested recommendations",
    ],
    collabRoles: ["Operations partner", "Local supplier"],
    sortOrder: 0,
    isFeatured: true,
  },
  {
    slug: "chaliyam-connect",
    name: "Chaliyam Connect",
    tagline: "A community and local-tech network for the Chaliyam area.",
    description:
      "A community + local-tech initiative for Chaliyam (Kozhikode): connecting people, local businesses and events in one lightweight network — a local business directory, a community noticeboard, and digital help for shops that want to come online without jargon.",
    category: "community",
    status: "incubating",
    location: "Chaliyam, Kozhikode",
    websiteUrl: null as string | null,
    imageUrl: null as string | null,
    highlights: [
      "Community network for Chaliyam",
      "Local business directory",
      "Meetups & local events",
      "Digital help for local shops",
    ],
    collabRoles: ["Community lead", "Content volunteer"],
    sortOrder: 10,
    isFeatured: true,
  },
  {
    slug: "mnkp-digital",
    name: "MN.KP Digital",
    tagline: "First-party digital products — templates, presets and tools.",
    description:
      "The first-party digital-products arm of MN.KP: Notion templates, presets and workflow tools built from the same AI-first process documented on the blog. Zero inventory, instant delivery, sold through the MN.KP store.",
    category: "product",
    status: "live",
    location: null as string | null,
    websiteUrl: null as string | null,
    imageUrl: null as string | null,
    highlights: [
      "Notion templates & presets",
      "Sold through the MN.KP store",
      "Zero-inventory digital catalog",
    ],
    collabRoles: ["Affiliate partner"],
    sortOrder: 20,
    isFeatured: true,
  },
  {
    slug: "project-195",
    name: "Project 195",
    tagline: "Taking the AI-first build workflow to creators in 195 countries.",
    description:
      "The long-horizon vision: package the AI-first build workflow — the same one that ships MN.KP projects in days — and put it in the hands of creators across all 195 countries. Early-stage: scoping, prototyping and looking for the right founding team.",
    category: "tech",
    status: "idea",
    location: null as string | null,
    websiteUrl: null as string | null,
    imageUrl: null as string | null,
    highlights: [
      "AI-first build workflow, packaged",
      "Ambition: creators in 195 countries",
      "Early research & scoping",
    ],
    collabRoles: ["Co-founder", "Investor", "Country ambassador"],
    sortOrder: 30,
    isFeatured: false,
  },
];

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  /* ---------- guard: validate SEO field lengths per contract ---------- */
  for (const p of POSTS) {
    if (p.seoTitle.length > 60) {
      throw new Error(`seoTitle too long (${p.seoTitle.length} > 60): ${p.seoTitle}`);
    }
    if (p.seoDescription.length > 155) {
      throw new Error(
        `seoDescription too long (${p.seoDescription.length} > 155): ${p.seoDescription}`
      );
    }
  }

  /* ---------- users ---------- */
  const [adminHash, authorHash, userHash] = await Promise.all([
    bcrypt.hash("Nihad@Admin2025", 10),
    bcrypt.hash("Author@2025", 10),
    bcrypt.hash("User@2025", 10),
  ]);
  const socials = socialsRecord();

  const admin = await db.user.upsert({
    where: { email: "intobusyness@gmail.com" },
    update: {
      fullName: "MOHAMMED NIHAD KP",
      displayName: "Nihad KP",
      headline: "Freelancer · Businessman · AI-First Developer",
      bio: "I build apps, websites and digital solutions — not by writing every line from scratch, but by mastering the AI tools of tomorrow.",
      avatarUrl: "/images/brand/portrait.png",
      location: "Calicut, Kerala, India",
      websiteUrl: SITE.url,
      socials: JSON.stringify(socials),
      role: "admin",
      onboardingCompleted: true,
      onboardingStep: 4,
      emailVerified: true,
      passwordHash: adminHash,
      isActive: true,
    },
    create: {
      email: "intobusyness@gmail.com",
      fullName: "MOHAMMED NIHAD KP",
      displayName: "Nihad KP",
      headline: "Freelancer · Businessman · AI-First Developer",
      bio: "I build apps, websites and digital solutions — not by writing every line from scratch, but by mastering the AI tools of tomorrow.",
      avatarUrl: "/images/brand/portrait.png",
      location: "Calicut, Kerala, India",
      websiteUrl: SITE.url,
      socials: JSON.stringify(socials),
      role: "admin",
      onboardingCompleted: true,
      onboardingStep: 4,
      marketingOptIn: true,
      isActive: true,
      emailVerified: true,
      passwordHash: adminHash,
      lastLoginAt: daysAgo(1),
      createdAt: daysAgo(90),
    },
  });

  const author = await db.user.upsert({
    where: { email: "author@mnkp.dev" },
    update: {
      fullName: "MN.KP Content Team",
      displayName: "Content Team",
      headline: "Content Team at MN.KP",
      location: "Calicut, Kerala, India",
      role: "author",
      onboardingCompleted: true,
      emailVerified: true,
      passwordHash: authorHash,
    },
    create: {
      email: "author@mnkp.dev",
      fullName: "MN.KP Content Team",
      displayName: "Content Team",
      headline: "Content Team at MN.KP",
      location: "Calicut, Kerala, India",
      socials: JSON.stringify({}),
      role: "author",
      onboardingCompleted: true,
      onboardingStep: 4,
      marketingOptIn: true,
      isActive: true,
      emailVerified: true,
      passwordHash: authorHash,
      lastLoginAt: daysAgo(5),
      createdAt: daysAgo(75),
    },
  });

  const reader = await db.user.upsert({
    where: { email: "user@mnkp.dev" },
    update: {
      fullName: "Aarav Sharma",
      displayName: "Aarav",
      location: "Kochi, Kerala, India",
      role: "reader",
      onboardingCompleted: false,
      onboardingStep: 2,
      emailVerified: true,
      passwordHash: userHash,
    },
    create: {
      email: "user@mnkp.dev",
      fullName: "Aarav Sharma",
      displayName: "Aarav",
      location: "Kochi, Kerala, India",
      socials: JSON.stringify({}),
      role: "reader",
      onboardingCompleted: false,
      onboardingStep: 2,
      marketingOptIn: true,
      isActive: true,
      emailVerified: true,
      passwordHash: userHash,
      lastLoginAt: daysAgo(3),
      createdAt: daysAgo(30),
    },
  });

  /* ---------- categories ---------- */
  const catBySlug = new Map<string, { id: string }>();
  for (const c of [...BLOG_CATEGORIES.map((c) => ({ ...c, scope: "blog" })),
                   ...STORE_CATEGORIES.map((c) => ({ ...c, scope: "store" }))]) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        scope: c.scope,
        sortOrder: c.sortOrder,
      },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        scope: c.scope,
        sortOrder: c.sortOrder,
      },
    });
    catBySlug.set(c.slug, row);
  }

  /* ---------- posts ---------- */
  for (const p of POSTS) {
    const publishedAt = daysAgo(p.publishedDaysAgo);
    await db.post.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        coverImageUrl: p.coverImageUrl,
        status: "published",
        isFeatured: p.isFeatured,
        tags: JSON.stringify(p.tags),
        readingTimeMinutes: p.readingTimeMinutes,
        viewsCount: p.viewsCount,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        ogImageUrl: p.coverImageUrl,
        canonicalUrl: `${SITE.url}/blog/${p.slug}`,
        authorId: admin.id,
        categoryId: catBySlug.get(p.categorySlug)?.id ?? null,
        publishedAt,
      },
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        coverImageUrl: p.coverImageUrl,
        status: "published",
        isFeatured: p.isFeatured,
        tags: JSON.stringify(p.tags),
        readingTimeMinutes: p.readingTimeMinutes,
        viewsCount: p.viewsCount,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        ogImageUrl: p.coverImageUrl,
        canonicalUrl: `${SITE.url}/blog/${p.slug}`,
        authorId: admin.id,
        categoryId: catBySlug.get(p.categorySlug)?.id ?? null,
        publishedAt,
        createdAt: daysAgo(p.publishedDaysAgo + 3),
      },
    });
  }

  /* ---------- products ---------- */
  for (const prod of PRODUCTS) {
    const base = {
      name: prod.name,
      tagline: prod.tagline,
      description: prod.description,
      brand: prod.brand,
      merchant: prod.merchant,
      imageUrl: prod.imageUrl,
      gallery: JSON.stringify([] as string[]),
      price: prod.price,
      compareAtPrice: prod.compareAtPrice,
      currency: "INR",
      affiliateUrl: prod.affiliateUrl,
      pros: JSON.stringify(prod.pros),
      cons: JSON.stringify(prod.cons),
      keySpecs: JSON.stringify(prod.keySpecs),
      rating: prod.rating,
      reviewCount: prod.reviewCount,
      status: "active",
      isFeatured: prod.isFeatured,
      clicksCount: prod.clicksCount,
      categoryId: catBySlug.get(prod.categorySlug)?.id ?? null,
    };
    await db.product.upsert({
      where: { slug: prod.slug },
      update: base,
      create: { slug: prod.slug, ...base },
    });
  }

  /* ---------- inquiries (create-if-missing; no natural unique key) ---------- */
  for (const inq of INQUIRIES) {
    const existing = await db.inquiry.findFirst({
      where: { email: inq.email, subject: inq.subject },
    });
    if (existing) continue;
    await db.inquiry.create({
      data: {
        name: inq.name,
        email: inq.email,
        phone: inq.phone,
        type: inq.type,
        subject: inq.subject,
        message: inq.message,
        status: inq.status,
        priority: inq.priority,
        internalNote: inq.internalNote,
        repliedAt: inq.repliedDaysAgo !== null ? daysAgo(inq.repliedDaysAgo) : null,
        createdAt: daysAgo(inq.daysAgo),
      },
    });
  }

  /* ---------- newsletter ---------- */
  for (const sub of NEWSLETTER) {
    await db.newsletterSubscriber.upsert({
      where: { email: sub.email },
      update: {
        status: sub.status,
        source: sub.source,
      },
      create: {
        email: sub.email,
        status: sub.status,
        source: sub.source,
        confirmToken: `mnkp_confirm_${sub.email.replace(/[^a-z0-9]/gi, "")}`,
        subscribedAt: daysAgo(sub.daysAgo),
        confirmedAt: sub.status === "confirmed" ? daysAgo(sub.daysAgo - 1) : null,
      },
    });
  }

  /* ---------- ventures ---------- */
  for (const v of VENTURES) {
    const base = {
      name: v.name,
      tagline: v.tagline,
      description: v.description,
      category: v.category,
      status: v.status,
      location: v.location,
      websiteUrl: v.websiteUrl,
      imageUrl: v.imageUrl,
      highlights: JSON.stringify(v.highlights),
      collabRoles: JSON.stringify(v.collabRoles),
      sortOrder: v.sortOrder,
      isFeatured: v.isFeatured,
    };
    await db.venture.upsert({
      where: { slug: v.slug },
      update: base,
      create: { slug: v.slug, ...base },
    });
  }

  /* ---------- site settings ---------- */
  const brandValue = {
    siteName: SITE.name,
    ownerName: SITE.owner,
    roleLine: SITE.roleLine,
    tagline: SITE.tagline,
    email: SITE.email,
    phone: SITE.phone,
    whatsappUrl: SITE.whatsappUrl,
    address: SITE.address,
    socials,
    cvUrl: SITE.cvUrl,
  };
  const mediaValue = {
    heroMarquee: {
      enabled: true,
      images: [
        "/images/brand/og-cover.png",
        "/images/blog/blog-ai-workflow.png",
        "/images/blog/blog-freelance-calicut.png",
        "/images/blog/blog-kp-foundation.png",
        "/images/blog/blog-ai-tools.png",
        "/images/store/prod-headphones.png",
        "/images/store/prod-creator-camera.png",
      ],
    },
    stickers: {
      enabled: true,
      items: [
        // The two values below are literal emoji — DATABASE DATA rendered
        // by the UI at runtime, the single sanctioned exception to the
        // no-emoji-in-source rule (BUILD CONTRACT §0 / Task 2-a brief).
        { type: "emoji", value: "🚀", corner: "br" },
        { type: "emoji", value: "✨", corner: "bl" },
      ],
    },
    blogGifs: { enabled: true, gifs: [] as string[] },
  };
  const adsValue = {
    enabled: true,
    placements: ["blog-inline", "blog-sidebar", "home-strip", "store-side"],
  };
  const maintenanceValue = {
    enabled: false,
    message: "We are performing scheduled maintenance. Back shortly.",
  };

  const settings: Array<[string, unknown]> = [
    ["brand", brandValue],
    ["footer", FOOTER_DEFAULT],
    ["media", mediaValue],
    ["ads", adsValue],
    ["maintenance", maintenanceValue],
  ];
  for (const [key, value] of settings) {
    await db.siteSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value), updatedBy: admin.id },
      create: { key, value: JSON.stringify(value), updatedBy: admin.id },
    });
  }

  /* ---------- summary ---------- */
  const [
    users,
    categories,
    posts,
    products,
    ventures,
    inquiries,
    newsletter,
    siteSettings,
  ] = await Promise.all([
    db.user.count(),
    db.category.count(),
    db.post.count(),
    db.product.count(),
    db.venture.count(),
    db.inquiry.count(),
    db.newsletterSubscriber.count(),
    db.siteSetting.count(),
  ]);

  console.log("MN.KP seed complete (idempotent upserts).");
  console.log("------------------------------------------------");
  console.log(`users:                ${users}`);
  console.log(`categories:           ${categories}`);
  console.log(`posts:                ${posts}`);
  console.log(`products:             ${products}`);
  console.log(`ventures:             ${ventures}`);
  console.log(`inquiries:            ${inquiries}`);
  console.log(`newsletter:           ${newsletter}`);
  console.log(`site_settings:        ${siteSettings}`);
  console.log("------------------------------------------------");
  console.log("post word counts (target ~600-800):");
  for (const p of POSTS) {
    const words = p.content.split(/\s+/).filter(Boolean).length;
    console.log(`  ${p.slug}: ${words} words, seoTitle ${p.seoTitle.length}ch, seoDesc ${p.seoDescription.length}ch`);
  }
  console.log("------------------------------------------------");
  console.log(`author user id:  ${author.id}`);
  console.log(`reader user id:  ${reader.id}`);
}

main()
  .catch((e) => {
    console.error("[seed-error]", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
