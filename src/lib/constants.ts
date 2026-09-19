/** MN.KP brand constants — single source of truth (orchestrator-owned). */

export const SITE = {
  name: "MN.KP",
  owner: "MOHAMMED NIHAD KP",
  roleLine: "Freelancer · Businessman · AI-First Developer",
  location: "Calicut (Kozhikode), Kerala, India",
  tagline:
    "I build apps, websites and digital solutions — not by writing every line from scratch, but by mastering the AI tools of tomorrow.",
  email: "intobusyness@gmail.com",
  phone: "+91 98467 50898",
  phoneRaw: "919846750898",
  whatsappUrl: "https://api.whatsapp.com/send?phone=919846750898&text=Hello...!",
  address: "Calicut (Kozhikode), Kerala, India",
  geo: { lat: 11.2588, lng: 75.7804 },
  mapEmbedUrl: "https://maps.google.com/maps?q=Kozhikode,+Kerala,+India&output=embed",
  cvUrl: "https://drive.google.com/file/d/1wzvYQdy3LTLekoCOhytPM5m0AGO0n9nr/preview",
  /** Change to the production domain on deploy (used for canonical/sitemap/JSON-LD). */
  url: "https://mohdnihadkp.vercel.app",
  ogImage: "/images/brand/og-cover.webp",
} as const;

export interface SocialLink {
  name: string;
  url: string;
  icon: string; // lucide icon key, resolved in components
}

export const SOCIALS: SocialLink[] = [
  { name: "WhatsApp", url: "https://api.whatsapp.com/send?phone=919846750898&text=Hello...!", icon: "whatsapp" },
  { name: "Instagram", url: "https://www.instagram.com/mohdnihadkp", icon: "instagram" },
  { name: "LinkedIn", url: "https://www.linkedin.com/in/mohammed-nihad-kp-71b6b6339", icon: "linkedin" },
  { name: "X", url: "https://x.com/mohdnihadkp", icon: "x" },
  { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61589286702060", icon: "facebook" },
  { name: "Threads", url: "https://www.threads.com/@mohdnihadkp", icon: "threads" },
  { name: "Pinterest", url: "https://pin.it/4SKTJurgS", icon: "pinterest" },
  { name: "Google Business", url: "https://share.google/6p5tbrpjnGFZbk0eR", icon: "globe" },
];

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const NAV_MAIN: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Blog", href: "/blog", icon: "newspaper" },
  { label: "Store", href: "/store", icon: "shopping-bag" },
  { label: "Ventures", href: "/ventures", icon: "rocket" },
  { label: "Services", href: "/services", icon: "sparkles" },
  { label: "About", href: "/about", icon: "user" },
  { label: "Contact", href: "/contact", icon: "mail" },
];

export const MOBILE_TABS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Blog", href: "/blog", icon: "newspaper" },
  { label: "Store", href: "/store", icon: "shopping-bag" },
  { label: "Services", href: "/services", icon: "sparkles" },
];

export interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

/** Default footer — fully editable from Admin & Developer → Settings → Footer. */
export const FOOTER_DEFAULT: {
  tagline: string;
  columns: FooterColumn[];
  copyright: string;
  socialsEnabled: boolean;
} = {
  tagline: "AI-powered web, app, photo and video solutions from Calicut, Kerala — delivered fast, anywhere in the world.",
  columns: [
    {
      title: "Platform",
      links: [
        { label: "Home", href: "/" },
        { label: "Blog", href: "/blog" },
        { label: "Affiliate Store", href: "/store" },
        { label: "Ventures & Ideas", href: "/ventures" },
        { label: "Services", href: "/services" },
        { label: "About", href: "/about" },
      ],
    },
    {
      title: "Connect",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Support & Help", href: "/support" },
        { label: "Advertise With Us", href: "/advertise" },
        { label: "WhatsApp", href: "https://api.whatsapp.com/send?phone=919846750898&text=Hello...!" },
        { label: "LinkedIn", href: "https://www.linkedin.com/in/mohammed-nihad-kp-71b6b6339" },
        { label: "View CV", href: "https://drive.google.com/file/d/1wzvYQdy3LTLekoCOhytPM5m0AGO0n9nr/preview" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/legal/privacy-policy" },
        { label: "Terms of Service", href: "/legal/terms-of-service" },
        { label: "Cookie Policy", href: "/legal/cookie-policy" },
        { label: "Affiliate Disclosure", href: "/legal/affiliate-disclosure" },
        { label: "All Policies", href: "/legal" },
      ],
    },
  ],
  copyright: "MN.KP — MOHAMMED NIHAD KP. All rights reserved.",
  socialsEnabled: true,
};

export const COOKIE_CONSENT_KEY = "mnkp_cookie_consent";
/**
 * Fired on window whenever the cookie-consent value changes (set or cleared)
 * so analytics loaders (site-analytics.tsx) can re-evaluate without a reload.
 * detail: ConsentValue | null (null = consent cleared).
 */
export const CONSENT_CHANGE_EVENT = "mnkp:consent-change";
export const VIEW_DEDUPE_PREFIX = "mnkp_pv_";
export const PRESENCE_SOCKET_QUERY = "XTransformPort=3003";
