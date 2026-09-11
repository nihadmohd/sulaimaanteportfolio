# Task 5-a — Authentication, Customer Lifecycle & Mock Billing (work record)

Agent: Z.ai Code · Task ID: 5-a · Status: COMPLETE
(Later agents: check `/agent-ctx/` for other records; the binding spec is `/home/z/my-project/worklog.md` — BUILD CONTRACT v1 + the 5-a entry.)

## Files created / owned

### API routes (all `withApi` + zod from `@/lib/validation`, uniform envelopes)
- `src/app/api/auth/_lib.ts` — `toSafeUser()` (SafeUser DTO, socials PARSED), `normalizeEmail()`.
- `src/app/api/auth/register/route.ts` — 409 on duplicate email; reader + onboardingStep 1 +
  `verificationToken = randomUUID()+uuidv4()`; session cookie via `withSession`; returns
  `{user, devVerifyUrl}` (mock email transport).
- `src/app/api/auth/login/route.ts` — generic 401 for unknown email/bad password; 403 when
  `!isActive` (after password verifies); updates `lastLoginAt`; cookie; `{user}`.
- `src/app/api/auth/logout/route.ts` — clears cookie (Max-Age=0); `{ok:true}`.
- `src/app/api/auth/me/route.ts` — GET: guest → 401 `{code:"UNAUTHENTICATED"}`; else
  `{user, subscription}` = full SubscriptionDTO **+ planCode/interval aliases** (use-session reads
  those flat keys) + `devVerifyUrl` while unverified. PATCH (requireUser): inline
  `profileUpdateSchema` incl. `interests`/`goals` arrays → merged into socials.
- `src/app/api/auth/forgot-password/route.ts` — always `{sent:true}`; `devResetUrl` only when the
  account exists (token + 1h expiry); no existence leaks.
- `src/app/api/auth/reset-password/route.ts` — token+expiry lookup → 401 “invalid or expired”;
  single-use (token cleared); `{ok:true}`.
- `src/app/api/auth/verify-email/route.ts` — GET `?token=` and POST `{token}`; 404 on
  unknown/used; sets `emailVerified`, clears token; `{verified:true}`.
- `src/app/api/auth/onboarding/route.ts` — `{step 1..4, data}`; merges profile fields +
  `_interests`/`_goals`; `onboardingStep = max(current, step)`; step 4 → completed.
- `src/app/api/subscriptions/_lib.ts` — `ACTIVE_SUB_STATUSES`, `intervalDays`, `priceFor`,
  `toPlanDTO/toSubscriptionDTO/toEventDTO` (payload parsed loosely).
- `src/app/api/subscriptions/route.ts` — `{plans (active, sortOrder), current|null, history (20 desc)}`.
- `src/app/api/subscriptions/manage/route.ts` — mock billing state machine:
  change (plan_changed/created + payment event per outcome; status active/past_due/trialing),
  cancel (cancelAtPeriodEnd, status untouched), resume, renew (extends on success only),
  simulate (failed→past_due, pending→trialing, success→active+extension). Every event payload
  carries `{planCode, interval, outcome}`; amounts = plain INR from the plan row; create stamps
  Visa/4242. Returns `{subscription (with plan), event}`.

### Views (default exports; route keys in parentheses)
- `src/components/views/auth/_shared.tsx` — `apiFetch`, `AUTH_THEMES` (emerald/amber/obsidian),
  `AuthShell`, `PasswordInput`, `DemoCredentialsCard`, `safeNextPath`, `loginDestination`.
- `auth/login-view.tsx` (auth-login) — emerald glass; expired banner; next-aware; staff→#/admin,
  fresh→#/onboarding, else next||#/account; demo creds.
- `auth/register-view.tsx` (auth-register) — amber; strength hint; terms checkbox;
  “Check your email” card with devVerifyUrl + skip-to-onboarding.
