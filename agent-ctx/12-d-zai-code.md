# Task 12-d — Hero marquee premium marketing band (work record)

Task ID: 12-d
Agent: Z.ai Code
Task: Rebuild the home-page hero marquee into a premium dual-lane marketing asset (image track + tracked marketing/sponsored chip lane) with a new "hero-marquee" ad placement and full admin control.

## Files changed (ownership respected)
- `src/types/index.ts` — AdPlacement += "hero-marquee"; new `MarqueeMessage` / `MarqueeSpeed`; `MediaSettings.heroMarquee` → {enabled, images, messages, speed}.
- `src/lib/validation.ts` — AD_PLACEMENTS += "hero-marquee" (adCreate/adUpdate enums pick it up automatically).
- `src/app/api/settings/_lib.ts` — `defaultMedia().heroMarquee` now enabled with 8 curated images + 6 marketing chips + speed normal; `resolveMarqueeMessages` guard (trim ≤ 60 chars, href only `#/` or `https://` else null, cap 12; missing array → defaults, present-empty → honored); speed via `pick`; ads-group AD_PLACEMENTS whitelist += "hero-marquee" (sync).
- `src/hooks/use-settings.ts` — media.heroMarquee client type mirrors messages/speed.
- `src/components/views/home/home-view.tsx` — full HeroMarquee rebuild + MARQUEE_CSS (reverse lane, edge fade mask) + HeroMessageChip / HeroAdChip / useHeroAdInteraction / parseHeroMessages helpers.
- `src/components/views/admin/settings-view.tsx` — Media & Decor hero marquee editor: enabled switch, image track editor (existing rows), marketing-chip rows (text ≤ 60 + optional href + remove, add cap 12), speed select slow/normal/fast with "Default: normal", live chip preview; legacy rows prefill DEFAULT_HERO_MESSAGES mirror; buildMediaValue persists the full heroMarquee via PATCH /api/settings/media.
- `src/components/views/admin/ads-view.tsx` — PLACEMENT_META["hero-marquee"] (label "Hero marquee", hint "Premium dual-lane marquee on the home hero", icon Megaphone).
- `src/components/views/admin/marketing-view.tsx` — ONE-LINE fix: `"hero-marquee": "Hero marquee"` added to PLACEMENT_LABEL (Record<AdPlacement, string> broke exhaustiveness when the union grew — tsc error; forced cross-file fix, noted in worklog).

## Frontend design (Graphite & Copper)
- Section directly below hero: `border-y border-t-gold/30` + `bg-gradient-to-b from-muted/40 to-muted/10`, `aria-label="MN.KP highlights and sponsored picks"` (real content — no aria-hidden).
- Micro-label centered ABOVE the tracks: "Trusted stack · live deals · what's shipping" — text-[10px] tracking-[0.25em] uppercase text-muted-foreground.
- LANE A (images): leftward marquee, rounded-lg border images h-16 sm:h-20 md:h-24, grayscale → color on hover (+ gold border on hover), `.press`, lazy, edge fade mask.
- LANE B (marketing + ads): `animation-direction: reverse` (opposite scroll), gold-dot message pills (rounded-full border bg-card px-4 py-1.5 text-xs, ALink when href) + gold-dashed SPONSORED chips (Sponsored micro-label + title + linkLabel + arrow). Ads first, then messages, then exact duplicate for the seamless -50% loop.
- Speeds: slow 60s / normal 42s / fast 28s via inline animationDuration; pause on hover/focus-within; prefers-reduced-motion stops; tracks width max-content.
- Degradation: disabled → nothing; images empty → lane B only; messages+ads empty → lane A only; all empty → nothing.

## Ad tracking (pattern copied from ad-banner.tsx / affiliate-ad-slot.tsx)
- `useAdsForPlacement("hero-marquee")` → GET /api/ads?placement=hero-marquee (priority-sorted active in-schedule ads, gated by adsEnabled).
- `useHeroAdInteraction(ad, trackImpression)` mirrors useAdInteraction (impression POST once per mount + click POST → open url in-app via navigate or new tab) EXCEPT the loop-duplicate chip copies pass trackImpression=false → exactly ONE impression per ad per page mount while every copy stays clickable (verified: impressions stayed 1 with the duplicated chip mounted).
- Anchor uses shared adHref/adRel/adTarget/runAdAnchorClick.

## Verification evidence
- eslint: 0 problems on all 8 touched files. `bunx tsc --noEmit`: app code clean.
- Resolver WITHOUT DB row (row deleted via prisma script, then restored by canonical PATCH): GET /api/settings → heroMarquee {enabled true, 8 default images, 6 default messages with hrefs, speed normal}.
- Legacy/partial merge: PATCH {heroMarquee:{enabled,images:[2]}} (no messages/speed keys) → GET shows stored images + DEFAULT messages + speed normal.
- Coercion: javascript: href → null; empty-text chip dropped; 100-char text truncated to 60; speed "turbo" → "normal".
- Canonical media PATCHed and persisted: enabled true / 8 images / 6 messages / speed normal; stickers (2 emoji) + blogGifs (enabled) preserved from pre-test state.
- Ad E2E (agent-browser session 12d, 1280x800): dual lanes render (normal 42s + reverse 42s), 16 imgs, ad chip first in lane B; impression exactly 1; click on in-view chip copy → URL #/services + clicks 1 (network log shows POST /click); hover pause verified (animationPlayState paused); 0 console errors. Mobile 390x844: overflowX 0, lanes + chips + imgs all present.
- Admin UI in-browser: Media & Decor tab renders new editor (12 message inputs, speed select, live preview with first chip); Ad Manager gains "Hero marquee" placement option via AD_PLACEMENTS.
- Screenshots: `screenshots/12d-marquee-desktop.png`, `screenshots/12d-marquee-mobile.png`, extra `screenshots/12d-marquee-desktop-with-ad.png`.
- Cleanup: test ad deleted (6 ads remain, none hero-marquee); temp scripts + cookie jar removed; dev.log tail clean.

## Default marketing chips (canonical, persisted)
1. AI-powered sites from ₹4,999 → #/services
2. Honest gear reviews — curated in Calicut → #/store
3. Join a venture — build the next startup with me → #/ventures
4. Free quote within 24 hours → #/contact
5. The 195-country mission → #/about
6. New on the blog — AI workflows that ship → #/blog

Default image track (8): og-cover, blog-ai-workflow, prod-creator-camera, blog-ai-tools, prod-headphones, blog-kp-foundation, prod-keyboard, portrait.

## Deviations / notes
- marketing-view.tsx one-line edit (exhaustiveness fix) — the only file touched outside the assigned list; forced by the AdPlacement union extension, documented as handoff note.
- Lane B ads render as chips regardless of ad type (sticker excluded); an image-type ad in this placement renders its title as a chip, not a banner — intentional (chip lane is the premium treatment); richer image treatment can be added later in HeroMarquee's heroAds filter.
- Automated clicks on moving marquee chips need the lane paused first (hover) — real users unaffected.
