import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

// Idempotent demo ads — visible out of the box, fully editable in Ad Manager.
const ADS = [
  {
    name: "Creator Gear Deals — Header",
    type: "text",
    placement: "header-banner",
    title: "Creator Gear Deals",
    body: "Handpicked Amazon offers on cameras, audio and desk setups — updated weekly.",
    linkUrl: "#/store",
    linkLabel: "Browse picks",
    priority: 10,
  },
  {
    name: "Store Marquee — Scrolling Picks",
    type: "marquee",
    placement: "marquee",
    title: "Fresh in the store",
    images: [
      "/images/store/prod-creator-camera.png",
      "/images/store/prod-headphones.png",
      "/images/store/prod-keyboard.png",
      "/images/store/prod-mouse.png",
      "/images/store/prod-powerbank.png",
      "/images/store/prod-ssd.png",
    ],
    linkUrl: "#/store",
    linkLabel: "See all",
    priority: 8,
  },
  {
    name: "Pro Plan — In-article",
    type: "text",
    placement: "blog-inline",
    title: "Read without ads — go Pro",
    body: "Premium deep-dives, early affiliate deal alerts and ad-free reading from ₹399/month.",
    linkUrl: "#/account/billing",
    linkLabel: "Upgrade",
    priority: 6,
  },
  {
    name: "Newsletter — Between cards",
    type: "text",
    placement: "between-cards",
    title: "One useful email, every week",
    body: "AI tools, deals and build notes from Calicut. No spam, unsubscribe anytime.",
    linkUrl: "#/support",
    linkLabel: "Subscribe free",
    priority: 5,
  },
  {
    name: "WhatsApp sticker",
    type: "sticker",
    placement: "sticker",
    title: "👋 Chat with Nihad",
    imageUrl: "/images/brand/portrait.png",
    linkUrl: "https://api.whatsapp.com/send?phone=919846750898&text=Hello...!",
    linkLabel: "WhatsApp",
    priority: 4,
  },
  {
    name: "Affiliate store — Footer",
    type: "text",
    placement: "footer-banner",
    title: "Shop the MN.KP picks",
    body: "Every product honestly reviewed before it makes the list.",
    linkUrl: "#/store",
    linkLabel: "Visit store",
    priority: 3,
  },
];

async function main() {
  const count = await db.ad.count();
  if (count > 0) {
    console.log(`ads already seeded (${count}) — skipping`);
    return;
  }
  for (const ad of ADS) {
    await db.ad.create({
      data: {
        name: ad.name,
        type: ad.type,
        placement: ad.placement,
        title: ad.title ?? null,
        body: ad.body ?? null,
        imageUrl: ad.imageUrl ?? null,
        imageAlt: ad.imageUrl ? ad.name : null,
        images: JSON.stringify(ad.images ?? []),
        linkUrl: ad.linkUrl ?? null,
        linkLabel: ad.linkLabel ?? "Learn more",
        active: true,
        priority: ad.priority,
      },
    });
  }
  console.log(`seeded ${ADS.length} demo ads`);
}
main().finally(() => db.$disconnect());
