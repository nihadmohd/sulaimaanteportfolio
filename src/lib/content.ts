/** MN.KP content registry — services, brands, about copy, stats (orchestrator-owned). */

export interface Service {
  slug: string;
  name: string;
  icon: string; // lucide icon key
  blurb: string;
  deliverables: string[];
  priceFrom: number; // INR
  relatedPosts: string[]; // blog slugs
}

export const SERVICES: Service[] = [
  {
    slug: "ai-development",
    name: "AI-Powered Web & App Development",
    icon: "rocket",
    blurb:
      "Websites, web apps and automations built in days, not months — powered by a battle-tested AI workflow covering development, testing and deployment.",
    deliverables: [
      "Responsive website or web app (SEO-ready)",
      "Deployment on Vercel / Netlify / Firebase",
      "Analytics + Search Console setup",
      "Performance optimization for low-end devices",
      "30 days of post-launch support",
    ],
    priceFrom: 4999,
    relatedPosts: ["ai-development-workflow-calicut", "best-ai-tools-rapid-development-2025"],
  },
  {
    slug: "ai-mastery",
    name: "AI Mastery & Training",
    icon: "brain-circuit",
    blurb:
      "One-to-one and team coaching that turns AI tools into a daily superpower — for development, content, business operations and automation.",
    deliverables: [
      "Personalized AI tool curriculum",
      "Hands-on workflow building sessions",
      "Prompt libraries and templates",
      "Team onboarding workshops",
    ],
    priceFrom: 2999,
    relatedPosts: ["diploma-to-ai-developer", "best-ai-tools-rapid-development-2025"],
  },
  {
    slug: "photography",
    name: "Photography & Photo Editing",
    icon: "camera",
    blurb:
      "Portraits, products and events in and around Calicut — with a professional Lightroom + AI post-processing stack for a polished finish.",
    deliverables: [
      "Portrait / product / event shoots",
      "AI-assisted retouching and color grading",
      "Web-optimized image delivery",
      "Same-week turnaround",
    ],
    priceFrom: 1499,
    relatedPosts: ["photography-ai-editing-stack"],
  },
  {
    slug: "videography",
    name: "Videography & Video Editing",
    icon: "video",
    blurb:
      "Promo videos, reels and event films with a complete creative media pipeline — shot, edited and delivered with CapCut and Adobe workflows.",
    deliverables: [
      "Promo / reels / event videography",
      "Professional editing and sound design",
      "Vertical + horizontal format masters",
      "Platform-ready exports",
    ],
    priceFrom: 2499,
    relatedPosts: ["photography-ai-editing-stack", "kp-foundation-platform-vision"],
  },
  {
    slug: "marketing",
    name: "Marketing & Growth",
    icon: "trending-up",
    blurb:
      "Market analysis, business planning and team management for small businesses and creators — strategy that survives contact with reality.",
    deliverables: [
      "Market and competitor analysis",
      "Business plan and positioning",
      "Social media growth playbooks",
      "Monthly strategy check-ins",
    ],
    priceFrom: 3999,
    relatedPosts: ["freelancing-from-calicut-global-business", "kp-foundation-platform-vision"],
  },
];

export interface Brand {
  name: string;
  role: string;
  description: string;
  href: string; // external or hash route
}

export const BRANDS: Brand[] = [
  {
    name: "KP Foundation",
    role: "Flagship platform",
    description:
      "The all-in-one business platform — every kind of business is born under one roof: services, commerce, community and education.",
    href: "/blog/kp-foundation-platform-vision",
  },
  {
    name: "Calicut Store",
    role: "Commerce",
    description: "Curated shopping for Calicut — local finds and trusted essentials, delivered simply.",
    href: "https://calicutstore.vercel.app/",
  },
  {
    name: "Chaliyam",
    role: "Free service facility",
    description: "A community-first initiative offering free services to the people of Chaliyam.",
    href: "https://chaliyam.vercel.app/",
  },
];

export const PROJECTS: Array<{ name: string; href: string; description: string }> = [
  {
    name: "Chaliyam Connect",
    href: "https://chaliyam.vercel.app/",
    description: "Community connection platform for Chaliyam.",
  },
  {
    name: "Calicut Gold",
    href: "https://calicutgold.vercel.app/",
    description: "Gold and jewelry marketplace for Calicut.",
  },
  {
    name: "PolyStudy",
    href: "https://polystudy.vercel.app/",
    description: "Study platform for polytechnic students.",
  },
];

export const ABOUT_PARAGRAPHS: string[] = [
  "I build apps, websites, and digital solutions — not by writing every line of code from scratch, but by mastering the AI tools of tomorrow.",
  "After pursuing a Computer Engineering diploma, I realized my true strength lies outside the traditional classroom: in rapid execution, resourcefulness, and leveraging artificial intelligence to solve real-world problems. I don't just study technology; I use it to bridge the gap between an idea and its final execution.",
  "Instead of getting stuck in conventional methods, I utilize modern AI tools for software testing, development, and automation. Combined with my background in creative media, I bring a unique, multifaceted approach to every project I take on.",
];

export const PILLARS: Array<{ title: string; text: string }> = [
  {
    title: "AI-Driven Execution",
    text: "Expert in using AI tools for rapid web/app development and efficient software testing.",
  },
  {
    title: "Creative Media",
    text: "End-to-end videography, photography, and video editing to craft compelling narratives.",
  },
  {
    title: "Business Strategy",
    text: "Strong foundation in market analysis, business planning, and team management.",
  },
];

export const VISION = {
  headline: "My Global Vision",
  points: [
    "Travel to all 195 countries — and build a body of work that travels with me.",
    "Build financial independence that elevates my family.",
    "Educate others on harnessing the power of AI to overcome their own limitations.",
  ],
};

export const EXPLORING: string[] = [
  "High-paying global career opportunities — Abroad, Remote, or Maritime/Ship roles.",
  "Fully-funded international scholarships — Europe, GCC, China.",
  "Networking with tech entrepreneurs, AI innovators, and global professionals.",
];

export const STATS: Array<{ value: string; label: string }> = [
  { value: "195", label: "Countries on the mission" },
  { value: "3", label: "Brands under KP Foundation" },
  { value: "5", label: "Services offered" },
  { value: "10+", label: "Platforms shipped" },
];

export const STACK = {
  build: ["Firebase", "Vercel", "Netlify", "GitHub", "Supabase", "Neon"],
  creative: ["Google ecosystem", "AI tools", "CapCut", "Adobe", "Canva", "PicsArt", "Pixellab", "Lightroom"],
};

export const EDUCATION: Array<{ title: string; note: string }> = [
  {
    title: "Diploma in Computer Engineering",
    note: "The fundamentals — while the real edge came from building with AI every day.",
  },
  {
    title: "Fully-funded international scholarship",
    note: "Currently waiting — Europe, GCC or China, to expand education while working.",
  },
];
