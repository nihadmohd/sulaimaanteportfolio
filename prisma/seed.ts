/**
 * MN.KP — fresh-install seed.
 *
 * Run with:  bun prisma/seed.ts
 *
 * A brand-new website starts EMPTY by design:
 *   - no users      → the owner claims the site via #/setup (first run)
 *   - no posts / products / ventures / ads / categories → the owner creates
 *     real content in the Admin & Developer console (or imports it)
 *   - no settings rows → every setting degrades to the constants.ts defaults
 *
 * This script therefore only verifies the database is reachable and reports
 * the fresh state. It is safe to run at any time — it writes nothing.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [users, posts, products, ventures, ads, categories, inquiries, subscribers, settings] =
    await Promise.all([
      db.user.count(),
      db.post.count(),
      db.product.count(),
      db.venture.count(),
      db.ad.count(),
      db.category.count(),
      db.inquiry.count(),
      db.newsletterSubscriber.count(),
      db.siteSetting.count(),
    ]);

  console.log("Fresh-install check — current database state:");
  console.log(`  users:        ${users}`);
  console.log(`  posts:        ${posts}`);
  console.log(`  products:     ${products}`);
  console.log(`  ventures:     ${ventures}`);
  console.log(`  ads:          ${ads}`);
  console.log(`  categories:   ${categories}`);
  console.log(`  inquiries:    ${inquiries}`);
  console.log(`  subscribers:  ${subscribers}`);
  console.log(`  settings:     ${settings}`);

  if (users === 0) {
    console.log(
      "\nNo owner account yet — open the site and visit #/setup to claim it" +
        " (the Admin & Developer login shows a first-run callout too)."
    );
  }
  console.log("\nAll defaults (brand, media, footer, SEO, analytics…) apply automatically.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
