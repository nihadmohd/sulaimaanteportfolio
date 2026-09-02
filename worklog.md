# Project Worklog — MOHAMMED NIHAD KP · Portfolio / Blog / Affiliate Store Platform

Shared worklog for all agents. Read before starting work; append (never overwrite) after finishing a Task ID.

---
Task ID: 1
Agent: Z.ai Code (orchestrator)
Task: Task 1 — Architecture blueprint: output complete Next.js directory structure + exact Supabase SQL schema. No implementation code yet (user gated UI code behind approval).

Work Log:
- Inspected existing scaffold: package.json (Next.js 16, React 19, full 48-component shadcn/ui set, Prisma 6, Zustand 5, TanStack Query 5, next-themes, react-markdown, recharts, react-hook-form, zod), prisma/schema.prisma (placeholder User/Post), src/ tree, examples/websocket demo.
- Confirmed environment constraints: single user-visible route (/), dev server on port 3000 via Caddy gateway, mini-services reachable via ?XTransformPort={port}, Prisma+SQLite only (no external Supabase access from sandbox).
- Designed architecture: SSR entry at src/app/page.tsx + hash-based client router; view components in src/components/views/* organized 1:1 with conventional App Router segments (liftable to real file routes on deploy); REST API routes under src/app/api/* for all backend logic; socket.io presence mini-service (port 3003) replacing Supabase Realtime; JWT httpOnly-cookie credentials auth (bcryptjs + jose) replacing Supabase Auth.
- Produced complete directory structure (~45 planned files across api/, components/, views/, lib/, hooks/, stores/, mini-services/).
- Produced exact Supabase PostgreSQL DDL — 12 tables + online_users_count view + get_online_count() RPC + sweep_presence() + 6 triggers + full RLS (least-privilege policies) + 25 indexes + plan seed — and saved it to supabase/schema.sql.
- Delivered Task 1 in chat, including the 1:1 Prisma/SQLite mirror schema; awaiting user approval.

Stage Summary:
- KEY DECISIONS (binding for all future agents):
  1. Sandbox runs Prisma/SQLite. supabase/schema.sql = production deploy target; prisma/schema.prisma mirrors it 1:1 (text[] → JSON strings, enums → String + zod validation, numeric → Float).
  2. ALL user-facing UI compiles into src/app/page.tsx (the only visible route) using hash routes (e.g. #/blog/my-slug, #/admin). View components must stay route-agnostic and liftable.
  3. Realtime live-user counter = mini-services/presence-service (socket.io, port 3003, in-memory presence Map, broadcast-only, 0 DB writes). Frontend connects via io("/?XTransformPort=3003"); REST /api/presence is polling fallback.
  4. Auth = credentials (email+password) via POST /api/auth/* routes; bcryptjs hashing; jose JWT in httpOnly cookie. Roles: reader|author|editor|admin. Guards enforced in both route registry (client) and API layer (server).
  5. UX states = 9 reusable components in src/components/states/* (404, 403, 500, maintenance, empty, loading, error, success, session-expired) shared by the client router AND API error envelopes.
  6. Legal = 16 static docs in src/lib/legal.ts registry, rendered by legal-view at #/legal/[slug].
  7. Theme: light/dark via next-themes; palette = emerald primary + zinc neutrals + amber accent. NO indigo/blue anywhere.
  8. Tables: profiles(User), categories, posts, products, inquiries, plans, subscriptions, subscription_events, newsletter_subscribers, affiliate_clicks, visitor_sessions, site_settings (+ view + RPCs).
- Artifacts: supabase/schema.sql (production DDL), this worklog.
- Next: Tasks 2–8 (data layer → design system → public views → auth/lifecycle → admin CMS → realtime → SEO + browser verification) upon user approval.
