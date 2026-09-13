# Task 11-c — Settings expansion (work record)

Task ID: 11-c
Agent: Z.ai Code
Task: "I think a few more things should be added in the settings, add all the settings that will be needed. In which mode should they be used as default." — add contact / localization / analytics setting groups (backend defaults + resolvers + public payload + admin UI tabs), every default documented in the UI.

## Files touched (ownership respected)
- `src/app/api/settings/_lib.ts` — SETTING_KEYS 7 → 10; `defaultContact` / `defaultLocalization` / `defaultAnalytics`; `resolveContact` / `resolveLocalization` / `resolveAnalytics`; new `num()` + `pick()` shape guards.
- `src/app/api/settings/all/route.ts` — `defaultForKey` gained contact/localization/analytics cases (admin forms load effective values).
- `src/app/api/settings/route.ts` — public GET now returns all 10 resolved groups.
- `src/app/api/settings/[key]/route.ts` — comment only (KEY_SET already derives from SETTING_KEYS, so the 3 new keys were automatically PATCHable; verified live).
- `src/components/views/admin/settings-view.tsx` — TabsList 8 → 11 triggers (scrollable on mobile); 3 new TabsContent (Contact & Social / Localization / Analytics) + drafts + build*Value + save flow via existing PATCH + ["settings"]/["admin-settings"] invalidation.
- `src/hooks/use-settings.ts` — additive: optional `contact` / `localization` / `analytics` groups on `SiteSettings` + `contactInfo()` resolver helper (mirrors `maintenanceInfo`). Existing tabs' code untouched.
- NOT touched: `src/types/index.ts` (orchestrator pre-wired ContactSettings/LocalizationSettings/AnalyticsSettings + PublicSettings/AdminSettings groups — I only consumed them).

## The 10 setting keys + defaults (full table)

| key | default values | default mode |
|---|---|---|
| brand | constants.ts SITE (MN.KP / MOHAMMED NIHAD KP / intobusyness@gmail.com / +91 98467 50898 / SOCIALS map / CV URL) | live brand identity |
| footer | FOOTER_DEFAULT (4 columns, socials on) | informational |
| media | heroMarquee/stickers/blogGifs all `enabled:false`, empty arrays | decor OFF until opted in |
| ads | `enabled:true`, placements [blog-inline, blog-sidebar, home-strip, store-side] | monetization ON |
| features | all 9 toggles `true` | everything shipped ON |
| seo | suffix "| MN.KP", default description, 4 keywords, empty verification tokens | MN.KP SEO baseline |
| **contact** | email intobusyness@gmail.com · phone +91 98467 50898 · whatsappNumber +91 98467 50898 · whatsappUrl https://wa.me/919846750898 · address "Calicut (Kozhikode), Kerala, India" · city Calicut · responseTimeHours 24 · socials `{}` | mirrors the live MN.KP contact details; contact.socials starts EMPTY (Brand owns the canonical social map) |
| **localization** | currency INR · currencySymbol ₹ · timezone Asia/Calcutta · dateFormat "d MMM yyyy" · measurement metric | India-first |
| **analytics** | enabled `false` · googleAnalyticsId "" · plausibleDomain "" · trackOutboundClicks `true` | PRIVACY-FIRST — tracking OFF until the owner opts in (GA/Plausible IDs are public by nature, group is safe in the public payload) |
| maintenance | enabled:false, standard message, estimatedEnd null | OFF |

## API changes
- `GET /api/settings` (public) → `{brand, footer, media, ads, features, seo, contact, localization, analytics, maintenance}` — all resolved through shape guards (partial rows degrade to defaults; contact strings trimmed; `responseTimeHours` numeric-coerced via Number.isFinite + clamped 0–168; analytics IDs trimmed; dateFormat/measurement whitelisted via `pick()`, currency uppercased ≤6 chars, symbol ≤4 chars).
- `GET /api/settings/all` (admin) → same 10 keys; missing rows fall to `defaultForKey`.
- `PATCH /api/settings/:key` — works for all 10 keys (upsert + audit log). Verified: PATCH partial contact row → resolver fills missing fields with defaults; PATCH analytics with padded GA id → trimmed on read.

