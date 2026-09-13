# Task 6-a — Admin & Developer Dashboard (full CMS)

Agent: Z.ai Code (build agent)
Date: completed in this session
Sandbox: /home/z/my-project (dev server :3000, never built)

## Scope executed (per worklog TASK 6-a SPEC + addendum)

### API routes (13 files, all withApi + zod + role guards, envelopes {ok,data}|{ok,error})
- src/app/api/settings/_lib.ts — private: SETTING_KEYS, parseSettingObject (nested JSON), constants-based defaults + shape-guarded resolvers (brand/footer/media/ads/maintenance), asJsonRecord.
- src/app/api/settings/route.ts — GET PUBLIC (was 404 before; now always 200 with defaults merged).
- src/app/api/settings/all/route.ts — GET STAFF (AdminSettings keyed by key; missing rows degrade to defaults).
- src/app/api/settings/[key]/route.ts — PATCH STAFF (settingsUpdateSchema; upsert toJson + updatedBy; key whitelist → 400) + GET STAFF (parsed row + updatedAt).
- src/app/api/users/_lib.ts — private serializeUser (SafeUser, socials PARSED).
- src/app/api/users/route.ts — GET STAFF (q/role/page limit 20, createdAt desc).
- src/app/api/users/[id]/route.ts — PATCH STAFF {role?,isActive?}; self-change → 400.
- src/app/api/stats/route.ts — GET STAFF; EXACT StatsResponse from @/types (kpis 13 keys incl mrr; series viewsByPost top8 / clicksByProduct top8 / inquiriesByDay 14d zero-filled / planDist active subs). MRR = monthly-normalized (yearly/12), ACTIVE = trialing|active|past_due.
- src/app/api/notifications/route.ts — GET requireUser. Staff: 10 new inquiries + subscribers confirmed last 7d + maintenance-on system item (cap 12, desc). Reader/author: 10 own subscription_events (humanized titles, planCode · INR amounts) + verify-email system item while unverified. unreadCount = items.length.
- src/app/api/notifications/read-all/route.ts — POST requireUser → {ok:true, readAt}.
- src/app/api/newsletter/admin/route.ts — GET STAFF (q/status/pagination; exports serializeSubscriber).
- src/app/api/newsletter/[id]/route.ts — PATCH {status} (confirmedAt/unsubscribedAt stamping) + DELETE.
- src/app/api/plans/[id]/route.ts — PATCH STAFF (planUpdateSchema; features toJson; isDefault true → transaction unsets others; code clash → 409). [ADDENDUM ownership]

