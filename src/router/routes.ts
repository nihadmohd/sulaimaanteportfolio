/**
 * MN.KP route registry — the single source of truth for hash routes.
 * Mirrors the production App Router segment layout 1:1 (BUILD CONTRACT §3)
 * so views are liftable to real file routes on deploy.
 *
 * `key` values are the viewRegistry keys the orchestrator wires at integration.
 */

export type RouteGuard = "auth" | "staff";

export interface RouteEntry {
  /** viewRegistry key (e.g. "blog-post" — see src/router/view-registry.ts). */
  key: string;
  /** Pattern with :params, e.g. "/blog/:slug". Always leading slash, no trailing slash. */
  pattern: string;
  /** Default <title> content (without template suffix). Views may override via SEOHead. */
  title: string;
  /** Default meta description. Views may override via SEOHead. */
  description: string;
  /** When true, robots meta becomes noindex,follow (auth/admin/account/onboarding). */
  noindex?: boolean;
  /** auth → requires any signed-in user; staff → requires editor/admin role. */
  guard?: RouteGuard;
}

export const ROUTES: RouteEntry[] = [
  {
    key: "home",
    pattern: "/",
    title: "MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP",
    description:
      "Hire MOHAMMED NIHAD KP — Calicut-based AI-first developer & freelancer delivering fast websites, apps, photo & video services, and an honestly curated affiliate store.",
  },
  {
    key: "about",
    pattern: "/about",
    title: "About MOHAMMED NIHAD KP — AI-First Developer & Freelancer from Calicut | MN.KP",
    description:
      "From a Computer Engineering diploma in Calicut to AI-powered digital execution — the story, skills, stack and 195-country vision of Mohammed Nihad KP.",
  },
  {
    key: "services",
    pattern: "/services",
    title: "Services — AI Development, Photography & Videography in Calicut | MN.KP",
    description:
      "AI-powered web & app development, AI training, photography, videography, editing and marketing services in Calicut, Kerala. Free quote within 24 hours.",
  },
  {
    key: "blog",
    pattern: "/blog",
    title: "Blog — AI Tools, Development & Business Growth | MN.KP",
    description:
      "Practical guides on AI tools, rapid development workflows, freelancing and business growth — written from Calicut, useful everywhere.",
  },
  {
    key: "blog-post",
    pattern: "/blog/:slug",
    title: "Blog Post | MN.KP",
    description:
      "An article from the MN.KP blog — practical guides on AI tools, development and business growth from Calicut, Kerala.",
  },
  {
    key: "store",
    pattern: "/store",
    title: "Affiliate Store — Curated Tech & Creator Gear | MN.KP",
    description:
      "Honestly reviewed tech and creator gear — cameras, audio, accessories and digital tools — curated in Calicut for creators everywhere.",
  },
  {
    key: "store-product",
    pattern: "/store/:slug",
    title: "Product | MN.KP",
    description:
      "A curated affiliate product from the MN.KP store — honestly reviewed tech and creator gear.",
  },
  {
    key: "contact",
    pattern: "/contact",
    title: "Contact & Inquiries — Hire an AI Developer in Calicut | MN.KP",
    description:
      "Reach MOHAMMED NIHAD KP for projects, collaborations, scholarships or sponsorships. WhatsApp, email or the inquiry form — replies within 24 hours.",
  },
  {
    key: "support",
    pattern: "/support",
    title: "Support & Help Center — FAQ & Guides | MN.KP",
    description:
      "Answers about MN.KP services, affiliate orders, subscriptions, privacy and more — plus fast ways to get help.",
  },
  {
    key: "legal",
    pattern: "/legal",
    title: "Legal & Policies | MN.KP",
    description:
      "Privacy policy, terms of service, cookie policy, affiliate disclosure and every other MN.KP document in one place.",
  },
  {
    key: "legal-doc",
    pattern: "/legal/:slug",
    title: "Policy | MN.KP",
    description:
      "A legal and policy document for the MN.KP platform — privacy, terms, cookies, affiliate disclosure and more.",
  },
  // ---- auth (noindex) ----
  {
    key: "auth-login",
    pattern: "/auth/login",
    title: "Sign In | MN.KP",
    description: "Sign in to your MN.KP account to manage subscriptions, inquiries and content.",
    noindex: true,
  },
  {
    key: "auth-register",
    pattern: "/auth/register",
    title: "Create Account | MN.KP",
    description: "Create a free MN.KP account — newsletters, subscriptions and premium content.",
    noindex: true,
  },
  {
    key: "auth-verify",
    pattern: "/auth/verify",
    title: "Verify Email | MN.KP",
    description: "Confirm your email address to activate your MN.KP account.",
    noindex: true,
  },
  {
    key: "auth-forgot-password",
    pattern: "/auth/forgot-password",
    title: "Forgot Password | MN.KP",
    description: "Request a password reset link for your MN.KP account.",
    noindex: true,
  },
  {
    key: "auth-reset-password",
    pattern: "/auth/reset-password",
    title: "Reset Password | MN.KP",
    description: "Choose a new password for your MN.KP account.",
    noindex: true,
  },
  // ---- admin (noindex, staff) ----
  {
    key: "admin-login",
    pattern: "/admin/login",
    title: "Admin Sign In | MN.KP",
    description: "Sign in to the MN.KP Admin & Developer console.",
    noindex: true,
  },
  {
    key: "admin",
    pattern: "/admin",
    title: "Admin Overview | MN.KP",
    description: "MN.KP Admin & Developer console — KPIs, live presence and quick actions.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-posts",
    pattern: "/admin/posts",
    title: "Posts | MN.KP Admin",
    description: "Create, edit and publish MN.KP blog posts.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-post-edit",
    pattern: "/admin/posts/:id",
    title: "Edit Post | MN.KP Admin",
    description: "Edit a MN.KP blog post.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-products",
    pattern: "/admin/products",
    title: "Products | MN.KP Admin",
    description: "Manage the MN.KP affiliate store catalog.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-product-edit",
    pattern: "/admin/products/:id",
    title: "Edit Product | MN.KP Admin",
    description: "Edit an affiliate store product.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-categories",
    pattern: "/admin/categories",
    title: "Categories | MN.KP Admin",
    description: "Manage blog and store categories.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-inquiries",
    pattern: "/admin/inquiries",
    title: "Inquiries | MN.KP Admin",
    description: "Review and respond to inbound inquiries.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-users",
    pattern: "/admin/users",
    title: "Users | MN.KP Admin",
    description: "Manage MN.KP accounts and roles.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-subscribers",
    pattern: "/admin/subscribers",
    title: "Subscribers | MN.KP Admin",
    description: "Manage the MN.KP newsletter list.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-plans",
    pattern: "/admin/plans",
    title: "Plans | MN.KP Admin",
    description: "Manage subscription plans and pricing.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-settings",
    pattern: "/admin/settings",
    title: "Settings | MN.KP Admin",
    description: "Brand, footer, media, ads, features, SEO and maintenance settings.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-ads",
    pattern: "/admin/ads",
    title: "Ad Manager | MN.KP Admin",
    description: "Create ads, control placements, scheduling, on/off switches and performance.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-marketing",
    pattern: "/admin/marketing",
    title: "Marketing Hub | MN.KP Admin",
    description: "Ad performance, affiliate funnel, top content and newsletter growth.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-activity",
    pattern: "/admin/activity",
    title: "Activity & Undo | MN.KP Admin",
    description: "Every admin change logged with one-click undo and redo.",
    noindex: true,
    guard: "staff",
  },
  {
    key: "admin-import",
    pattern: "/admin/import",
    title: "Import Content | MN.KP Admin",
    description: "Bulk-import posts and products from your old website via JSON.",
    noindex: true,
    guard: "staff",
  },
  // ---- lifecycle (noindex, auth) ----
  {
    key: "onboarding",
    pattern: "/onboarding",
    title: "Welcome — Set Up Your Account | MN.KP",
    description: "A four-step onboarding flow for new MN.KP accounts.",
    noindex: true,
    guard: "auth",
  },
  {
    key: "account",
    pattern: "/account",
    title: "Your Account | MN.KP",
    description: "Your MN.KP profile, activity and subscription overview.",
    noindex: true,
    guard: "auth",
  },
  {
    key: "account-billing",
    pattern: "/account/billing",
    title: "Billing & Subscription | MN.KP",
    description: "Manage your MN.KP subscription, plan and billing history.",
    noindex: true,
    guard: "auth",
  },
  {
    key: "account-settings",
    pattern: "/account/settings",
    title: "Account Settings | MN.KP",
    description: "Update your MN.KP profile, password and preferences.",
    noindex: true,
    guard: "auth",
  },
];

export interface RouteMatch {
  route: RouteEntry;
  params: Record<string, string>;
}

/** Compile a pattern like "/blog/:slug" into a RegExp with named capture groups. */
function patternToRegex(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.startsWith(":")
        ? `(?<${segment.slice(1)}>[^/]+)`
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    .join("/");
  return new RegExp(`^/${source}$`);
}

const compiled = ROUTES.map((route) => ({ route, regex: patternToRegex(route.pattern) }));

/** Normalize any path: leading slash, no trailing slash (except root). */
export function normalizePath(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return p;
}

/** Match a normalized path against the registry. Returns null when unknown. */
export function matchRoute(path: string): RouteMatch | null {
  const p = normalizePath(path);
  for (const { route, regex } of compiled) {
    const m = regex.exec(p);
    if (m) {
      // Static patterns (no :params) compile without named groups — m.groups
      // is undefined there, so default to an empty params object.
      return { route, params: m.groups ?? {} };
    }
  }
  return null;
}

/** Find a route entry by its registry key. */
export function routeByKey(key: string): RouteEntry | undefined {
  return ROUTES.find((r) => r.key === key);
}
