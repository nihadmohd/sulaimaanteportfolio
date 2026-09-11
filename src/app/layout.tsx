import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SITE, SOCIALS } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP",
    template: "%s | MN.KP",
  },
  description: `MOHAMMED NIHAD KP is a Calicut-based AI-first developer and freelancer delivering fast websites, apps, photo and video services, plus an honestly curated affiliate store. ${SITE.tagline}`,
  keywords: [
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
  openGraph: {
    title: "MN.KP | AI-Powered Web & App Development in Calicut — MOHAMMED NIHAD KP",
    description: `Hire MOHAMMED NIHAD KP — Calicut-based AI-first developer and freelancer. ${SITE.tagline}`,
    type: "website",
    url: SITE.url,
    siteName: "MN.KP",
    images: [
      {
        url: "/images/brand/og-cover.png",
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
    images: ["/images/brand/og-cover.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
    },
    {
      "@type": "Person",
      "@id": `${SITE.url}/#person`,
      name: "MOHAMMED NIHAD KP",
      jobTitle: "Freelancer · Businessman · AI-First Developer",
      url: SITE.url,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Calicut (Kozhikode)",
        addressRegion: "Kerala",
        addressCountry: "IN",
      },
      sameAs: SOCIALS.map((s) => s.url),
    },
    {
      "@type": "LocalBusiness",
      "@id": `${SITE.url}/#localbusiness`,
      name: "MN.KP — MOHAMMED NIHAD KP",
      url: SITE.url,
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
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
