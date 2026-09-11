/**
 * MN.KP legal registry — 18 static policy documents rendered at #/legal/:slug.
 *
 * Owned by Task 3-b (BUILD CONTRACT §5). Each doc carries unique AEO/GEO meta
 * (title + description), an ISO "last updated" date and structured sections.
 * Content is India-aware (DPDP Act 2023, IT Act 2000, GST, ASCI) and extends
 * GDPR / CCPA protections to international visitors, with affiliate
 * disclosure obligations per FTC + ASCI.
 *
 * Consumers: legal-view.tsx (index + doc), support-view.tsx (key-doc links),
 * sitemap/llms.txt (orchestrator, Task 8).
 */

export interface LegalDoc {
  slug: string;
  title: string;
  /** Unique meta description (<=160 chars) used for SEOHead + JSON-LD. */
  description: string;
  /** ISO date string, e.g. "2025-06-01". */
  updated: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
}

export const LEGAL_DOCS: LegalDoc[] = [
  /* ------------------------------------------------------------------ */
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description:
      "How MN.KP collects, uses, stores and protects your data under India's DPDP Act 2023 — plus GDPR and CCPA rights for international visitors.",
    updated: "2025-06-01",
    sections: [
      {
        heading: "Who we are and the data we handle",
        paragraphs: [
          "MN.KP (mnkp.dev) is the personal platform of MOHAMMED NIHAD KP, an AI-first developer, freelancer and businessman based in Calicut (Kozhikode), Kerala, India. This Privacy Policy explains what personal data the platform collects, why it is collected, how it is protected, and the rights you have over it.",
          "We operate as a data fiduciary under India's Digital Personal Data Protection Act, 2023 (DPDP Act), read with the Information Technology Act, 2000 and the rules made under it. Because MN.KP serves visitors from around the world, visitors from the EU, the UK and California are additionally afforded the protections of the GDPR and the CCPA/CPRA respectively.",
        ],
      },
      {
        heading: "Information we collect and why",
        paragraphs: [
          "Collection is deliberately minimal — only what the platform needs to function, to answer you, and to meet legal obligations:",
        ],
        bullets: [
          "Account data — your name, email address and a bcrypt-hashed password when you create an account.",
          "Inquiry data — the name, email, phone number and message you submit through the contact and inquiry forms.",
          "Newsletter data — your email address and subscription preferences.",
          "Usage data — anonymised page views, device type and approximate location, used in aggregate to understand traffic.",
          "Affiliate click data — the product links you follow, logged without tying them to your identity, to measure merchant performance.",
          "Payment data — processed by the payment provider; MN.KP never receives or stores full card numbers.",
        ],
      },
      {
        heading: "How we use, share and protect your data",
        paragraphs: [
          "Your data is used only to operate and improve the platform: answering inquiries within 24 hours, sending the newsletter you subscribed to, delivering subscription features such as premium content and member downloads, producing aggregate analytics, and complying with legal and tax obligations in India, including GST record-keeping where applicable.",
          "We never sell personal data. Data is shared only with the processors that keep MN.KP running — hosting, email delivery, analytics and payments — each bound by contractual restrictions. When you follow an affiliate link to Amazon.in, Flipkart or another merchant, the click is logged by that merchant's affiliate program and their own privacy policy applies from that point on.",
          "Technically, data is protected with TLS encryption in transit, hashed passwords, least-privilege database access and monitored APIs. Account data is retained while your account is active and for up to 30 days after deletion, except for records Indian tax law requires us to keep longer.",
        ],
      },
      {
        heading: "Your rights and how to exercise them",
        paragraphs: [
          "You can exercise any of the following rights at any time, free of charge, by emailing intobusyness@gmail.com or messaging WhatsApp +91 98467 50898. Requests are verified and actioned within 30 days — usually much faster:",
        ],
        bullets: [
          "Access — receive a copy of the personal data we hold about you.",
          "Correction — fix data that is inaccurate or incomplete.",
          "Erasure — delete your account and associated personal data.",
          "Withdrawal of consent — opt out of marketing emails and optional cookies at any time.",
          "Grievance redressal — escalate a concern to MOHAMMED NIHAD KP as the designated grievance officer.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    description:
      "The rules for using MN.KP — accounts, services, content ownership, affiliate purchases, liability and Kerala, India governing law.",
    updated: "2025-06-01",
    sections: [
      {
        heading: "The agreement between you and MN.KP",
        paragraphs: [
          "These Terms of Service govern your access to and use of mnkp.dev, including the blog, the affiliate store, first-party digital products, subscription plans and the services offered by MOHAMMED NIHAD KP (\"MN.KP\", \"we\"). By browsing, registering an account or purchasing anything through the platform, you accept these terms.",
          "MN.KP is a solo-operated business based in Calicut (Kozhikode), Kerala, India. Where these terms reference \"services\", they mean the professional engagements described on the Services page — web and app development, AI training, photography, videography and marketing — each governed by these terms plus the agreed written scope.",
        ],
      },
      {
        heading: "Accounts, orders and subscriptions",
        paragraphs: [
          "You agree to provide accurate information, keep your credentials confidential, and use the platform lawfully. Accounts are open to anyone aged 13 or above; making payments requires you to be of legal age in your jurisdiction.",
          "A few specifics:",
        ],
        bullets: [
          "Subscription plans are billed in Indian Rupees — Free at no cost, Pro at ₹399 per month (₹3,990 yearly) and Business at ₹1,499 per month (₹14,990 yearly) — and can be cancelled anytime as described in the Cancellation Policy.",
          "First-party digital products (templates, presets and similar) are licensed, not sold; the licence terms accompany each product.",
          "Products reached through affiliate links are sold by the merchant (Amazon.in, Flipkart or others). The merchant's terms, pricing and consumer protections apply to those purchases — MN.KP is not the seller of record.",
        ],
      },
      {
        heading: "Content and intellectual property",
        paragraphs: [
          "The platform's design, writing, photography, code and brand assets are owned by MOHAMMED NIHAD KP and protected under India's Copyright Act, 1957. You may share links and short excerpts with attribution; systematic reproduction, resale or scraping requires written permission.",
          "Content you submit — comments, inquiries or messages — remains yours, but you grant MN.KP a limited, non-exclusive licence to store, display and use it to operate and improve the platform. You must not submit content you do not have the rights to.",
        ],
      },
      {
        heading: "Liability, law and disputes",
        paragraphs: [
          "The platform is provided on an \"as is\" basis to the fullest extent permitted by law. MN.KP is not liable for indirect or consequential losses, or for merchant-side issues such as delivery delays or product defects on affiliate purchases. Total liability for any claim is limited to the amount you paid MN.KP in the 12 months before the claim.",
          "These terms are governed by the laws of India, with exclusive jurisdiction in the courts at Kozhikode, Kerala. Disputes are first addressed through good-faith discussion — email intobusyness@gmail.com and every effort is made to resolve matters directly, quickly and fairly.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    description:
      "The cookies MN.KP sets — necessary, analytics and marketing — how long they last and how to change your consent choices anytime.",
    updated: "2025-06-01",
    sections: [
      {
        heading: "What cookies MN.KP uses",
        paragraphs: [
          "Cookies are small files a site stores in your browser. MN.KP uses three narrow categories, and nothing beyond them:",
        ],
        bullets: [
          "Necessary — the session cookie (mnkp_session) that keeps you signed in, and the cookie-consent record itself. These cannot be switched off.",
          "Analytics — aggregate traffic measurement that helps decide what to write and curate next.",
          "Marketing and affiliate — affiliate tracking tags applied when you follow product links, and measurement for the sponsored slots on the site.",
        ],
      },
      {
        heading: "Consent and control",
        paragraphs: [
          "On your first visit a consent banner lets you accept all cookies, reject everything optional, or choose categories individually from the preferences dialog. Your choice is stored locally and can be changed at any time — the banner reappears whenever the stored record is cleared.",
          "You can also block or delete cookies through your browser settings. Blocking necessary cookies will break sign-in and account features; blocking analytics or marketing cookies only removes those measurements, with no loss of core functionality.",
        ],
      },
      {
        heading: "Duration and third-party cookies",
        paragraphs: [
          "Session cookies expire when you sign out or close the browser; the consent record lasts up to 12 months; affiliate tags follow each program's own retention rules. When you follow a link to Amazon.in, Flipkart or another merchant, their sites set additional cookies under their own cookie policies, which we encourage you to review.",
          "You can inspect and clear cookies for mnkp.dev at any time from your browser's site settings — the consent record is named mnkp_cookie_consent, so you can reset your choices with one deletion. Clearing it simply brings the banner back on your next visit.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "refund-policy",
    title: "Refund Policy",
    description:
      "MN.KP refund rules: 7-day refund window on digital templates, merchant-handled refunds for affiliate orders, and service engagement terms.",
    updated: "2025-05-20",
    sections: [
      {
        heading: "First-party digital products",
        paragraphs: [
          "Digital products sold directly by MN.KP — templates, preset packs and similar items — carry a 7-day refund window starting from the delivery email. Because digital goods are delivered instantly and cannot literally be returned, the window exists to make sure you got what you expected:",
        ],
        bullets: [
          "The request reaches intobusyness@gmail.com within 7 days of the delivery email.",
          "The product is defective, materially different from its description, or the purchase was accidental or duplicated.",
          "Refunds are issued to the original payment method, typically within 5–7 working days, with any GST charged adjusted per applicable law.",
        ],
      },
      {
        heading: "Purchases made through affiliate links",
        paragraphs: [
          "When you buy a product via an Amazon.in or Flipkart link on this site, the merchant is the seller of record. Refunds, returns and replacements are governed by that merchant's own policy — for example Amazon.in return windows or Flipkart replacement and refund options — and must be initiated from your merchant account.",
          "MN.KP cannot force or promise merchant-side outcomes, and any commission earned on a refunded order is reversed automatically. What we can do is help you find the right channel and vouch for the facts you need — email intobusyness@gmail.com and we will point you in the right direction.",
        ],
      },
      {
        heading: "Services and subscriptions",
        paragraphs: [
          "For service engagements, refunds follow the Cancellation Policy: advances are returned minus invoiced, completed milestones. For subscriptions, monthly plans simply run to the end of the paid period, while yearly plans can be refunded pro-rata within 14 days of a renewal.",
          "Approved refunds are returned to the original payment method — typically within 5–7 working days for digital products and within 7 working days for engagement balances — with GST adjustments made per applicable law. If a refund is ever refused and you disagree, escalate it to intobusyness@gmail.com for a direct review by the owner.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "cancellation-policy",
    title: "Cancellation Policy",
    description:
      "How to cancel MN.KP subscriptions, service engagements and orders — notice periods, what happens to access, and merchant order cancellation.",
    updated: "2025-05-20",
    sections: [
      {
        heading: "Subscriptions",
        paragraphs: [
          "MN.KP subscriptions — Free, Pro (₹399 per month) and Business (₹1,499 per month) — can be cancelled at any time from Account → Billing. No cancellation fee, no retention phone calls:",
        ],
        bullets: [
          "Access and benefits continue until the end of the paid period; no partial-month refunds apply.",
          "Yearly plans can instead be refunded pro-rata within 14 days of a renewal, as described in the Refund Policy.",
          "After cancellation, account data is retained for 30 days in case you change your mind, then deleted.",
          "A cancelled plan can be resumed anytime from the billing page at the then-current price.",
        ],
      },
      {
        heading: "Service engagements",
        paragraphs: [
          "Service projects — websites, apps, photography, video and marketing — can be cancelled with written notice by email or WhatsApp. Cancellations before work begins are refunded in full, less payment-gateway charges where those are genuinely non-refundable.",
          "Once work has started, completed milestones are invoiced at the agreed rates, and the balance of any advance is refunded within 7 working days of cancellation. Deliverables completed up to that point are handed over to you.",
        ],
      },
      {
        heading: "Affiliate orders",
        paragraphs: [
          "Orders placed with Amazon, Flipkart or other merchants through MN.KP links must be cancelled on the merchant's own order page — most marketplaces allow cancellation until dispatch. MN.KP has no access to merchant order systems and cannot cancel on your behalf.",
          "If a cancellation window has already closed, the merchant's return or replacement process usually remains open after delivery — see the Returns Policy for how that works. Stuck finding the right option? Email intobusyness@gmail.com and we will help you locate it.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    description:
      "Affiliate orders ship directly from Amazon, Flipkart and other merchants; first-party MN.KP digital products are delivered instantly by email.",
    updated: "2025-05-20",
    sections: [
      {
        heading: "Affiliate orders — shipped by the merchant",
        paragraphs: [
          "MN.KP does not warehouse, pack or ship physical products. Every physical item in the store links to its listing on Amazon.in, Flipkart or another marketplace, which sells and ships the product under its own terms.",
          "Shipping timelines, delivery charges, serviceability and tracking are all set by the merchant and shown at their checkout before you pay. Estimated delivery shown on MN.KP pages is indicative only — the merchant's checkout is always the source of truth.",
        ],
      },
      {
        heading: "First-party digital products — instant delivery",
        paragraphs: [
          "First-party digital products — templates, presets and other MN.KP-created items — are delivered instantly by email at checkout, to any country, with no shipping charges. If the email has not arrived within a few minutes, check the spam folder, then write to intobusyness@gmail.com and the download link will be resent.",
          "Digital delivery means no shipping address, no customs and no waiting — downloads remain available through the link in the delivery email.",
        ],
      },
      {
        heading: "Service deliverables",
        paragraphs: [
          "Websites, apps, photos and videos are delivered digitally: deployments go live on the agreed platform (such as Vercel, Netlify or Firebase) and media files are handed over via secure download links. Physical media such as printed albums or pen drives, where specifically ordered as part of a photography engagement, is quoted and shipped separately with timelines agreed in writing.",
          "Digital deliverables carry no shipping risk, but handover timelines matter — every agreed scope states a delivery date, and you are notified the moment a handover link or deployment goes live. If a handover link expires or a file will not open, replacements are re-issued on request at no charge.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "returns-policy",
    title: "Returns Policy",
    description:
      "Returning products bought through MN.KP affiliate links (merchant returns apply) and returning first-party digital and physical items.",
    updated: "2025-05-20",
    sections: [
      {
        heading: "Products bought through affiliate links",
        paragraphs: [
          "Returns for products purchased via Amazon.in or Flipkart links on MN.KP are handled by the merchant under their published policy — typically 7–10 day return or replacement windows on Amazon.in and replacement or refund options on Flipkart, subject to each product's category rules.",
          "Initiate returns from your account on the merchant's site or app; MN.KP has no role in inspecting, approving or processing them. Commissions earned on returned orders are reversed automatically, so returns never influence our recommendations.",
        ],
      },
      {
        heading: "First-party digital items",
        paragraphs: [
          "Because digital products are delivered instantly, they are \"returned\" through the Refund Policy's 7-day window rather than a physical return:",
        ],
        bullets: [
          "Eligible: defective files, products materially different from their description, accidental or duplicate purchases.",
          "Not eligible: files already used extensively in shipped commercial work — though genuine problems are always fixed or refunded in good faith.",
          "No physical return is needed; refunds are issued to the original payment method.",
        ],
      },
      {
        heading: "Service work",
        paragraphs: [
          "Creative and development services do not carry returns in the shop-keeping sense. Instead, every scope includes an agreed number of revision rounds, and anything that misses the agreed specification is reworked at no charge. See the Terms of Service for how engagements are structured.",
          "If a deliverable is late or falls short of the written scope, say so in writing — rework is prioritised ahead of new engagements, and persistent misses qualify for a partial refund of the affected milestone.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "disclaimer",
    title: "Disclaimer",
    description:
      "MN.KP content is general information, not professional advice — honest reviews, no warranties, and what affiliate links mean for you.",
    updated: "2025-05-12",
    sections: [
      {
        heading: "General information only",
        paragraphs: [
          "Everything published on MN.KP — blog articles, guides, reviews, tutorials and training material — is general information and personal opinion, not professional advice. It is written by MOHAMMED NIHAD KP from practical experience in Calicut, Kerala, and shared to educate and inspire.",
          "Nothing on this site constitutes legal, financial, tax, medical or other professional advice. Verify important decisions with a qualified professional, especially where your own business, taxes or legal obligations are concerned.",
        ],
      },
      {
        heading: "Affiliate content and pricing",
        paragraphs: [
          "Product listings, prices, ratings and availability are accurate to the best of our knowledge at the time of writing, but they are drawn from merchant data and are subject to change at the merchant at any time. Always confirm the final price and terms at checkout on Amazon.in or Flipkart.",
          "Some links are affiliate links from which MN.KP may earn a commission — a relationship disclosed in line with the U.S. FTC endorsement guides and India's ASCI guidelines for influencers. See the Affiliate Disclosure for the full picture.",
        ],
      },
      {
        heading: "External links and no warranties",
        paragraphs: [
          "MN.KP links to third-party sites it does not control and cannot continuously verify. Following those links is at your own discretion, and their content, availability and policies are theirs alone.",
          "The platform is provided in good faith \"as is\", without warranties of any kind, to the fullest extent permitted by law.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "accessibility-statement",
    title: "Accessibility Statement",
    description:
      "MN.KP's commitment to WCAG 2.1 Level AA accessibility — the standards we build to, known limitations, and how to report barriers.",
    updated: "2025-04-28",
    sections: [
      {
        heading: "Our commitment",
        paragraphs: [
          "MN.KP is committed to making mnkp.dev usable by everyone, including people using screen readers, keyboard-only navigation, magnification or reduced-motion settings. Accessibility is treated as an engineering requirement, not an afterthought — the same AI-assisted speed that builds the site is paired with human checks against the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.",
          "The statement applies to mnkp.dev and its subdomains in both light and dark themes. It is reviewed with each significant platform change, and the date on this page reflects the latest review.",
        ],
      },
      {
        heading: "What we build to",
        paragraphs: [
          "Concretely, the platform is built and tested against the following:",
        ],
        bullets: [
          "Semantic HTML landmarks — header, nav, main, footer — with a skip-to-content link.",
          "Full keyboard operability, with visible focus indicators on every interactive element.",
          "Colour contrast that meets WCAG AA in both light and dark themes, with no meaning conveyed by colour alone.",
          "Touch targets of at least 44 pixels on mobile navigation and interactive rows.",
          "Text alternatives and labels for controls; motion kept subtle and CSS-based so reduced-motion settings are respected.",
        ],
      },
      {
        heading: "Known limitations and feedback",
        paragraphs: [
          "Some embedded third-party content — the Google Map embed on the contact page, and merchant widgets reached through affiliate links — sits outside our control and may not fully conform. Where a limitation is known, it is documented here or beside the component itself.",
          "If you hit a barrier, email intobusyness@gmail.com or message WhatsApp +91 98467 50898 with the page and a short description; accessibility reports are triaged with priority and acknowledged within 5 working days.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "data-processing-agreement",
    title: "Data Processing Agreement",
    description:
      "How MN.KP acts as data fiduciary and processor, the security measures applied, and how data subject requests are handled end to end.",
    updated: "2025-05-12",
    sections: [
      {
        heading: "Scope, roles and obligations",
        paragraphs: [
          "This summary explains how MN.KP handles personal data when processing is done on behalf of a client — for example, building an app, running analytics or sending email for a business. In those engagements the client is the data fiduciary (controller) and MN.KP acts as the data processor, under India's DPDP Act 2023 and, for EU/UK clients, the GDPR.",
          "Processing happens only on documented instructions from the client, for the agreed purpose and duration, with confidentiality obligations surviving the end of the engagement. Where MN.KP processes data for its own platform, the Privacy Policy applies instead.",
        ],
      },
      {
        heading: "Security measures applied",
        paragraphs: [
          "Every engagement inherits the platform's baseline security controls:",
        ],
        bullets: [
          "TLS encryption for all traffic; bcrypt password hashing wherever accounts are involved.",
          "Least-privilege database and infrastructure access, with individual accountability.",
          "Secrets and API keys stored in environment variables — never in code or repositories.",
          "API rate limiting, input validation and audit logging on request paths.",
          "Regular dependency audits and prompt patching of the runtime stack.",
        ],
      },
      {
        heading: "Sub-processors, requests and breaches",
        paragraphs: [
          "MN.KP relies on a short list of sub-processors — hosting, email delivery, payments and analytics providers — named to clients on request and bound by equivalent obligations.",
          "Data subject requests forwarded by a client are assisted within 7 days. Suspected personal-data breaches are contained first, then notified to the affected client without undue delay and within 72 hours of confirmation, followed by a written incident summary and remediation plan.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "acceptable-use-policy",
    title: "Acceptable Use Policy",
    description:
      "What you can and cannot do on MN.KP — prohibited conduct, content rules, account security duties and how violations are enforced.",
    updated: "2025-04-15",
    sections: [
      {
        heading: "Prohibited conduct",
        paragraphs: [
          "To keep MN.KP useful and safe, the following is not allowed anywhere on the platform — accounts, comments, inquiries, uploads or API usage:",
        ],
        bullets: [
          "Unlawful content, or content that infringes intellectual property or privacy rights.",
          "Harassment, hate speech, threats or targeted abuse of any person or group.",
          "Spam, bulk automated requests, scraping, or attempts to bypass rate limits and paywalls.",
          "Probing or attacking the platform's security, other than sanctioned responsible disclosure.",
          "Account sharing, credential selling, or impersonation of MN.KP or its owner.",
          "Submitting malicious files, malware links or exploit payloads through any form or upload.",
        ],
      },
      {
        heading: "Content standards",
        paragraphs: [
          "Comments and community contributions should be relevant, honest and respectful — critique ideas, not people. Commercial self-promotion is welcome only where it genuinely adds to the discussion, and AI-generated spam comments are removed on sight. See the Community Guidelines for the full standard.",
          "If you use AI tools to draft a comment or question, that is fine — just make it worth reading and own what it says. Machine-generated bulk postings, engagement farming and undisclosed bot accounts fall squarely under prohibited conduct.",
        ],
      },
      {
        heading: "Enforcement",
        paragraphs: [
          "Violations typically follow a graduated path: a warning, then temporary suspension, then termination — and, for unlawful activity, referral to the authorities under the Information Technology Act, 2000 and the rules made under it.",
          "Report abuse to intobusyness@gmail.com with the page and a description; reports are reviewed within 24 hours. Access may be suspended immediately, without prior notice, where ongoing harm or a security risk is involved.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "security-policy",
    title: "Security Policy",
    description:
      "The safeguards protecting MN.KP — encrypted auth, least-privilege access, monitored APIs, backups and how incidents are responded to.",
    updated: "2025-05-12",
    sections: [
      {
        heading: "How the platform is protected",
        paragraphs: [
          "MN.KP applies a practical, layered security baseline to every part of the platform:",
        ],
        bullets: [
          "TLS for all traffic; strict cookie handling with httpOnly, signed session tokens.",
          "bcrypt password hashing; no plaintext credentials stored anywhere.",
          "Least-privilege database access and server-side authorisation checks on every admin path.",
          "API rate limiting, schema validation and consistent error envelopes that leak no internals.",
          "Secrets held in environment variables; dependency advisories monitored and patched.",
          "Regular database backups and a documented restore path.",
        ],
      },
      {
        heading: "Your part in security",
        paragraphs: [
          "Security is shared. You can help by:",
        ],
        bullets: [
          "Using a strong, unique password for your MN.KP account and not reusing it elsewhere.",
          "Signing out on shared or public devices.",
          "Treating email as suspect: MN.KP only writes from intobusyness@gmail.com and never asks for your password.",
          "Reporting anything odd — phishing, suspicious \"MN.KP\" messages, unexpected password-reset emails.",
        ],
      },
      {
        heading: "Incidents and breaches",
        paragraphs: [
          "Suspicious activity is investigated as it is detected, through monitoring and user reports. Confirmed incidents affecting personal data are handled per the Data Processing Agreement: containment first, notification to affected users and regulators where legally required under the DPDP Act 2023 and GDPR timelines, then a public post-mortem where it is useful.",
          "After any incident that touches your account, MN.KP will tell you plainly what happened, what data was involved, what was done about it, and whether you need to change your password. No jargon, no quiet patches — the same honesty standard the platform applies to product reviews.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "responsible-disclosure",
    title: "Responsible Disclosure",
    description:
      "Found a security issue on MN.KP? Report it safely — scope, preferred contact, safe harbor and recognition for responsible researchers.",
    updated: "2025-04-15",
    sections: [
      {
        heading: "Scope and how to report",
        paragraphs: [
          "If you believe you have found a security vulnerability on mohdnihadkp.vercel.app or its subdomains, MN.KP wants to hear about it. Send details to intobusyness@gmail.com with the subject line \"Security disclosure\" — a plain email is preferred over web forms or public channels.",
          "Please include reproduction steps, the potential impact, and any proof-of-concept you can share. Coordinated disclosure with a 90-day remediation window is honoured in both directions.",
        ],
        bullets: [
          "In scope: cross-site scripting, injection flaws, authentication and authorisation bypasses, insecure direct object references, exposure of personal data, and server-side request forgery on mnkp.dev.",
          "Out of scope: volumetric flooding, social engineering, spam, and vulnerabilities in third-party merchant sites reached by link.",
        ],
      },
      {
        heading: "Safe harbour and recognition",
        paragraphs: [
          "Good-faith research that respects the rules below will not be pursued legally. In return, researchers are asked to avoid data exfiltration beyond minimal proof, not to degrade or interrupt service, not to target other users, and to keep findings private until a fix ships.",
          "MN.KP is a young platform, so there is no paid bug bounty today. Accepted reports earn a personal thank-you, credit by name on this page if you would like it, and priority input on the fix — your patience genuinely helps build the security culture here.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "community-guidelines",
    title: "Community Guidelines",
    description:
      "How to behave in MN.KP comments and community spaces — respect first, prohibited behaviour, moderation and how to report problems.",
    updated: "2025-04-15",
    sections: [
      {
        heading: "The standard we hold",
        paragraphs: [
          "MN.KP's community spaces — comments, inquiries and anywhere readers interact — exist to share practical knowledge about AI, building and business, from Calicut to the world. The bar is simple: be as respectful in a comment as you would be in a conversation.",
          "Sharp questions, disagreement with conclusions and lived-experience corrections are all welcome — that is how good work gets better. What is not welcome is making it personal.",
        ],
      },
      {
        heading: "Not allowed",
        paragraphs: [
          "The following will be removed without ceremony:",
        ],
        bullets: [
          "Hate speech, harassment, threats or attacks on any person or group.",
          "Doxxing — publishing anyone's personal data or private communications.",
          "Spam and link-dumping, including AI-generated comment spam posted in bulk.",
          "Illegal content, including content prohibited under Indian law.",
          "Impersonation of MN.KP, its owner or other community members.",
        ],
      },
      {
        heading: "Moderation, reporting and appeals",
        paragraphs: [
          "Moderation is carried out by MOHAMMED NIHAD KP and is deliberately light — most spaces require no intervention at all. Removals, suspensions and bans are logged with reasons.",
          "To report a problem, use the contact form or email intobusyness@gmail.com with a link and a one-line description. If your content was actioned and you believe the call was wrong, reply to the moderation note — appeals are reviewed within 3 working days and reversed when the decision was incorrect.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "affiliate-disclosure",
    title: "Affiliate Disclosure",
    description:
      "MN.KP earns commissions from Amazon Associates, Flipkart and other programs — how links are disclosed and why prices can change.",
    updated: "2025-06-01",
    sections: [
      {
        heading: "How affiliate links work",
        paragraphs: [
          "MN.KP participates in the Amazon Associates Program (Amazon.in), the Flipkart Affiliate Program and other merchant affiliate programs. When you buy through certain links on this site, MN.KP may earn a commission from the merchant — at no additional cost to you. The merchant pays the commission; the price you pay is the same.",
          "This disclosure is made as required by the U.S. FTC's endorsement guides (16 CFR Part 255) and the ASCI guidelines for influencer advertising in India, alongside India's Consumer Protection (E-commerce) Rules, 2020. Product pages and review content carry the disclosure close to the links it applies to, so it is never more than a glance away.",
        ],
      },
      {
        heading: "\"Sponsored\" labels on ad slots",
        paragraphs: [
          "Promotional slots across the site — the home strip, blog inline and sidebar placements — are framed with a gold dashed border and labelled \"Sponsored — affiliate links\", so commission-earning placements are always distinguishable from editorial writing at a glance.",
          "What the label means for you: the placement was chosen for its promotional value, the items in it may earn MN.KP a commission if you buy them, and their appearance there is not a review verdict. Honest reviews, ratings and pros-and-cons live on the full product pages instead. See the Advertising Disclosure for how paid placements are handled overall.",
        ],
      },
      {
        heading: "Prices and availability",
        paragraphs: [
          "Prices, discounts and availability shown on MN.KP pages are indicative snapshots from merchant data at the time of writing or last update, and are subject to change at the merchant at any time. The authoritative price is the one shown at the merchant's checkout before you pay — always check there before buying.",
          "MN.KP also sells its own first-party digital products directly. Those are clearly marked as MN.KP Digital, priced in INR, and are not affiliate listings — purchases and refunds for them are handled entirely by MN.KP.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "advertising-disclosure",
    title: "Advertising Disclosure",
    description:
      "How sponsored placements and ad slots on MN.KP are labeled, paid partnerships are handled and editorial independence is preserved.",
    updated: "2025-06-01",
    sections: [
      {
        heading: "Paid placements on MN.KP",
        paragraphs: [
          "Advertising on mnkp.dev takes three forms: sponsored product slots drawn from the affiliate catalog and labelled \"Sponsored\"; occasional paid placements in blog sidebar or inline positions; and future sponsorships of specific articles or series.",
          "Every such placement is labelled. Sponsored articles, when they exist, are marked \"Sponsored\" at the top, carry the sponsor's name, and stay visually and editorially distinct from the site's own writing. In line with ASCI's guidelines for digital advertising, ads are identifiable as ads without requiring a click.",
        ],
      },
      {
        heading: "Independence is not for sale",
        paragraphs: [
          "Payment — commission, sponsorship or advertising — never buys a positive review, a rating change, or the quiet removal of cons. Sponsored slots rotate from the same honestly-reviewed catalog that the store lists, and categories misaligned with MN.KP's audience (get-rich-quick schemes, misleading health claims and the like) are declined outright.",
          "Questions about any specific placement can be sent to intobusyness@gmail.com — the answer will be boring, and honest.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "editorial-policy",
    title: "Editorial Policy",
    description:
      "How MN.KP reviews, rates and recommends products — hands-on testing, research sources, corrections policy and affiliate independence.",
    updated: "2025-05-12",
    sections: [
      {
        heading: "How products and tools are chosen",
        paragraphs: [
          "The store curates tech and creator gear that MN.KP believes is genuinely worth owning — chosen through hands-on use wherever possible, supplemented by manufacturer specifications and aggregated long-term owner feedback. Priority goes to products that are serviceable and sensibly priced in India, with reliable after-sales support through Amazon.in or Flipkart.",
          "Digital products sold under the MN.KP Digital label are built and tested in-house before they are listed.",
        ],
      },
      {
        heading: "How ratings and reviews work",
        paragraphs: [
          "Reviews follow fixed rules so that ratings mean something:",
        ],
        bullets: [
          "Pros and cons are both mandatory — no perfect scores for perfect money.",
          "Ratings synthesise hands-on experience with the long-term consensus of owners.",
          "The affiliate relationship is disclosed on every product page, every time.",
          "Prices are shown in INR and flagged as merchant-verified at the time of the last update.",
        ],
      },
      {
        heading: "Corrections and updates",
        paragraphs: [
          "Mistakes are fixed visibly: articles carry an \"updated\" date, and material corrections are noted at the end of the piece. If new information — a failing batch, a firmware controversy, a price collapse — changes the verdict, the review is updated and the change is visible rather than silent.",
          "If you spot an error, email intobusyness@gmail.com or message WhatsApp +91 98467 50898 — corrections from readers are the oldest quality-control system on the internet, and the most effective one.",
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "earnings-disclaimer",
    title: "Earnings Disclaimer",
    description:
      "No income promises: MN.KP earnings content is educational, results vary, and affiliate commissions never influence our advice.",
    updated: "2025-05-12",
    sections: [
      {
        heading: "Educational content, not income promises",
        paragraphs: [
          "Parts of MN.KP — blog posts about freelancing, business growth and AI careers, and the AI Mastery training service — discuss earning money, pricing work and building businesses. That content is educational, based on one person's real experience in Kerala, India.",
          "It is not a promise of income. Results depend on your effort, market, timing and skill — businesses can and do lose money. Nothing on this site is financial or investment advice; evaluate your own situation, and where the stakes are high, consult a qualified professional.",
        ],
      },
      {
        heading: "Affiliate and advertising income",
        paragraphs: [
          "MN.KP earns commissions from affiliate programs (Amazon Associates, Flipkart and others) and may earn advertising or sponsorship revenue. These earnings keep the platform free to read, and they do not buy favourable coverage — see the Editorial Policy and Affiliate Disclosure for the mechanics.",
          "Any income figures quoted anywhere on this site are illustrative rather than typical, and all earnings are subject to Indian income-tax and GST obligations as applicable.",
        ],
      },
    ],
  },
];

/** Find a legal document by its slug (undefined when unknown). */
export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
