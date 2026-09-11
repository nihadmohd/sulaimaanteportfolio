import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // 1. Admin account email → user's real all-in-one email
  const admin = await db.user.update({ where: { email: "admin@mnkp.dev" }, data: { email: "intobusyness@gmail.com" } });
  console.log("admin email →", admin.email, "role:", admin.role);
  // 2. Canonical URLs on posts → new domain
  const posts = await db.post.findMany({ select: { id: true, canonicalUrl: true } });
  let fixed = 0;
  for (const p of posts) {
    if (p.canonicalUrl?.includes("mnkp.vercel.app")) {
      await db.post.update({ where: { id: p.id }, data: { canonicalUrl: p.canonicalUrl.replace(/https?:\/\/[^/]+/, "https://mohdnihadkp.vercel.app") } });
      fixed++;
    }
  }
  console.log("canonical URLs fixed:", fixed);
  // 3. Brand settings row email (if stored)
  const brand = await db.siteSetting.findUnique({ where: { key: "brand" } });
  if (brand) {
    try {
      const v = JSON.parse(brand.value) as Record<string, unknown>;
      let changed = false;
      if (typeof v.email === "string" && v.email === "hello@mnkp.dev") { v.email = "intobusyness@gmail.com"; changed = true; }
      if (changed) {
        await db.siteSetting.update({ where: { key: "brand" }, data: { value: JSON.stringify(v) } });
        console.log("brand settings email updated");
      } else console.log("brand settings email already OK:", v.email);
    } catch { console.log("brand parse skipped"); }
  } else console.log("no brand settings row (defaults apply)");
}
main().finally(() => db.$disconnect());
