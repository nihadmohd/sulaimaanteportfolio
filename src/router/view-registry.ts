import { lazy, type ComponentType } from "react";

/**
 * View registry — maps route keys (src/router/routes.ts) to lazily-loaded
 * view components. Every view is a default export; code-splitting keeps the
 * initial bundle small on low-end devices.
 */
export const viewRegistry: Record<string, React.LazyExoticComponent<ComponentType>> = {
  // public
  home: lazy(() => import("@/components/views/home/home-view")),
  about: lazy(() => import("@/components/views/about/about-view")),
  services: lazy(() => import("@/components/views/services/services-view")),
  contact: lazy(() => import("@/components/views/contact/contact-view")),
  blog: lazy(() => import("@/components/views/blog/blog-view")),
  "blog-post": lazy(() => import("@/components/views/blog/post-view")),
  store: lazy(() => import("@/components/views/store/store-view")),
  "store-product": lazy(() => import("@/components/views/store/product-view")),
  support: lazy(() => import("@/components/views/support/support-view")),
  legal: lazy(() => import("@/components/views/legal/legal-view")),
  "legal-doc": lazy(() => import("@/components/views/legal/legal-view")),

  // auth lifecycle
  "auth-login": lazy(() => import("@/components/views/auth/login-view")),
  "auth-register": lazy(() => import("@/components/views/auth/register-view")),
  "auth-verify": lazy(() => import("@/components/views/auth/verify-email-view")),
  "auth-forgot-password": lazy(() => import("@/components/views/auth/forgot-password-view")),
  "auth-reset-password": lazy(() => import("@/components/views/auth/reset-password-view")),
  "admin-login": lazy(() => import("@/components/views/auth/admin-login-view")),
  onboarding: lazy(() => import("@/components/views/onboarding/onboarding-view")),

  // account
  account: lazy(() => import("@/components/views/account/dashboard-view")),
  "account-billing": lazy(() => import("@/components/views/account/billing-view")),
  "account-settings": lazy(() => import("@/components/views/account/settings-view")),

  // admin & developer
  admin: lazy(() => import("@/components/views/admin/overview-view")),
  "admin-posts": lazy(() => import("@/components/views/admin/posts-view")),
  "admin-post-edit": lazy(() => import("@/components/views/admin/post-edit-view")),
  "admin-products": lazy(() => import("@/components/views/admin/products-view")),
  "admin-product-edit": lazy(() => import("@/components/views/admin/product-edit-view")),
  "admin-categories": lazy(() => import("@/components/views/admin/categories-view")),
  "admin-inquiries": lazy(() => import("@/components/views/admin/inquiries-view")),
  "admin-users": lazy(() => import("@/components/views/admin/users-view")),
  "admin-subscribers": lazy(() => import("@/components/views/admin/subscribers-view")),
  "admin-plans": lazy(() => import("@/components/views/admin/plans-view")),
  "admin-settings": lazy(() => import("@/components/views/admin/settings-view")),
  "admin-ads": lazy(() => import("@/components/views/admin/ads-view")),
  "admin-marketing": lazy(() => import("@/components/views/admin/marketing-view")),
  "admin-activity": lazy(() => import("@/components/views/admin/activity-view")),
  "admin-import": lazy(() => import("@/components/views/admin/import-view")),
};
