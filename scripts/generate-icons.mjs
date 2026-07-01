import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// Pulse logomark: amber gradient rounded square + pulse-wave
function svg(size, { rounded = true, bg = true } = {}) {
  const rx = rounded ? Math.round(size * 0.22) : 0;
  // pulse-wave path defined on a 24u grid, centered & scaled
  const scale = size / 24 * 0.62;
  const tx = size / 2 - 12 * scale;
  const ty = size / 2 - 12 * scale;
  const strokeW = (24 / (size / 24)) * 0.9 / scale * (size / 512) + 1.4;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0ad2a"/>
      <stop offset="1" stop-color="#c47e0a"/>
    </linearGradient>
  </defs>
  ${bg ? `<rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>` : ""}
  <g transform="translate(${tx},${ty}) scale(${scale})">
    <path d="M2 12h3.5l2-6 3 13 2.5-9 1.8 4H22" fill="none" stroke="#0b0b0e" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function gen(name, size, opts) {
  const out = join(publicDir, name);
  await sharp(Buffer.from(svg(size, opts))).png().toFile(out);
  console.log("✓", name);
}

await gen("icon-192.png", 192);
await gen("icon-512.png", 512);
await gen("apple-touch-icon.png", 180);
// maskable with extra padding handled by safe-zone; reuse 512 (centered wave has >20% margin)
await gen("icon-maskable-512.png", 512);

// favicon as 32px png written to .ico-like png (browsers accept png favicon)
await gen("favicon-32.png", 32);

console.log("Done.");
