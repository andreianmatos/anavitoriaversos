import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "imagens");
const thumbDir = path.join(srcDir, "thumbs");
const manifestPath = path.join(root, "images.json");

const MAX_WIDTH = 560;
const JPEG_QUALITY = 82;

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.mkdirSync(thumbDir, { recursive: true });

for (const entry of manifest) {
  const file = entry.file;
  const src = path.join(srcDir, file);
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  const outName = ext === ".gif" ? `${base}.gif` : `${base}.jpg`;
  const out = path.join(thumbDir, outName);

  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${file}`);
    continue;
  }

  if (ext === ".gif") {
    fs.copyFileSync(src, out);
    console.log(`copied gif: ${outName}`);
    continue;
  }

  await sharp(src)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(out);

  console.log(`thumb: ${outName}`);
}

console.log("done");