### Views (14 files, src/components/views/admin/**, default exports, staff-guard defensive ForbiddenState)
- _shell.tsx — AdminShell{title,description,actions,children}: desktop fixed sidebar w-64 (top-16, bg-sidebar border-r; Terminal + "Admin & Developer" gold; nav groups OVERVIEW/CONTENT/COMMERCE/INBOX/PEOPLE/SYSTEM; active = gold left border + primary text; bottom admin card + View site + Sign out → POST /api/auth/logout → refetch → #/). Mobile slim sticky top-16 bar + Sheet menu. Content p-4 md:p-6 lg:p-8 max-w-7xl.
- _shared.tsx — useAdminGuard, apiFetch (re-export of 5-a auth/_shared helper), CopyText, ConfirmAction (AlertDialog, onConfirm: () => void | Promise<unknown>), AdminPager, timeAgo/fmtDate, useDebounced, slugify, ToneBadge + Post/Product/Inquiry/Priority/Role badges, KpiCard, useCategories(scope), usePresenceOnline(interval), formatCompact/formatINR/formatUptime.
- _charts.tsx — recharts (static imports; lazy-loaded ONLY via overview-view React.lazy): bar viewsByPost (horizontal), bar clicksByProduct (horizontal), line inquiriesByDay, pie planDist (chart-1..5 CSS vars), h-[260px], tooltips, Cards.
- overview-view.tsx (admin) — 8 KPI cards (DataState /api/stats), live presence card (10s poll + pulse), quick actions (New post/Add product/Inquiries), latest 5 inquiries mini-list, lazy charts.
- posts-view.tsx (admin-posts) — search + status Tabs + client filter/pagination; table thumb/title/status/category/views/updated; Edit/View/Publish-Unpublish quick PATCH/Delete AlertDialog.
- post-edit-view.tsx (admin-post-edit) — PERFECT BLOG FORM: RHF+zod per-field errors; auto-slug editable; excerpt counter; content mono min-h-420 Write/Preview (MarkdownBlock); cover quick-pick chips; tag chips Enter/X max 10; category Select scope=blog; status Select; isFeatured Switch; reading-time auto-hint; publishedAt date; collapsible gold SEO card (seoTitle/60, seoDescription/155, ogImageUrl + preview, canonicalUrl, SERP preview mini-card); sticky live preview; unsaved chip; Save → POST/PATCH → toast → navigate #/admin/posts/:id; Delete.
- products-view.tsx (admin-products) — table thumb-or-gradient/name/price/clicks/Stars/status; Edit/View/Feature-toggle/Delete.
- product-edit-view.tsx (admin-product-edit) — PERFECT AFFILIATE FORM: name, auto-slug, tagline, description+preview, brand, merchant (datalist suggestions), imageUrl + preview + store chips, gallery + thumbs, price/compare + discount% preview, affiliateUrl + external test icon, pros/cons row editors, keySpecs key→value rows, rating Slider + live Stars, reviewCount, status, isFeatured, category scope=store; live ProductCard preview (reuses 3-a card).
- categories-view.tsx (admin-categories) — Blog/Store tabs w/ counts; table name/slug/sort/counts; Add+Edit Dialogs; delete AlertDialog warns unlink (SetNull).
- inquiries-view.tsx (admin-inquiries) — THE INBOX: status Tabs w/ counts (parallel count query), type Select, search; expandable cards (all expanded default, collapse toggle) with inline status/priority Selects + time-ago + gold NEW pulse; expanded: subject + full message + CONTACT BLOCK gold-border (email CopyText + mailto w/ Re: subject; phone CopyText + tel; WhatsApp wa.me/<digits> deep link with prefilled "Hi <firstName>..." message); internal notes Textarea + save; Mark replied/Reopen; Delete; DataState emptyVariant inbox.
- users-view.tsx (admin-users) — search + role Tabs; table avatar/initials, name + email CopyText, role Select inline PATCH (self disabled + "You" badge + gold row bg), isActive Switch (self disabled), onboarding chip, lastLogin time-ago, joined; pagination.
- subscribers-view.tsx (admin-subscribers) — search + status Tabs; email CopyText, status Badge + inline Select PATCH, source, subscribed/confirmed dates, delete, Export CSV (blob download, BOM + escaping, current filter up to 60).
- plans-view.tsx (admin-plans) — 3 plan cards (formatINR prices, features checks, Default/Hidden badges) + Edit Dialog → PATCH /api/plans/:id (features one-per-line, isDefault switch notes "unsets others").
- settings-view.tsx (admin-settings) — Tabs Brand/Footer/Media & Decor/Ads/Maintenance/System. Loads /api/settings/all; per-tab Save → PATCH /api/settings/:key + toast + invalidate ["settings"] AND ["admin-settings"]. Brand: 9 text fields + socials key→value rows (datalist). Footer: tagline/copyright/socialsEnabled + column/link editors + live preview card. Media: heroMarquee enabled + image list (reorder up/down, thumbs, remove, add); stickers enabled + items {corner Select tl/tr/bl/br, value emoji-or-URL} + STICKER_PALETTE quick-pick (sticker admin-data values — the sanctioned emoji exception); blogGifs enabled + URLs. Ads: enabled switch + 4 placement checkboxes. Maintenance: enabled Switch gated by AlertDialog + message + estimatedEnd + guest preview card + staff-bypass note. System: /api/health uptime/time (30s) + /api/stats counts + sandbox→production note.

### Shared (addendum)
- src/components/shared/site-stickers.tsx — SiteStickers: reads useSettings() media.stickers; enabled → fixed corner stickers (tl/tr/bl/br; bl/br lift above mobile tab bar), emoji char OR img h-10, pointer-events-none, aria-hidden, z-30, opacity-80, print:hidden, CSS float anim via inline <style> keyframes (globals.css not mine). Default export too.

## Verification (all against running dev server, admin cookie /tmp/c.txt)
- login admin@mnkp.dev / Nihad@Admin2025 → ok, cookie set.
- GET /api/stats 200: kpis {users 3, posts 6/6, views 7710, products 8/8, clicks 3190, inquiries 3/new 1, subs 5/confirmed 3, activeSubscriptions 2, mrr 1648 (= 399 + 14990/12)}; series present + 14d zero-filled.
- GET /api/settings 200 (public; brand 10 keys, footer 4, media 3, ads 2, maintenance 3 — defaults merged). GET /api/settings/all 200 (staff) — guest → 401.
- GET /api/users 200 total 3 (socials parsed: admin 8 platforms). GET /api/inquiries 200 total 3 w/ phones. GET /api/newsletter/admin 200 total 5.
- GET /api/notifications: admin → unread 1 "New sponsorship inquiry — Arjun Menon" (#/admin/inquiries); guest → 401; reader user@ → 10 billing items (#/account/billing). POST read-all → {ok:true,readAt}.
- PATCH inquiry {status:replied, replied:true, internalNote} → repliedAt stamped + note saved; reverted → new/null/null.
- PATCH /api/settings/ads {"value":{"enabled":false,...}} → GET shows enabled:false → PATCH re-enable → GET enabled:true (roundtrip clean, final = seed state).
- PATCH /api/settings/evil → 400 VALIDATION w/ whitelist; users self-PATCH → 400; user role author→reader roundtrip OK; plan pro PATCH OK (features restored to exact seed list afterwards); subscriber pending→confirmed→pending roundtrip OK; media nested-blob roundtrip OK (7 hero images, 2 stickers, gifs 0 — identical to seed).
- reader on /api/stats + /api/users → 403 FORBIDDEN.
- bunx tsc --noEmit → zero errors in my files. bunx eslint on ALL my files → 0 problems. FULL `bun run lint` → exit 0. tail dev.log → 200s, no compile errors. GET / → 200.
- All demo data RESTORED to canonical seed state after testing.

## Key decisions / deviations (documented in worklog too)
1. Settings blobs parsed with parseSettingObject + resolvers, NOT parseJsonRecord (nested objects would be dropped) — spec's parenthetical honored in spirit.
2. StatsResponse shape = full @/types contract (spec's "EXACTLY StatsResponse" wins over its shorthand kpi list; online not in kpis — overview polls /api/presence).
3. posts/products admin lists fetch ?status=all&limit=60 + client-side filter/pagination (API has no draft/archived filters; keeps counts exact at demo scale).
4. Inquiry tab counts via one parallel query (6 × limit=1) — /api/inquiries is 4-a's file.
5. read-all is an acknowledged no-op (read state is client-side per 3-a bell).
6. Maintenance value carries optional estimatedEnd (extra key, backwards-compatible) → feeds MaintenanceState chip + settings input.
7. AdminShell fixed sidebar positioned top-16 (site header always on); mobile sticky top-16 bar + Sheet.
8. useWatch (single whole-values call) instead of form.watch → clears react-hooks/incompatible-library (5-a precedent).
9. STICKER_PALETTE emoji = sticker admin-data values (sanctioned exception); no other emojis in source.

## Handoff
- ORCHESTRATOR: wire 11 viewRegistry keys (list in worklog) + MOUNT <SiteStickers /> in app-shell (reads ["settings"] query; dormant until mounted).
- Settings save invalidates ["settings"] (the shared public key from use-settings) + ["admin-settings"].
- New query keys: admin-stats / admin-posts / admin-post:{id} / admin-products / admin-product:{id} / admin-categories:{scope|all} / admin-inquiries:… / admin-inquiry-counts / admin-users:… / admin-subscribers:… / admin-plans / admin-settings / admin-health / admin-presence.
- 7-a: overview Live activity card polls GET /api/presence 10s (shows "—" + fallback note while service down) — can swap to usePresence() later.
