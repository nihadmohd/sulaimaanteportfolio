/**
 * Task 13-e — one-off: convert public/images/{blog,brand,store}/*.png
 * (actually JPEG payloads) to real .webp at quality 82, same base filename.
 * Old .png files are deleted only after the DB reference migration script
 * has run (see worklog Task 13-e).
 */
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "public/images");
const DIRS = ["blog", "brand", "store"];

let beforeTotal = 0;
let afterTotal = 0;

for (const dir of DIRS) {
  const files = (await readdir(path.join(ROOT, dir))).filter((f) => f.endsWith(".png"));
  for (const file of files) {
    const src = path.join(ROOT, dir, file);
    const out = src.replace(/\.png$/, ".webp");
    const before = (await stat(src)).size;
    const info = await sharp(src).webp({ quality: 82 }).toFile(out);
    beforeTotal += before;
    afterTotal += info.size;
    console.log(`${dir}/${file} -> ${path.basename(out)}: ${(before / 1024).toFixed(1)}KB -> ${(info.size / 1024).toFixed(1)}KB`);
  }
}

console.log(`\nTOTAL: ${(beforeTotal / 1024).toFixed(1)}KB -> ${(afterTotal / 1024).toFixed(1)}KB (${((1 - afterTotal / beforeTotal) * 100).toFixed(1)}% saved)`);
