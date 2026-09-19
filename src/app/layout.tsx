import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SITE, SOCIALS } from "@/lib/constants";
import { db } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Owner-managed SEO tokens (Admin → Settings → SEO / SEO Toolkit). */
async function loadSeoSettings(): Promise<{
  googleVerification: string;
  bingVerification: string;
  keywords: string[];
}> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: "seo" } });
    if (!row) return { googleVerification: "", bingVerification: "", keywords: [] };
    const parsed = JSON.parse(row.value) as {
      googleVerification?: unknown;
      bingVerification?: unknown;
      keywords?: unknown;
    };
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === "string")
      : [];
    return {
      googleVerification:
        typeof parsed.googleVerification === "string" ? parsed.googleVerification.trim() : "",
      bingVerification:
        typeof parsed.bingVerification === "string" ? parsed.bingVerification.trim() : "",
      keywords,
    };
  } catch {
    return { googleVerification: "", bingVerification: "", keywords: [] };
  }
}

/**
 * Dynamic metadata — emits the google-site-verification / msvalidate.01 meta
 * tags Search Console & Bing Webmaster Tools need, plus the owner's keyword
 * set. Static fallbacks keep the site crawlable when the DB is unreachable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await loadSeoSettings();
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: "MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP",
      template: "%s | MN.KP",
    },
    description: `MOHAMMED NIHAD KP is a Calicut-based AI-first developer and freelancer delivering fast websites, apps, photo and video services, plus an honestly curated affiliate store. ${SITE.tagline}`,
    keywords: seo.keywords.length > 0 ? seo.keywords : [
      "AI developer Calicut",
      "web development Kerala",
      "photography Calicut",
      "videography Kozhikode",
      "affiliate store",
      "MOHAMMED NIHAD KP",
    ],
    authors: [{ name: SITE.owner }],
    creator: SITE.owner,
    icons: {
      icon: ["/favicon.svg", "/favicon-32.png", "/icon-192.png"],
      apple: "/apple-touch-icon.png",
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: "MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP",
      description: `Hire MOHAMMED NIHAD KP — Calicut-based AI-first developer and freelancer. ${SITE.tagline}`,
      type: "website",
      url: SITE.url,
      siteName: "MN.KP",
      images: [
        {
          url: "/images/brand/og-cover.webp",
          width: 1344,
          height: 768,
          alt: "MN.KP — MOHAMMED NIHAD KP, AI-first developer from Calicut, Kerala",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "MN.KP | AI-Powered Web & App Development in Calicut",
      description: `AI-first websites, apps and creative media from Calicut, Kerala. ${SITE.tagline}`,
      images: ["/images/brand/og-cover.webp"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: seo.googleVerification || undefined,
      other: seo.bingVerification
        ? { "msvalidate.01": seo.bingVerification }
        : undefined,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* cover — lets the app paint under the notch/home indicator like a
     native iOS/Android app (safe areas via env(safe-area-inset-*)) */
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0F0E" },
  ],
};

/** Static site-level structured data (WebSite + Person + LocalBusiness). */
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: "MN.KP",
      url: SITE.url,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE.url}/#/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Person",
      "@id": `${SITE.url}/#person`,
      name: "MOHAMMED NIHAD KP",
      jobTitle: "Freelancer · Businessman · AI-First Developer",
      url: SITE.url,
      image: `${SITE.url}/images/brand/og-cover.webp`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Calicut (Kozhikode)",
        addressRegion: "Kerala",
        addressCountry: "IN",
      },
      sameAs: SOCIALS.map((s) => s.url),
    },
    {
      "@type": ["LocalBusiness", "ProfessionalService"],
      "@id": `${SITE.url}/#localbusiness`,
      name: "MN.KP — MOHAMMED NIHAD KP",
      url: SITE.url,
      image: `${SITE.url}/images/brand/og-cover.webp`,
      telephone: "+91-0000000000", // Placeholder until provided
      priceRange: "₹₹",
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          opens: "09:00",
          closes: "18:00",
        },
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kozhikode",
        addressRegion: "Kerala",
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: SITE.geo.lat,
        longitude: SITE.geo.lng,
      },
      areaServed: ["Calicut", "Kozhikode", "Kerala", "India", "Remote — Global"],
      sameAs: SOCIALS.map((s) => s.url),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What services does MN.KP offer?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "MN.KP offers AI-powered web and app development, photography, videography, and digital marketing services based in Calicut, Kerala.",
          },
        },
        {
          "@type": "Question",
          name: "Is MN.KP available for remote work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, while based in Calicut, MN.KP works with clients globally offering remote AI-first development and design services.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <script
          id="site-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
