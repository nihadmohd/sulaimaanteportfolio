# MIGRATION GUIDE — From this project to your live site

**Your goal:** take this MN.KP platform, put it on GitHub, deploy it on Vercel at
`https://mohdnihadkp.vercel.app`, connect a **Neon** PostgreSQL database, and bring
your **old website's blogs and products** into it.

This guide follows **your exact plan**, step by step. Do them in order.
Copy-paste blocks marked `▶ PROMPT FOR ANTIGRAVITY` directly into Antigravity.

---

## The big picture (what actually happens)

```
[Sandbox project]  →  download  →  [your computer]
                                    │  (optional: more work in Antigravity)
                                    ▼
                              [GitHub repo]  ← push
                                    │
                                    ▼
                          [Vercel deploy]  ← auto-builds
                          connects to [Neon database]
                                    │
                                    ▼
                    [Admin → Import] brings your OLD blogs/products in
```

Your old site's content is **not** moved by git or Vercel — it is imported through
the **Admin → Import** tool built into this platform (Step 6). The database is not
copied — it is created fresh on Neon and seeded (Step 3).

---

## STEP 1 — Download this project

Download the whole project folder (this sandbox's "Download" / export button).

What matters for production:

| Keep | Why |
|---|---|
| `src/`, `prisma/`, `public/`, `package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `components.json` | The app itself |
| `scripts/seed-ads.ts` | Demo ads seeder (optional but nice) |
| `mini-services/presence-service/` | Optional live-counter service (see Step 8) |
| `db/`, `.env`, `dev.log`, `tool-results/`, `agent-ctx/` | Sandbox-only — safe to delete before pushing |

> **Tip:** delete `db/` (the local SQLite file) and `.env` before your first git
> push so no local data or secrets land on GitHub.

---

## STEP 2 — Create the Neon database (your "neon database key")

1. Go to **https://neon.com** → sign in → **Create project** (name it `mnkp`).
2. When the project opens you'll see a **connection string** like:
   ```
   postgresql://USER:PASSWORD@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Copy the **Pooled** connection string (Neon dashboard → "Connect" → pooled /
   `-pooler` host). This is your **DATABASE_URL** — treat it like a password.