## UI tabs added (Graphite & Copper: neutral ink + copper `text-gold` accents, no blue/indigo)
1. **Contact & Social** — email/phone/whatsappNumber/whatsappUrl/address/city/responseTimeHours(number, 0–168) inputs, every hint states its default ("Default: intobusyness@gmail.com" etc.); live auto-derived wa.me link hint under the WhatsApp number (`digits.replace(/\D/g)`); whatsappUrl helper "Leave empty to auto-build from the WhatsApp number"; dynamic socials key/value editor (datalist suggestions: Instagram/YouTube/LinkedIn/GitHub/X/Facebook/WhatsApp/Threads, limit 8, add/remove rows — same pattern as Brand socials). Header note: "Defaults mirror the live MN.KP contact details".
2. **Localization** — currency Select (INR/USD/EUR/GBP/AED + stored custom value passthrough item), currencySymbol Input, timezone Select (Asia/Calcutta + Asia/Dubai, Asia/Riyadh, Europe/London, UTC, America/New_York + custom passthrough), dateFormat Select (d MMM yyyy / dd/MM/yyyy / MM/dd/yyyy), measurement Select (metric/imperial); all hints state the default. Header note: "Default mode: India-first — ₹ INR · Asia/Calcutta (IST) · d MMM yyyy · metric."
3. **Analytics** — enabled Switch (privacy-first OFF), googleAnalyticsId (mono, placeholder G-XXXXXXXXXX, "Leave empty = disabled"), plausibleDomain (mono), trackOutboundClicks Switch (ON). Header note: "Default mode: privacy-first — tracking stays OFF until you opt in."
- TabsList: `scrollbar-slim h-11 w-full justify-start overflow-x-auto sm:w-auto sm:max-w-full` — mobile-safe scroll.

## Verification
- `bunx eslint` on all 6 touched files → 0 problems.
- curl (admin cookie): login 200 · GET /api/settings → 200, all 10 groups, contact.email == "intobusyness@gmail.com" · GET /api/settings/all → 200, 10 keys · PATCH contact/localization/analytics with test values → 200 + persisted + resolver coercion verified (trim/merge/clamp) · **restored canonical defaults via PATCH and asserted deep-equality** (DB left in default state).
- agent-browser (isolated sessions `task11c-desk` / `task11c-mob`): desktop 1440 — 11 tabs render in order, Contact tab fully populated with defaults, Localization/Analytics verified, UI save E2E (city edit → Save → persisted → restored), no page errors; mobile 390×844 — TabsList scrolls (scrollWidth 913 vs client 358, programmatic scrollLeft works), page scrollWidth 390 == innerWidth 390 (NO layout overflow), Contact tab populated. Screenshots: `screenshots/settings-11c-contact-desktop.png`, `screenshots/settings-11c-contact-mobile-390.png`, `screenshots/settings-11c-tabs-mobile-390.png`.

## Deviations / notes
- **Dev server OOM incident (shared environment)**: the shared `next dev` on :3000 was OOM-killed mid-task (kernel log: next-server 2.3GB RSS, 4GB box, multiple parallel agents' headless Chromes). I restored it with the canonical `bun run dev` (nohup, disowned) after closing my own browser sessions; it flapped once more (EADDRINUSE race while another agent also restored it) then stabilized. dev.log was truncated by `tee` on restart — only recent entries remain. **Handoff: keep concurrent agent-browser sessions to a minimum and close them when done; if :3000 is down, restart with `cd /home/z/my-project && nohup bun run dev >/dev/null 2>&1 & disown` and verify with /api/health.**
- `use-settings.ts`: added optional typed groups + `contactInfo()` helper (fallback defaults only apply when the API is unreachable — the API is the single source of truth). 11-d already consumed `seo` via a local cast; no conflict.
- Analytics scripts are NOT yet injected site-wide (only the settings + storage exist) — wiring `next/script` GA/Plausible loaders guarded by `analytics.enabled` is left for a future task (natural home: the app shell).
