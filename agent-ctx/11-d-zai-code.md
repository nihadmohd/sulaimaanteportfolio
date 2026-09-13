# Task 11-d — Marketing Hub professional rebuild (work record)

Task ID: 11-d
Agent: Z.ai Code
Task: Rebuild `src/components/views/admin/marketing-view.tsx` (route key "admin-marketing") as a professional Marketing Hub — KPI row, UTM campaign builder (star feature), affiliate funnel, top content, ad performance table, SEO health checklist, quick actions.

## Files touched (ownership respected)
- REPLACED: `src/components/views/admin/marketing-view.tsx` (only file owned by this task — nothing else edited).

## Sections built
1. **KPI row** — 5 `KpiCard`s (`grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-5`): Ad impressions · Ad clicks (sub CTR %) · Newsletter (`confirmed / total`, sub "confirmed subscribers") · Affiliate clicks (sub "Product link clicks") · Total views (sub "Across all posts"). Icons: Megaphone / MousePointerClick / Rss / Target / Eye.
2. **UTM campaign builder** — pure client-side star feature. Base URL (default `https://mohdnihadkp.vercel.app`, auto-prefixes `https://` when scheme omitted), required Campaign source + Campaign name, optional medium/term/content. Live URL preview in a read-only mono `Input`, Copy button (navigator.clipboard + textarea/execCommand fallback for non-secure contexts → toast "Campaign URL copied") and Open button (`window.open(url, "_blank", "noopener,noreferrer")`). Contextual hint line: amber AlertCircle for invalid base URL / missing source+campaign, green Check + "N UTM parameters tagged" when complete. Built via `new URL()` + `searchParams.set` (existing query params preserved; hash-safe).
3. **Affiliate funnel** — three compact stat blocks (views → clicks → CTR, CTR block copper-accented `border-gold/40 text-gold`) with a thin proportional copper conversion bar (`role="img"` + aria-label), plus top-3 clicked products with proportional copper bars.
4. **Top content** — top-3 posts by views, rank chip (1 = copper), title + proportional bar + views count. NO links (series keys posts by title only — not derivable, no fake links).
5. **Ad performance** — table sorted by clicks desc (max 6 rows): Ad (name + placement chip via local `PLACEMENT_LABEL` map), Status (copper dot "Active" / muted "Off", `hidden md:table-cell`), Impressions (`hidden md:table-cell`), Clicks, CTR. Rows `cursor-pointer` + `onClick → navigate("/admin/ads")`; header CardAction "Ad Manager" button covers keyboard access; footer note when > 6 ads.
6. **SEO health checklist** — from `useSettings()` data cast `as unknown as { seo?: SeoSettings }` (public `/api/settings` resolves the seo group server-side; the `SiteSettings` interface in use-settings.ts has no `seo` key yet — cast keeps this file compiling regardless of 11-c's concurrent edits). 5 checks: titleSuffix non-empty · defaultDescription ≥ 70 chars (live char count) · keywords ≥ 3 · googleVerification · bingVerification. Green Check / amber AlertTriangle rows, "X / 5 checks passing" in the description + 5-segment copper progress strip, CardAction CTA "Open SEO settings" → `#/admin/settings`. Skeleton rows while pending; muted "unavailable" note when the hook resolves null.
7. **Quick actions** — compact h-9 outline buttons: Ad Manager (Megaphone), Import & Export (Upload), Subscribers (Users), SEO settings (Settings).

## Data sources / query keys (unchanged contracts)
- `["admin-ads-stats"]` → GET `/api/ads?all=1&stats=1` → `{items, stats{totalAds,activeAds,impressions,clicks,ctr}}`
- `["admin-stats"]` → GET `/api/stats` → `StatsResponse` (kpis + series.clicksByProduct + series.viewsByPost)
- `useSettings()` (`["settings"]`) → seo group for the health checklist
- NO recharts — proportional div bars only. Loading via existing `DataState` (statsQuery, `empty={false}`) + `LoadingState`/`ForbiddenState` guard; ads table + SEO card have their own inline pending skeletons.

## Design decisions
- Graphite & Copper: copper strictly as accent (icon chips `text-gold`, micro-labels, active borders `border-gold/40`, bars `bg-gold`, status dot active = copper per dispatch spec; conventional green/amber used ONLY for SEO pass/warn + UTM complete hint).
- Cards compact mobile: `Card className="py-4 md:py-6"`, headers/contents `px-4 md:px-6`; tables p-0 with inner px-4/md:px-6.
- Mobile 390px: KPI 2-col; funnel blocks stack tight (arrows `hidden sm:block`); ad table drops Status + Impressions columns (status dot moves inline into the Ad cell via `md:hidden`); title cells truncate at 45% width — zero horizontal overflow verified.
- Post-billing world: no MRR/plans anywhere; Newsletter KPI replaces the old subscriber card.

## Verification performed
- `bunx eslint src/components/views/admin/marketing-view.tsx` → **0 problems**; `bunx tsc --noEmit` → no errors in this file.
- agent-browser (isolated session `11d-marketing`), admin login via UI (intobusyness@gmail.com):
  - Desktop 1280×800: all 7 sections render; 6 ad rows with placement chips/status/CTR; SEO "3 / 5 checks passing" (matches live API: suffix ✓, 91-char description ✓, 4 keywords ✓, google ✗, bing ✗); UTM fill (whatsapp / social / venture-launch) → `https://mohdnihadkp.vercel.app/?utm_source=whatsapp&utm_medium=social&utm_campaign=venture-launch`; Copy → button flips to "Copied" + toast "Campaign URL copied"; ad row click → `#/admin/ads`; fresh reload → 0 console errors.
  - Mobile 390×844: `scrollWidth === innerWidth` at top AND bottom; all sections + table (6 rows) present; UTM URL + copy toast work; full screenshots saved.
- Screenshots: `screenshots/11d-marketing-desktop.png`, `screenshots/11d-marketing-mobile.png`.

## Deviations / notes
- Dev server OOM: the shared `next dev` on :3000 was OOM-killed repeatedly during verification (dmesg: `Killed process ... next-server`, ~2.3GB RSS; multiple concurrent agents + browsers on a 3.9GB box). Restored via `setsid nohup bun run dev` (detached so the tool's process-group cleanup can't kill it). If it dies again: same one-liner brings it back.
- `useSettings` type gap: seo accessed through an `unknown` cast — if 11-c adds `seo` to `SiteSettings`, the cast can be simplified later (no behavioral change needed).
- UTM values kept as typed (trimmed, not force-lowercased) — matches Google's Campaign URL Builder behavior.

## Handoff
- Query keys `["admin-ads-stats"]` / `["admin-stats"]` / `["settings"]` consumed read-only — no invalidations from this view.
- The funnel CTR / KPI numbers all come from `/api/stats` + `/api/ads?all=1&stats=1` — no new endpoints required.