4. Also generate a second secret for login sessions: any long random string
   (e.g. from https://randomkey.io — 64 characters).

You now have the two "keys" you'll need:
- `DATABASE_URL` → the Neon pooled connection string
- `JWT_SECRET` → a long random string

---

## STEP 3 — Point this project at Neon (the one-line database switch)

This project runs on **Prisma**. It used SQLite inside the sandbox; for Neon you
switch it to PostgreSQL. The schema was written so that **only one line changes**:

`prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"   // was: "sqlite"
  url      = env("DATABASE_URL")
}
```

Nothing else changes — every JSON column, date and index in this schema works
identically on Postgres. (A Supabase-oriented DDL also exists at
`supabase/schema.sql` if you ever prefer that platform — you do NOT need it for Neon.)

### ▶ PROMPT FOR ANTIGRAVITY (copy-paste):

> In this Next.js project, switch the database from SQLite to Neon PostgreSQL:
> 1. In `prisma/schema.prisma`, change the datasource `provider` from `"sqlite"` to `"postgresql"`. Do not change anything else in the schema.
> 2. Create a `.env` file (and make sure `.env` is in `.gitignore`) with:
>    `DATABASE_URL="<my Neon pooled connection string>"`
>    `JWT_SECRET="<my long random string>"`
> 3. Run `npm install` if needed, then `npx prisma db push` to create all tables on Neon.
> 4. Run the seed with `npx tsx prisma/seed.ts` (install tsx with `npm i -D tsx` if missing). If the seed script fails on imports, fix only the import paths, not the logic.
> 5. Optionally run `npx tsx scripts/seed-ads.ts` to add the demo ads.
> 6. Run `npm run dev` and confirm `http://localhost:3000` loads and you can log in at the admin login with `intobusyness@gmail.com` / `Nihad@Admin2025`.
> Do not run `prisma migrate` — only `prisma db push`.

If you prefer doing it by hand: install [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
and use `bun prisma/seed.ts` / `bun scripts/seed-ads.ts` — the seed scripts run
natively with Bun and TypeScript.

**Log in and change the admin password immediately:**
`#/account/settings` → New password. (Admin email: `intobusyness@gmail.com`,
seeded password: `Nihad@Admin2025`.)

---

## STEP 4 — Fix the build command for Vercel

The sandbox `package.json` has a build script made for the sandbox. On your
machine, change it in `package.json`:

```json
"scripts": {
  "dev": "next dev -p 3000",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint .",
  "db:push": "prisma db push",
  "db:generate": "prisma generate"
}
```

(You can delete `db:migrate` / `db:reset` — this project uses `db:push` only.)

### ▶ PROMPT FOR ANTIGRAVITY:

> In package.json: replace the "build" script with "prisma generate && next build",
> replace "start" with "next start", replace "dev" with "next dev -p 3000", keep
> "lint" and the db:push/db:generate scripts, and remove the db:migrate and
> db:reset scripts and any standalone-copy logic. Also confirm `.gitignore`
> contains `.env`, `node_modules`, `.next`, and `db/`.

---

## STEP 5 — Push to GitHub and deploy on Vercel

This is the part where your **old site gets replaced** — exactly as you planned:

1. **Push to GitHub.** You said you'll push to your **current old website's repo**
   (the repo that `mohdnihadkp.vercel.app` deploys from). That works — but it
   OVERWRITES the old code. Recommended order:
   - First push this project to a **new repo** (e.g. `mnkp-platform`) — a safe backup.
   - Then push the same code to the **old repo** (or, cleaner: in Vercel, change the
     old project's **Root Directory / repo** to the new repo — Vercel → your old
     project → Settings → Git → Connected Git Repository → change it).
2. **In Vercel**, open the project that serves `mohdnihadkp.vercel.app`:
   - **Settings → Environment Variables** → add:
     | Key | Value |
     |---|---|
     | `DATABASE_URL` | your Neon pooled connection string |
     | `JWT_SECRET` | your long random string |
   - **Settings → Build & Output** → Framework: *Next.js* (auto-detected).
   - **Deploy** (pushing to the connected repo auto-deploys).
3. After the first deploy, visit `https://mohdnihadkp.vercel.app` and log in as
   admin (change the password if you skipped Step 3).

> **Important:** run `npx prisma db push` and the seed **once from your computer**
> (Step 3) — the Vercel build only runs `prisma generate` (creates the client),
> it does not create tables. That's the normal, safe setup.

---

## STEP 6 — Bring your OLD blogs and products in

Your old site's posts live in the old repo (likely as `.mdx`/`.md`/`.jsx` files or a
CMS). This platform imports them through **Admin → Import** (`#/admin/import`),
which accepts JSON.

### 6a. Export the old content as JSON

Open your old website's code on your computer and give Antigravity this prompt:

### ▶ PROMPT FOR ANTIGRAVITY (run inside your OLD website project):

> Scan this project and export all blog posts and all products/store items into
> two JSON files, `old-posts.json` and `old-products.json`, using EXACTLY these shapes:
>
> old-posts.json → an array of objects:
> ```json
> [{
>   "title": "post title",
>   "slug": "existing-url-slug-or-omit",
>   "excerpt": "1-2 sentence summary or null",
>   "content": "the full article body converted to MARKDOWN (keep headings, lists, links; convert images to ![alt](url))",
>   "coverImageUrl": "hero image URL or null",
>   "tags": ["tag1", "tag2"],
>   "publishedAt": "2024-06-01T10:00:00.000Z",
>   "seoTitle": "or null", "seoDescription": "or null"
> }]
> ```
>
> old-products.json → an array of objects:
> ```json
> [{
>   "name": "product name",
>   "tagline": "short one-liner or null",
>   "description": "markdown description or null",
>   "brand": "or null", "merchant": "Amazon/Flipkart/etc or null",
>   "imageUrl": "main image URL or null",
>   "price": 29990, "compareAtPrice": 34990,
>   "affiliateUrl": "https://www.amazon.in/dp/...",
>   "rating": 4.5,
>   "pros": ["..."], "cons": ["..."]
> }]
> ```
>
> Read the actual content of every post/product — do not invent or summarize.
> If content is in JSX/MDX components, unwrap it to plain Markdown. Save both
> files in the project root and print a count of each.

### 6b. Import into MN.KP

1. Open `https://mohdnihadkp.vercel.app/#/admin/import` (sign in as admin).
2. **Posts tab** → open `old-posts.json` → copy its full contents → paste →
   **Validate** (shows "N posts ready") → **Import**.
3. **Products tab** → same with `old-products.json`.
4. You'll see a green summary (created) / amber (skipped duplicates) / red (errors).
   **Re-running is always safe** — existing slugs are never overwritten.

Your old content now lives in the new platform with working SEO fields, view
counters, affiliate click tracking and share buttons.

---

## STEP 7 — Post-launch checklist

- [ ] Log in → `#/account/settings` → change the admin password
- [ ] `#/admin/settings` → update Brand/Footer/SEO/Features to your taste
      (everything is editable and every change is undo-able in `#/admin/activity`)
- [ ] `#/admin/ads` → review the 6 demo ads, switch off what you don't want
- [ ] Google Search Console → add property `mohdnihadkp.vercel.app` → submit
      `https://mohdnihadkp.vercel.app/sitemap.xml`
- [ ] Test: create a post, toggle an ad on/off, submit the contact form,
      check it arrives in `#/admin/inquiries`, then undo a change in Activity

## STEP 8 — Notes on the live-visitor badge (optional)

The "N online" badge uses a small socket.io service (port 3003 in the sandbox).
Vercel's serverless platform can't host that service, so on Vercel the badge
**hides itself gracefully** — nothing breaks. If you want it live again, either:

- Deploy `mini-services/presence-service/` on a tiny host (Railway / Render /
  Fly.io free tier — it's a ~100-line Bun service), set its URL where the
  frontend connects, or
- Ask Antigravity to swap `src/hooks/use-presence.ts` to Supabase Realtime or
  Ably/Pusher (the hook is isolated for exactly this reason).

## STEP 9 — Optional Phase 2 (SEO upgrade): real routes

This build uses hash routes (`#/blog/slug`) because the preview sandbox only
exposes one page. The architecture was built to lift every view to a real file
route later (`src/router/routes.ts` is the exact 1:1 map — every `pattern`
becomes an App Router folder). When you're settled:

### ▶ PROMPT FOR ANTIGRAVITY:

> Convert this Next.js app from hash routing to real App Router file routes.
> `src/router/routes.ts` maps route keys to patterns (e.g. "/blog/:slug"). For
> every route, create the matching folder under src/app (e.g. src/app/blog/[slug]/page.tsx)
> rendering the view component from src/components/views (see
> src/router/view-registry.ts for the key → component mapping). Keep all API
> routes as-is. Preserve the SEOHead title/description/noindex per route from
> routes.ts. Remove the hash router afterwards. Verify every link in
> src/lib/constants.ts (NAV_MAIN, FOOTER_DEFAULT) is updated from "#/x" to "/x".

---

## Quick reference — the two keys

| Secret | Where it goes |
|---|---|
| `DATABASE_URL` (Neon pooled string) | `.env` locally + Vercel Environment Variables |
| `JWT_SECRET` (long random string) | `.env` locally + Vercel Environment Variables |

That's the whole journey: **Neon keys → one-line Prisma switch → GitHub →
Vercel env vars → deploy → Admin → Import → done.**
