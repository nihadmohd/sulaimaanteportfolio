# Task 6-a-1 — Admin & Developer CMS, first half (Admin APIs + Admin Shell + Content/Commerce views)

Agent: Z.ai Code (build agent)
Sandbox: /home/z/my-project (dev server :3000, never built)
Split note: 6-a-1 = API SPEC items 1-11 + _shell/_shared/_charts + views overview/posts/post-edit/products/product-edit. 6-a-2 (separate agent) owns categories/inquiries/users/subscribers/plans/settings views + site-stickers.

## Files owned (verified this task)

### API routes (12 files, withApi + zod + envelopes, staff ops behind requireRole STAFF_ROLES)
- src/app/api/inquiries/[id]/route.ts — PATCH inquiryUpdateSchema {status?,priority?,internalNote?,replied?} + DELETE (404-guarded).
- src/app/api/users/_lib.ts (serializeUser, SafeUser socials PARSED), api/users/route.ts (GET q/role/page-20 createdAt desc), api/users/[id]/route.ts (PATCH {role?,isActive?}, self-change → 400).
- src/app/api/stats/route.ts — GET STAFF, EXACT StatsResponse (13 kpis incl. mrr monthly-normalized; series viewsByPost top8 / clicksByProduct top8 / inquiriesByDay 14d zero-filled UTC / planDist by plan CODE; ACTIVE = trialing|active|past_due).
- src/app/api/settings/_lib.ts (SETTING_KEYS, parseSettingObject, constants defaults, shape-guarded resolvers) + route.ts (GET PUBLIC defaults-merged always-200) + all/route.ts (GET STAFF keyed) + [key]/route.ts (PATCH STAFF upsert toJson + updatedBy, whitelist → 400; bonus GET).
- src/app/api/notifications/route.ts (staff: inq-/sub-/sys-maintenance items; reader: evt- billing + sys-verify-email; cap 12; unreadCount = items.length) + read-all/route.ts (POST → {ok:true,readAt}).
- src/app/api/newsletter/admin/route.ts (GET STAFF q/status/page; exports serializeSubscriber) + api/newsletter/[id]/route.ts (PATCH {status} w/ confirmedAt/unsubscribedAt stamping + DELETE).
- src/app/api/plans/[id]/route.ts — PATCH planUpdateSchema (features→toJson; isDefault:true unsets others in a $transaction; code clash → 409).

### Views (default exports, useAdminGuard ForbiddenState, SEOHead noindex "<Page> — Admin & Developer | MN.KP")
- src/components/views/admin/_shell.tsx — AdminShell (desktop fixed w-64 sidebar top-16: /logo.svg crest + GOLD "Admin & Developer" + Terminal; grouped nav OVERVIEW/CONTENT/COMMERCE/INBOX/PEOPLE/SYSTEM; active gold left border + primary text; admin card + View site + Sign out; mobile slim top bar + Sheet; content p-4 md:p-6 lg:p-8 max-w-7xl lg:pl-64).
- src/components/views/admin/_shared.tsx — shared kit (also consumed by 6-a-2 views): useAdminGuard, apiFetch (re-export), CopyText, ConfirmAction, AdminPager, timeAgo/fmtDate, useDebounced, slugify, ToneBadge + status/priority/role badges, KpiCard, useCategories(scope), usePresenceOnline(interval), formatCompact/formatINR/formatUptime.
- src/components/views/admin/_charts.tsx — recharts (static imports; lazy-only via overview React.lazy): Bar viewsByPost, Bar clicksByProduct, Line inquiriesByDay, Pie planDist; h-[260px]; --chart-1..5; tooltips.
- overview-view.tsx (admin) — 8 KPI cards via DataState /api/stats; live presence card (10s poll + pulse); quick actions; latest 5 inquiries mini-list; lazy charts.
- posts-view.tsx (admin-posts) — search + status Tabs + client filter/pagination over staff ?status=all&limit=60; Table + Edit/View/Publish-toggle/Delete + New post.
- post-edit-view.tsx (admin-post-edit) — PERFECT BLOG FORM (auto-slug, counters, Write/Preview, cover chips, tag chips, gold SEO collapsible + SERP preview, per-field zod errors, unsaved chip, Delete).
- products-view.tsx (admin-products) — table + Feature-toggle/Delete + search + status Tabs.
- product-edit-view.tsx (admin-product-edit) — PERFECT AFFILIATE FORM (gallery, pros/cons + keySpecs row editors, rating Slider + LIVE Stars, discount preview, live ProductCard preview).

## Fixes applied this task
1. _shell: real /logo.svg crest + gold heading + Terminal icon (desktop + mobile Sheet) per dispatch spec.
2. product-edit: live Stars (size md) beside the rating slider numeric.

## Verification (admin cookie /tmp/c6.txt, login admin@mnkp.dev / Nihad@Admin2025)
- GET /api/stats 200: users 3, posts 6/6, views 7710, products 8/8, clicks 3190, inquiries 3/1 new, subs 5/3, activeSubs 2, mrr 1648; series complete (14d zero-filled; planDist [pro 1, business 1]).
- GET /api/settings 200 public; /api/settings/all 200 staff (guest 401); /api/settings/ads staff GET 200.
- GET /api/users 200 (q + role filters; socials parsed).
- GET /api/notifications: admin unread 1 inq- item → #/admin/inquiries; guest 401; reader 10 evt- billing items → #/account/billing. read-all → {ok:true,readAt}.
- PATCH inquiry → replied + repliedAt + note; reader → 403; reverted to seed.
- PATCH /api/settings/ads disable → GET false → re-enable → GET true.
- Guards: settings/evil → 400 whitelist; users self-PATCH → 400; reader /api/stats → 403.
- Plans PATCH: partial sortOrder OK; features toJson roundtrip (6 items); isDefault exclusive.
- bunx tsc --noEmit: zero errors. bunx eslint (all 6-a-1 files): 0/0. Full `bun run lint`: exit 0. dev.log: clean, GET / 200.

## Data hygiene
Plans had drifted (pro prices 0/0, free/pro features emptied; mrr decayed to 1249) from full-plan PATCH testing — restored all three plans to exact prisma/seed.ts state via direct DB write; mrr verified back at 1648. All other demo data verified at canonical seed state.

## Route keys + exports for the registry
- admin → views/admin/overview-view.tsx
- admin-posts → views/admin/posts-view.tsx
- admin-post-edit → views/admin/post-edit-view.tsx
- admin-products → views/admin/products-view.tsx
- admin-product-edit → views/admin/product-edit-view.tsx

## Handoff notes
- 6-a-2: use AdminShell + _shared kit (stable, 6-a-1-owned); plans PATCH has NO limits support (planUpdateSchema lacks the field — orchestrator owns validation.ts); restore plan seed state after plans-view testing (exact lists in worklog); /api/inquiries GET filters single status only (per-tab counts via ?status=X&limit=1).
- Orchestrator: wire the 5 registry keys; keep _charts.tsx lazy-only; /api/settings live.
- 7-a: overview presence card polls REST 10s — swap to usePresence() when realtime lands.