- `auth/verify-email-view.tsx` (auth-verify) — auto-POST; verifying/verified/invalid states.
- `auth/forgot-password-view.tsx` (auth-forgot) — sent state + demo reset link button.
- `auth/reset-password-view.tsx` (auth-reset) — token + match refine; auto-navigate login @2s.
- `auth/admin-login-view.tsx` (admin-login) — obsidian+gold; staff-only gate with inline
  403-style notice for non-staff; admin demo creds.
- `onboarding/onboarding-view.tsx` (onboarding) — 4-step wizard, gold progress, chips,
  marketing switch, done screen; every step POSTs; skip support.
- `account/_shared.tsx` — `ClientUser`, `parseChips`, `subStatusBadge/Label`, `formatDate`,
  `renewalNote`, `ContactRow`.
- `account/dashboard-view.tsx` (account) — greeting, verify banner, profile/subscription cards,
  quick links, contact rows.
- `account/billing-view.tsx` (account-billing) — current plan + cancel/resume/renew
  (AlertDialogs), plans grid w/ monthly-yearly toggle, mock payment Dialog (4242 disabled
  inputs + simulate row), PaymentState banners + receipt row, history table, demo note.
- `account/settings-view.tsx` (account-settings) — profile form (PATCH me), marketing switch,
  interests/goals chips (onboarding endpoint), data & privacy + cookie-preferences reset,
  danger zone (mailto deactivate, sign out).

## Verification results (curl, live dev server)
- register → ok, cookie set, devVerifyUrl (72-char token), socials parsed dict; duplicate → 409.
- verify-email GET ok; reuse → 404; `emailVerified` flips in /me.
- login admin → role admin + lastLoginAt; wrong pw → generic 401; me w/o cookie → 401 envelope;
  me with cookie → business yearly + aliases.
- PATCH me persisted headline/location + `_interests`/`_goals` inside socials.
- forgot → sent:true (+devResetUrl for real user, none for ghost); bad reset token → 401; good
  token → password rotated (old 401, new ok).
- onboarding: steps merge; step never regresses; step 4 completes; unauth → 401.
- logout: set-cookie Max-Age=0; cleared jar → me 401.
- subscriptions GET user@ → plans free/pro/business (0/399/1499 monthly), current pro active
  monthly, history desc.
- manage: change→cancel→resume→simulate failed (past_due)→pending (trialing)→success (active,
  extended) all behaved; unauth 401; unknown plan 404; demo user restored to pro monthly
  active; temp user deleted (3 users / 2 subscriptions remain).
- `bunx eslint` on all 5-a files → 0/0. `bunx tsc --noEmit` → clean for 5-a files. dev.log clean.
  Remaining project lint issues belong to 4-a (api/_lib/serialize.ts, contact-view) — untouched.

## Key conventions later agents must know
1. **socials reserved keys**: `_interests` / `_goals` are JSON-encoded string arrays inside
   `User.socials` (flat string map). Read with `parseChips()` from
   `@/components/views/account/_shared`.
2. **/api/auth/me payload**: `{user, subscription: SubscriptionDTO & {planCode, interval} | null,
   devVerifyUrl?}` — devVerifyUrl only while unverified (mock transport).
3. **payment_pending** event type is cast (not in 2-a's DTO union) — widen the union if convenient.
4. `PaymentState.message` is STRING-only (3-a's prop type) — JSX receipts go in sibling nodes.
5. `apiFetch<T>()` + `DemoCredentialsCard` are exported from `views/auth/_shared.tsx` for reuse.
6. Emails lowercased on register/login lookups (SQLite case sensitivity).
7. One-active-subscription-per-user = statuses `trialing|active|past_due` (app-layer enforced).

## Handoff notes
- Orchestrator (Task 8): wire the 10 viewRegistry keys listed in the worklog 5-a entry (folder
  paths, default exports). Suggest also widening `use-session`'s SessionUser.socials typing.
- 6-a: billing notifications can be derived from SubscriptionEvent rows; MRR = active subs ×
  plan priceMonthly (yearly ÷ 12 if strict).
- No page routes created, no other agents' files edited, prisma schema untouched, all client
  fetches relative.
