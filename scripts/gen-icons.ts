import sharp from "sharp";

const src = "public/favicon.svg";

const targets: Array<[number, string]> = [
  [512, "public/icon-512.png"],
  [192, "public/icon-192.png"],
  [180, "public/apple-touch-icon.png"],
  [32, "public/favicon-32.png"],
];

for (const [size, out] of targets) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(out);
  console.log(`wrote ${out} (${size}x${size})`);
}
