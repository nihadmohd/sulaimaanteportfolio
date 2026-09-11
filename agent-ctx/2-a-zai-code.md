# Task 2-a — Data Layer & Seed (work record)

Agent: Z.ai Code · Task ID: 2-a · Status: COMPLETE
(Later agents: check `/agent-ctx/` for other records; the binding spec is `/home/z/my-project/worklog.md` — BUILD CONTRACT v1.)

## Files created / owned
- `prisma/schema.prisma` — full 12-model SQLite mirror of `supabase/schema.sql`
  (User incl. local-auth columns, Category, Post, Product, Inquiry, Plan,
  Subscription, SubscriptionEvent, NewsletterSubscriber, AffiliateClick,
  VisitorSession, SiteSetting). 25 indexes incl. composite `sort: Desc`
  (supported on SQLite by Prisma 6.19 — verified).
- `prisma/seed.ts` — idempotent seed, run with `bun prisma/seed.ts`.
- `src/types/index.ts` — API DTOs (ApiEnvelope, SafeUser, PostDTO, ProductDTO,
  CategoryDTO, InquiryDTO, PlanDTO, SubscriptionDTO, SubscriptionEventDTO,
  NotificationItem, StatsResponse, PublicSettings/AdminSettings, ...) +
  JSON helpers `parseJsonArray` / `parseJsonRecord` / `toJson`.
- Verified (not modified) `src/lib/db.ts` + `db/custom.db` (DATABASE_URL unchanged).

## Verification results
- `bun run db:push` — OK, client regenerated (v6.19.2), db writes to `db/custom.db`.
- Seed counts: users 3 · categories 9 (5 blog + 4 store) · posts 6 · products 8 ·
  inquiries 3 · plans 3 · subscriptions 2 · subscription_events 5 · newsletter 5 ·
  site_settings 5. Re-run twice → counts identical (idempotent).
- bcrypt logins verified OK for all 3 accounts (credentials below).
- `bunx eslint prisma/seed.ts src/types/index.ts` → clean (exit 0).
- `bunx tsc --noEmit` → zero errors in my files (project-wide errors exist only in
  3-a's in-progress `.ts`-with-JSX files — not mine, per ownership §5).
- `tail dev.log` → GET / 200, no compile errors from my changes.

## Credentials (exact)
- admin@mnkp.dev / Nihad@Admin2025 — MOHAMMED NIHAD KP, role admin, verified, onboarded, portrait avatar, 8-social socials JSON
- author@mnkp.dev / Author@2025 — MN.KP Content Team, role author, verified
- user@mnkp.dev / User@2025 — Aarav Sharma, role reader, verified, onboardingStep 2, NOT completed

## Deviations from strict spec (all deliberate, see worklog entry)
1. `Product.currency` / `Plan.currency` Prisma default = "INR" (production SQL defaults 'USD') — adapted to the INR-first contract §6 + orchestrator validation.ts defaults.
2. Digital (MN.KP) products use internal `#/store/<slug>` affiliateUrl (no external merchant).
3. Admin subscription card: Mastercard-5100 (reader: Visa-4242 per spec).
4. GIN/trgm/partial indexes of production SQL not representable in SQLite — mirrored as plain/composite indexes; RLS/triggers → API-layer guards (per Task 1 decision).
5. Plan features: free 5 / pro 6 / business 6 bullets (production SQL had 3/5/5 — "adapted" per task brief).
6. Store category split: audio 1 (sony), creator-gear 3 (dji, keychron, logitech), accessories 2 (anker, samsung), digital 2.

## Handoff notes for later agents (4-a / 5-a / 6-a / 7-a)
- **JSON-column convention:** `tags|gallery|pros|cons|features` = JSON string arrays → `parseJsonArray()`; `keySpecs|limits|socials|payload|SiteSetting.value` = JSON string objects → `parseJsonRecord()`; serialize with `toJson()`. All exported from `@/types`.
- `src/lib/auth.ts` SessionUser.socials is the RAW string; the DTO `SafeUser.socials` is PARSED — routes must map `socials: parseJsonRecord(user.socials)` before returning.
- `NotificationItem {id,type,title,body,time,href}` and `StatsResponse.kpis` key names are now the contract — implement `/api/notifications` + `/api/stats` to match (6-a).
- One-active-subscription-per-user is app-layer enforced (no partial unique index in SQLite).
- Seed is re-runnable anytime (`bun prisma/seed.ts`) — restores canonical content, never duplicates inquiries/subscriptions (create-if-missing on email+subject / user+plan).
- Sticker values 🚀/✨ live as literal emoji in DB data (`site_settings.media`) — the ONLY sanctioned emoji; UI renders them only when `media.stickers.enabled`.
- Prisma client was regenerated under the running dev server; if any agent hits a stale-model error, restart dev (orchestrator owns the server).
- Seeded canonical URLs: `https://mnkp.vercel.app/blog/<slug>` (SITE.url from constants).
