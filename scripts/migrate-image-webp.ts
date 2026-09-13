/**
 * Task 13-e — one-off DB migration: replace seeded /images/**.png references
 * with .webp in every column that stores image paths (posts cover/og/content,
 * products image/gallery/description, ventures image/description, ads
 * image/images, users avatar, site_settings media JSON). Idempotent; prints
 * a per-table change report. Audit-log snapshots are historical records and
 * are intentionally left untouched.
 */
import { db } from "../src/lib/db";

const IMG_PNG_RE = /\/images\/(blog|brand|store)\/([a-z0-9-]+)\.png/g;

function rewriteText(text: string): string {
  return text.replace(IMG_PNG_RE, (_m, dir: string, name: string) => `/images/${dir}/${name}.webp`);
}

/** Recursively rewrite every string inside a parsed JSON value. */
function rewriteJson(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    const next = rewriteText(value);
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const arr = value.map((item) => {
      const r = rewriteJson(item);
      changed = changed || r.changed;
      return r.value;
    });
    return { value: arr, changed };
  }
  if (value !== null && typeof value === "object") {
    let changed = false;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = rewriteJson(v);
      changed = changed || r.changed;
      obj[k] = r.value;
    }
    return { value: obj, changed };
  }
  return { value, changed: false };
}

let totalChanges = 0;

/* ---------------- Posts ---------------- */
{
  const rows = await db.post.findMany({
    select: { id: true, coverImageUrl: true, ogImageUrl: true, content: true },
  });
  let changed = 0;
  for (const row of rows) {
    const cover = row.coverImageUrl ? rewriteText(row.coverImageUrl) : null;
    const og = row.ogImageUrl ? rewriteText(row.ogImageUrl) : null;
    const content = rewriteText(row.content);
    if (
      (cover !== null && cover !== row.coverImageUrl) ||
      (og !== null && og !== row.ogImageUrl) ||
      content !== row.content
    ) {
      await db.post.update({
        where: { id: row.id },
        data: { coverImageUrl: cover, ogImageUrl: og, content },
      });
      changed++;
    }
  }
  totalChanges += changed;
  console.log(`Post: ${changed}/${rows.length} rows updated`);
}

/* ---------------- Products ---------------- */
{
  const rows = await db.product.findMany({
    select: { id: true, imageUrl: true, gallery: true, description: true },
  });
  let changed = 0;
  for (const row of rows) {
    const imageUrl = row.imageUrl ? rewriteText(row.imageUrl) : null;
    let gallery: string | null = null;
    if (row.gallery) {
      const parsed = JSON.parse(row.gallery) as unknown;
      const r = rewriteJson(parsed);
      if (r.changed) gallery = JSON.stringify(r.value);
    }
    const description = row.description ? rewriteText(row.description) : null;
    if (
      (imageUrl !== null && imageUrl !== row.imageUrl) ||
      gallery !== null ||
      (description !== null && description !== row.description)
    ) {
      await db.product.update({
        where: { id: row.id },
        data: { imageUrl, gallery: gallery ?? undefined, description },
      });
      changed++;
    }
  }
  totalChanges += changed;
  console.log(`Product: ${changed}/${rows.length} rows updated`);
}

/* ---------------- Ventures ---------------- */
{
  const rows = await db.venture.findMany({
    select: { id: true, imageUrl: true, description: true },
  });
  let changed = 0;
  for (const row of rows) {
    const imageUrl = row.imageUrl ? rewriteText(row.imageUrl) : null;
    const description = row.description ? rewriteText(row.description) : null;
    if (
      (imageUrl !== null && imageUrl !== row.imageUrl) ||
      (description !== null && description !== row.description)
    ) {
      await db.venture.update({ where: { id: row.id }, data: { imageUrl, description } });
      changed++;
    }
  }
  totalChanges += changed;
  console.log(`Venture: ${changed}/${rows.length} rows updated`);
}

/* ---------------- Ads ---------------- */
{
  const rows = await db.ad.findMany({
    select: { id: true, imageUrl: true, images: true },
  });
  let changed = 0;
  for (const row of rows) {
    const imageUrl = row.imageUrl ? rewriteText(row.imageUrl) : null;
    let images: string | null = null;
    if (row.images) {
      const parsed = JSON.parse(row.images) as unknown;
      const r = rewriteJson(parsed);
      if (r.changed) images = JSON.stringify(r.value);
    }
    if ((imageUrl !== null && imageUrl !== row.imageUrl) || images !== null) {
      await db.ad.update({ where: { id: row.id }, data: { imageUrl, images: images ?? undefined } });
      changed++;
    }
  }
  totalChanges += changed;
  console.log(`Ad: ${changed}/${rows.length} rows updated`);
}

/* ---------------- Users (avatarUrl) ---------------- */
{
  const rows = await db.user.findMany({ select: { id: true, avatarUrl: true } });
  let changed = 0;
  for (const row of rows) {
    const avatarUrl = row.avatarUrl ? rewriteText(row.avatarUrl) : null;
    if (avatarUrl !== null && avatarUrl !== row.avatarUrl) {
      await db.user.update({ where: { id: row.id }, data: { avatarUrl } });
      changed++;
    }
  }
  totalChanges += changed;
  console.log(`User: ${changed}/${rows.length} rows updated`);
}

/* ---------------- Site settings (media JSON etc.) ---------------- */
{
  const rows = await db.siteSetting.findMany({ select: { key: true, value: true } });
  let changed = 0;
  for (const row of rows) {
    if (!row.value) continue;
    const parsed = JSON.parse(row.value) as unknown;
    const r = rewriteJson(parsed);
    if (r.changed) {
      await db.siteSetting.update({
        where: { key: row.key },
        data: { value: JSON.stringify(r.value) },
      });
      console.log(`  siteSetting "${row.key}" updated`);
      changed++;
    }
  }
  totalChanges += changed;
  console.log(`SiteSetting: ${changed}/${rows.length} rows updated`);
}

console.log(`\nTOTAL rows changed: ${totalChanges}`);
await db.$disconnect();
