/**
 * MN.KP — factory reset ("give me my website, fresh").
 *
 * Run with:  bun scripts/factory-reset.ts
 *
 * Wipes every trace of example/demo content:
 *   users, posts, products, ventures, ads, categories, inquiries,
 *   subscribers, affiliate clicks, visitor sessions, audit logs,
 *   notifications and all stored settings — then reports the fresh state.
 *
 * The very next visitor can claim the website at #/setup (first-run owner
 * account). All platform defaults (brand, media marquee, footer, SEO,
 * analytics…) apply automatically the moment rows are absent.
 *
 * Idempotent: running it twice is a no-op the second time.
 */

import { db } from "../src/lib/db";

async function main() {
  console.log("Factory reset — removing all content and accounts…\n");

  // Order matters where foreign keys exist (SQLite mirrors the Postgres DDL).
  const steps: Array<[string, () => Promise<unknown>]> = [
    ["affiliate clicks", () => db.affiliateClick.deleteMany()],
    ["visitor sessions", () => db.visitorSession.deleteMany()],
    ["audit logs", () => db.auditLog.deleteMany()],
    ["inquiries", () => db.inquiry.deleteMany()],
    ["newsletter subscribers", () => db.newsletterSubscriber.deleteMany()],
    ["ads", () => db.ad.deleteMany()],
    ["ventures", () => db.venture.deleteMany()],
    ["posts", () => db.post.deleteMany()],
    ["products", () => db.product.deleteMany()],
    ["categories", () => db.category.deleteMany()],
    ["users", () => db.user.deleteMany()],
    ["site settings", () => db.siteSetting.deleteMany()],
  ];

  for (const [label, run] of steps) {
    const result = await run();
    console.log(`  cleared ${label}: ${result.count} row(s) removed`);
  }

  const counts = {
    users: await db.user.count(),
    posts: await db.post.count(),
    products: await db.product.count(),
    ventures: await db.venture.count(),
    ads: await db.ad.count(),
    categories: await db.category.count(),
    inquiries: await db.inquiry.count(),
    subscribers: await db.newsletterSubscriber.count(),
    settings: await db.siteSetting.count(),
  };

  console.log("\nFresh state:", JSON.stringify(counts));
  console.log(
    "\nNext step: open the website → the Admin & Developer sign-in shows a" +
      " first-run callout → claim the owner account at #/setup."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
