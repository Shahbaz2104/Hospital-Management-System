/* Generates PWA icons (public/icon-192.png, icon-512.png, maskable-512.png)
 * — teal gradient rounded square with a white medical cross. Run once:
 * npx tsx scripts/generate-icons.ts
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join } from "path";

const OUT = join(process.cwd(), "public");
mkdirSync(OUT, { recursive: true });

const CROSS = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#0891b2"/>
    <path d="M296 96h-80v120H96v80h120v120h80V296h120v-80H296z" fill="#fff"/>
  </svg>`
);

async function main() {
  const icon192 = await sharp(CROSS).resize(192, 192).png().toBuffer();
  const icon512 = await sharp(CROSS).resize(512, 512).png().toBuffer();
  const maskable = await sharp(CROSS).resize(512, 512).png().toBuffer();
  await Promise.all([
    sharp(icon192).toFile(join(OUT, "icon-192.png")),
    sharp(icon512).toFile(join(OUT, "icon-512.png")),
    sharp(maskable).toFile(join(OUT, "maskable-512.png")),
  ]);
  console.log("Icons written to", OUT);
}

void main();
