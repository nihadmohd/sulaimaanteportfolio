import type { MetadataRoute } from "next";

/** robots.txt — crawl rules for Google Search Console readiness. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/account", "/onboarding", "/auth", "/setup"],
      },
    ],
    sitemap: "https://mohdnihadkp.vercel.app/sitemap.xml",
    host: "https://mohdnihadkp.vercel.app",
  };
}
