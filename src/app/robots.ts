import type { MetadataRoute } from "next";

/** robots.txt — crawl rules for Google Search Console readiness. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/account", "/onboarding", "/auth"],
      },
    ],
    sitemap: "https://mnkp.vercel.app/sitemap.xml",
  };
}
