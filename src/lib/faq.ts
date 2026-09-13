/**
 * MN.KP FAQ registry — question-formulated items for the Help Center (#/support)
 * and the FAQPage JSON-LD (AEO). Owned by Task 3-b (BUILD CONTRACT §5, §8).
 *
 * Consumers: support-view.tsx (accordion + FAQPage schema). Reuse shape note
 * for other agents: FAQ_ITEMS is a plain readonly array — import FAQ_ITEMS,
 * FAQ_CATEGORIES, FaqItem and FaqCategory as needed.
 */

export type FaqCategory = "services" | "orders" | "payments" | "privacy" | "support";

export interface FaqItem {
  question: string;
  answer: string;
  category: FaqCategory;
}

export const FAQ_ITEMS: FaqItem[] = [
  /* ------------------------------ services ------------------------------ */
  {
    category: "services",
    question: "What services does MN.KP offer in Calicut?",
    answer:
      "MN.KP offers five core services: AI-powered web and app development (from ₹4,999), AI mastery and training (from ₹2,999), photography and photo editing (from ₹1,499), videography and video editing (from ₹2,499), and marketing and growth consulting (from ₹3,999). Every engagement starts with a free quote within 24 hours.",
  },
  {
    category: "services",
    question: "How fast is a typical website project?",
    answer:
      "Most marketing sites and landing pages ship in 3–10 working days, thanks to an AI-assisted workflow that covers design, build, testing and deployment. Larger web apps are milestone-based with the timeline agreed before work begins, and every launch includes 30 days of post-launch support.",
  },
  {
    category: "services",
    question: "Do you work with clients outside Kerala?",
    answer:
      "Yes. MN.KP is based in Calicut, Kerala, but works with clients across India and worldwide over WhatsApp, email and video calls. Payments are accepted in Indian Rupees and all deliverables are handed over digitally, so distance is never a blocker.",
  },

  /* ------------------------------- orders ------------------------------- */
  {
    category: "orders",
    question: "How do affiliate links work on this site?",
    answer:
      "Some product links on MN.KP are affiliate links to Amazon.in and Flipkart. If you buy through them, MN.KP may earn a small commission paid by the merchant — at no extra cost to you. Every product page carries this disclosure, and the final price is always set by the merchant at checkout.",
  },
  {
    category: "orders",
    question: "Can I get a refund on a digital template?",
    answer:
      "Yes. First-party digital products bought on MN.KP carry a 7-day refund window from the delivery email, covering defective files, items not as described, and accidental or duplicate purchases. Products bought through affiliate links follow the merchant's own refund policy instead.",
  },
  {
    category: "orders",
    question: "Who handles shipping and returns for products I buy through the store?",
    answer:
      "The merchant does. Physical products reached through MN.KP links are sold, shipped and serviced by Amazon, Flipkart or the listed marketplace — their shipping timelines and return windows apply. MN.KP curates the recommendations but never warehouses or ships products.",
  },
  {
    category: "orders",
    question: "How do I download my digital purchase?",
    answer:
      "Digital products such as templates and presets are delivered instantly by email after checkout, with a download link inside. If the email has not arrived within a few minutes, check the spam folder, then contact intobusyness@gmail.com and the link will be resent quickly.",
  },

  /* ------------------------------ payments ------------------------------ */
  {
    category: "payments",
    question: "Which payment methods are supported?",
    answer:
      "Service invoices and first-party digital products are billed in Indian Rupees and support UPI, cards and net banking through the payment provider. Affiliate orders are paid directly to the merchant (Amazon.in, Flipkart) with their own payment options.",
  },
  {
    category: "payments",
    question: "How do refunds work?",
    answer:
      "First-party digital products are refunded within 14 days if the file is faulty or the link never arrives. Physical affiliate orders follow the merchant's own return window. Service engagements follow the milestones agreed in the written scope.",
  },

  /* ------------------------------- privacy ------------------------------ */
  {
    category: "privacy",
    question: "How is my data handled?",
    answer:
      "MN.KP follows India's DPDP Act 2023, with GDPR and CCPA-level protections for international visitors. Only data needed to run the platform is collected, it is never sold, and you can request access, correction or deletion at any time by emailing intobusyness@gmail.com.",
  },
  {
    category: "privacy",
    question: "How do I delete my account and data?",
    answer:
      "Send a request to intobusyness@gmail.com or use Account → Settings. Verified deletion requests are completed within 30 days, after which your profile, inquiries and newsletter entries are removed — except records Indian tax law requires MN.KP to retain briefly.",
  },
  {
    category: "privacy",
    question: "Can I browse MN.KP without marketing cookies?",
    answer:
      "Yes. On your first visit the cookie banner lets you reject everything optional, and you can revisit the choice anytime from the preferences link. Necessary cookies — the ones that keep you signed in — stay on, but analytics and marketing cookies are entirely optional.",
  },

  /* ------------------------------- support ------------------------------ */
  {
    category: "support",
    question: "How do I reset my password?",
    answer:
      "Open the sign-in page and choose \"Forgot password\", then enter your account email — a reset link arrives within a few minutes and stays valid for one hour. If it does not arrive, check the spam folder or contact intobusyness@gmail.com.",
  },
  {
    category: "support",
    question: "How fast do you reply to inquiries?",
    answer:
      "Inquiries sent through the contact form, email or WhatsApp (+91 98467 50898) are answered within 24 hours on working days — usually much faster. Pro and Business subscribers get priority handling.",
  },
];

/** Ordered category tabs for the Help Center filter. */
export const FAQ_CATEGORIES: ReadonlyArray<{ value: "all" | FaqCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "services", label: "Services" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "privacy", label: "Privacy" },
  { value: "support", label: "Support" },
];
