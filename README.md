# MOHAMMED NIHAD KP Portfolio & Admin

Welcome to the **MOHAMMED NIHAD KP Portfolio & Admin** platform — an AI-powered, high-performance web application built for MOHAMMED NIHAD KP. 

## App Architecture Overview

This platform is a Next.js (v16) application utilizing a **Single Page Application (SPA)** architecture mounted on a Next.js Server-Side Catch-All route (`src/app/[[...slug]]/page.tsx`). It provides an ultra-fast client-side experience with perfect Search Engine Optimization (SEO) capabilities.

### 1. Database & Persistence
The app relies on a PostgreSQL database managed via Prisma ORM.
- **Schema:** Found in `prisma/schema.prisma`. It contains models for Users, Posts, Products, Ad Plans, and Analytics.
- **Client:** A singleton database client is instantiated in `src/lib/db.ts`.

### 2. Backend (API Layer)
Next.js Route Handlers (`src/app/api/...`) serve as the backend REST endpoints.
- **Centralized Wrapper:** All API endpoints are wrapped in `withApi` (`src/lib/api-helpers.ts`) which handles error parsing, request extraction, and JSON serialization uniformly.
- **Authentication & Authorization:** The `src/lib/auth.ts` module uses Jose to parse JWT session cookies. The API guards use `requireRole` and `requireUser` to enforce strict access controls (e.g., ensuring a user can only edit their own posts).

### 3. Frontend Routing (Client-Side)
The frontend completely bypasses traditional browser reloads to achieve sub-100ms view transitions.
- **AppRouter (`src/components/router/app-router.tsx`):** Reads the browser's URL using the HTML5 History API, matches it against a central route registry (`src/router/routes.ts`), and dynamically injects components.
- **View Registry:** To prevent a massive JavaScript bundle, views are lazily loaded and registered in `src/router/view-registry.ts`.
- **Navigation:** The `navigate()` function (`src/hooks/use-router.tsx`) pushes the new path to the browser history and emits a `popstate` event to trigger a re-render. All internal links use the `<ALink>` component to intercept standard clicks.

### 4. SEO & Metadata
Next.js Server-Side Rendering (SSR) intercepts deep links before the SPA loads.
- **Dynamic SEO (`src/app/[[...slug]]/page.tsx`):** When a crawler (like Googlebot) visits a URL (e.g., `/blog/my-post`), this server file queries the database for that specific post and injects the proper `<title>`, `<meta>`, and `OpenGraph` tags directly into the HTML. 
- **Site-Wide Fallbacks:** General metadata and structured data (`JSON-LD`) for the business and owner are injected via `src/app/layout.tsx`.

## Key Commands
- `npm run dev`: Start local development server.
- `npm run build`: Generates Prisma Client, syncs database, and runs the Next.js optimized production build.
- `npm run db:push`: Push the Prisma schema state to the connected database.
