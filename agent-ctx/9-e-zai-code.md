# Task 9-e — Public ad rendering + mobile responsiveness sweep

Agent: Z.ai Code (build agent)
Date: 2026-09-11 (session)

## Scope delivered

PART A — DB-driven ad rendering (admin-created ads, on/off, placement-aware, compact):
- `AffiliateAdSlot` upgraded to DB-FIRST: GET /api/ads?placement=X (query key ["ads", placement], staleTime 60s), renders first renderable ad by type (text / image / gif / marquee; sticker never renders in normal slots), falls back to the legacy featured-products strip when the placement has no DB ad. Same exported name + props — all existing consumers unbroken.
- Site-wide units (new `ad-banner.tsx`) mounted in `app-shell.tsx`: AdHeaderBanner (slim band below header), AdMarqueeStrip (scrolling store picks, hover-pause, "Fresh in the store" chip), AdFooterBanner (compact band above footer), AdSticker (floating circular bottom-right, gold ring + pulse, sessionStorage dismiss).
- Click flow: POST /api/ads/:id/click → data.url → "#/…" navigates in-app, else window.open(..., "noopener,noreferrer"); anchors carry rel="sponsored noopener noreferrer" externally; modified clicks (cmd/ctrl/shift/alt) keep native behavior.
- Impression flow: POST /api/ads/:id/impression once per mount per ad id (useRef guard, fire-and-forget).
- Placements wired: header-banner, marquee, footer-banner, sticker (shell) · blog-inline (blog list + post article after 3rd paragraph) · blog-sidebar / home-strip / store-side (unchanged consumers, now DB-first with featured fallback) · between-cards (blog + store grids after 6th item) · product-inline (product page below price/CTA card).

PART B — mobile responsiveness sweep:
- blog: single-column row-card list on <sm (fixes the overflow complaint); sm+ grid unchanged.
- store: tight 2-col compact grid (p-2, text-xs prices), sm+ unchanged.
- home: hero py-10 mobile, 2×2 stats grid, marquee h-14, smaller h1/subhead, compacted section paddings.
- header h-14 mobile; footer 2-col compact + pb for the fixed tab bar (safe-area); category chips full-bleed scroll (-mx-4 px-4) with ≥44px touch targets on mobile.

## Files (13)

Created: src/components/shared/ad-banner.tsx
Modified: affiliate-ad-slot.tsx (rewrite), app-shell.tsx, blog-view.tsx, post-card.tsx,
store-view.tsx, product-card.tsx, product-view.tsx, post-view.tsx, home-view.tsx,
stat-chip.tsx, site-header.tsx, site-footer.tsx

## Contracts (binding for later agents)

From affiliate-ad-slot.tsx:
- `AffiliateAdSlot({ placement: AdPlacement, className? })` — AdPlacement now the FULL @/types union (header-banner | blog-inline | blog-sidebar | between-cards | home-strip | store-side | footer-banner | product-inline | marquee | sticker).
- `useAdsForPlacement(placement) → { ads: AdDTO[]; isResolved: boolean }`
- `useAdInteraction(ad) → { handleClick }` (impression once-per-mount + tracked click)
- `isRenderableAd(ad)`, `runAdAnchorClick(event, handler)`, `adHref(ad)`, `adRel(ad)`, `adTarget(ad)`
- `SponsoredLabel`, `TextAdCard({ad, className?})`, `ImageAdBanner({ad, className?})`, `MarqueeAdStrip({ad, className?})`, `AD_MARQUEE_CSS`

From ad-banner.tsx (all zero-prop):
- `AdHeaderBanner()`, `AdMarqueeStrip()`, `AdFooterBanner()`, `AdSticker()` — all null-render when ads disabled / no live ad / (sticker) dismissed (sessionStorage `mnkp_sticker_dismissed_<adid>`).

PostCard: `size?: "default" | "compact" | "row"` — row = mobile list card (thumbnail left, clamped text right).

## Verification

- bunx eslint on all 13 files → 0 problems.
- GET / → 200; /api/ads?placement=header-banner → 200 with seeded ad.
- agent-browser (isolated `--session 9e`): 390px sweep across 12 routes (home, blog, store, post, product, about, services, contact, support, legal, legal detail, login) → scrollWidth == innerWidth everywhere, zero console/page errors.
- Ad units in DOM at 390px: header band + marquee strip (6 store images) + footer band + sticker + dismiss button.
- Click flow: header ad click → hash changed to #/store (in-app) + click counted in DB.
- Sticker dismiss → sessionStorage key set, sticker unmounted.
- DB after session: impressions recorded on every placement (between-cards 6, blog-inline 2, header 2, marquee 1, sticker 1, footer 1); header clicks 2.
- Screenshots: screenshots/9e-mobile-{home,blog,store}.png.

## Notes / gotchas

- agent-browser is a SHARED daemon across concurrent agents — a parallel agent navigated my default session mid-test. Use `agent-browser --session <name>` for isolation.
- Seeded ads verified intact after concurrent 9-d CRUD testing (restored automatically by their undo).
- Marquee seamlessness uses per-item mx-1.5 margins (not track gap) so translate3d(-50%) loops exactly.
